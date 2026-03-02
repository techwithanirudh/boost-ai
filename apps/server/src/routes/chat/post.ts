import { readChat, saveChat } from "@boost/db/queries/chats";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  hasToolCall,
  type ModelMessage,
  stepCountIs,
  streamText,
  type UIMessage,
  type UserModelMessage,
} from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { systemPrompt } from "@/lib/prompts/system";
import { config, provider } from "@/lib/providers";
import { getResumableStreamContext } from "@/lib/resume-stream";
import { generateTitleFromUserMessage } from "@/lib/title";
import { toolSet } from "@/lib/tools";
import { fetchFrame } from "@/services/frame";

const log = createLogger("chat");

const postBodySchema = z.object({
  id: z.string().min(1),
  message: z.unknown().optional(),
  messages: z.array(z.unknown()).optional(),
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
      if (!output) {
        continue;
      }

      // AI SDK v6 wraps tool JSON output as { type: "json", value: { ...raw } }.
      // The snapshot field lives in the `value` wrapper. Fall back to top-level
      // for any legacy / direct formats.
      const rawValue = asRecord(output.value) ?? output;
      const snapshot = asString(rawValue?.snapshot);

      if (!snapshot?.startsWith("data:image/")) {
        continue;
      }

      extractedImages.push(snapshot);

      part.output = {
        type: "text",
        value: "[Camera snapshot attached as image above]",
      };
    }

    sanitized.push(mutable as unknown as ModelMessage);

    for (const snapshot of extractedImages) {
      const imageMessage: UserModelMessage = {
        role: "user",
        content: [{ type: "image", image: snapshot }],
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

  let chat: Awaited<ReturnType<typeof readChat>>;
  try {
    chat = await readChat(id);
  } catch (err) {
    log.error({ err, id }, "Failed to read chat");
    return Response.json(
      { ok: false, data: null, error: "Internal server error" },
      { status: 500 }
    );
  }

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
    ? generateTitleFromUserMessage(incomingMessage).catch((err) => {
        log.warn({ err, id }, "Title generation failed");
        return null;
      })
    : null;

  try {
    await saveChat({
      id,
      activeStreamId: null,
      messages,
      status: "running",
    });
  } catch (err) {
    log.error({ err, id }, "Failed to save chat before streaming");
    return Response.json(
      { ok: false, data: null, error: "Internal server error" },
      { status: 500 }
    );
  }

  const stream = createUIMessageStream({
    originalMessages: requestedMessages ? messages : undefined,
    execute: async ({ writer }) => {
      const result = streamText({
        model: provider.languageModel("chat-model"),
        system: systemPrompt(),
        messages: await convertToModelMessages(messages, { tools: toolSet }),
        tools: toolSet,
        toolChoice: "required",
        stopWhen: [
          hasToolCall("complete"),
          hasToolCall("stop"),
          stepCountIs(config.ai.maxSteps),
        ],
        prepareStep: async ({ messages: modelMessages }) => {
          const sanitized = sanitizeToolImageMessages(
            modelMessages as ModelMessage[]
          );
          try {
            const frame = await fetchFrame();
            const cameraMessage: UserModelMessage = {
              role: "user",
              content: [
                { type: "image", image: frame.buffer },
                {
                  type: "text",
                  text: "Current camera frame. Observe carefully before deciding your next action.",
                },
              ],
            };
            return { messages: [...sanitized, cameraMessage] };
          } catch {
            return { messages: sanitized };
          }
        },
      });

      writer.merge(result.toUIMessageStream({ sendReasoning: true }));
      if (titlePromise) {
        const title = await titlePromise;
        if (title) {
          await saveChat({ id, title });
          writer.write({ type: "data-chat-title", data: title });
        }
      }
    },
    generateId,
    onFinish: async ({ messages: finishedMessages }) => {
      try {
        await saveChat({
          id,
          activeStreamId: null,
          messages: finishedMessages,
          status: "completed",
        });
      } catch (err) {
        log.error({ err, id }, "Failed to save chat on finish");
      }
    },
    onError: (err) => {
      log.error({ err, id }, "Stream error");
      saveChat({ id, activeStreamId: null, status: "stopped" }).catch(
        (saveErr) =>
          log.error({ err: saveErr, id }, "Failed to save chat on error")
      );
      return "Stream failed";
    },
  });

  return createUIMessageStreamResponse({
    stream,
    async consumeSseStream({ stream: sseStream }) {
      const streamContext = getResumableStreamContext();
      if (!streamContext) {
        return;
      }

      const streamId = generateId();
      try {
        await saveChat({ id, activeStreamId: streamId });
        await streamContext.createNewResumableStream(streamId, () => sseStream);
      } catch (err) {
        log.error({ err, id, streamId }, "Failed to register resumable stream");
      }
    },
  });
}
