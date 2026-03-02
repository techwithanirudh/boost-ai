import { readChat, saveChat } from "@boost/db/queries/chats";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type ModelMessage,
  stepCountIs,
  streamText,
  type UIMessage,
  type UserModelMessage,
} from "ai";
import { z } from "zod";
import { systemPrompt } from "@/lib/prompts/system";
import { config, provider } from "@/lib/providers";
import { getResumableStreamContext } from "@/lib/resume-stream";
import { generateTitleFromUserMessage } from "@/lib/title";
import { toolSet } from "@/lib/tools";

const postBodySchema = z.object({
  id: z.string().min(1),
  message: z.any().optional(),
  messages: z.array(z.any()).optional(),
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value;
}

function sanitizeToolImageMessages(messages: ModelMessage[]): ModelMessage[] {
  const sanitized: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role !== "tool") {
      sanitized.push(message);
      continue;
    }

    const mutable = structuredClone(message) as {
      content: Record<string, unknown>[];
      role: "tool";
    };
    const extractedImages: string[] = [];
    for (const contentPart of mutable.content) {
      const part = asRecord(contentPart);
      if (!part) {
        continue;
      }

      const output = asRecord(part?.output);
      const snapshot = asString(output?.snapshot);

      if (snapshot?.startsWith("data:image/")) {
        extractedImages.push(snapshot);
        part.output = { type: "text", value: "[Snapshot attached as image]" };
        continue;
      }

      const outputType = asString(output?.type);
      const outputValue = output?.value;
      if (outputType !== "content" || !Array.isArray(outputValue)) {
        continue;
      }

      const medias = outputValue.map((entry) => asRecord(entry));
      const mediaImages = medias
        .filter((media) => asString(media?.type) === "media")
        .map((media) => asString(media?.data))
        .filter((data): data is string => Boolean(data));

      if (mediaImages.length === 0) {
        continue;
      }

      extractedImages.push(...mediaImages);
      part.output = { type: "text", value: "[Image sent]" };
    }

    sanitized.push(mutable as unknown as ModelMessage);

    for (const image of extractedImages) {
      const imageMessage: UserModelMessage = {
        role: "user",
        content: [{ type: "image", image }],
      };
      sanitized.push(imageMessage);
    }
  }

  return sanitized;
}

export async function postChat(request: Request): Promise<Response> {
  const raw = await request.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(raw);

  if (!parsed.success) {
    return Response.json(
      { ok: false, data: null, error: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, message, messages: requestedMessages } = parsed.data;

  const chat = await readChat(id);
  const persisted = (chat.messages ?? []) as UIMessage[];
  const incomingMessage = message as UIMessage | undefined;
  let messages = persisted;
  if (requestedMessages) {
    messages = requestedMessages as UIMessage[];
  } else if (incomingMessage) {
    messages = [...persisted, incomingMessage];
  }

  const shouldGenerateTitle =
    chat.title === "New chat" && incomingMessage?.role === "user";
  const titlePromise = shouldGenerateTitle
    ? generateTitleFromUserMessage(incomingMessage)
    : null;

  await saveChat({
    id,
    activeStreamId: null,
    messages,
    status: "running",
  });

  const stream = createUIMessageStream({
    originalMessages: requestedMessages ? messages : undefined,
    execute: async ({ writer }) => {
      const result = streamText({
        model: provider.languageModel("chat-model"),
        system: systemPrompt(),
        messages: await convertToModelMessages(messages),
        tools: toolSet,
        stopWhen: stepCountIs(config.ai.maxSteps),
        prepareStep: ({ messages: modelMessages }) => {
          return {
            messages: sanitizeToolImageMessages(
              modelMessages as ModelMessage[]
            ),
          };
        },
      });

      writer.merge(result.toUIMessageStream({ sendReasoning: true }));
      if (titlePromise) {
        const title = await titlePromise;
        await saveChat({ id, title });
        writer.write({ type: "data-chat-title", data: title });
      }
    },
    generateId,
    onFinish: async ({ messages: finishedMessages }) => {
      await saveChat({
        id,
        activeStreamId: null,
        messages: finishedMessages,
        status: "completed",
      });
    },
    onError: () => "Stream failed",
  });

  return createUIMessageStreamResponse({
    stream,
    async consumeSseStream({ stream: sseStream }) {
      const streamContext = getResumableStreamContext();
      if (!streamContext) {
        return;
      }

      const streamId = generateId();
      await saveChat({ id, activeStreamId: streamId });
      await streamContext.createNewResumableStream(streamId, () => sseStream);
    },
  });
}
