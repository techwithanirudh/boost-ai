import { readChat, saveChat } from "@boost/db/queries/chats";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { systemPrompt } from "@/lib/prompts/system";
import { config, provider } from "@/lib/providers";
import { getResumableStreamContext } from "@/lib/resume-stream";
import { toolSet } from "@/lib/tools";

const postBodySchema = z.object({
  id: z.string().min(1),
  message: z.any().optional(),
  goal: z.string().optional(),
});

export async function postChat(request: Request): Promise<Response> {
  const raw = await request.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(raw);

  if (!parsed.success) {
    return Response.json(
      { ok: false, data: null, error: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, goal, message } = parsed.data;

  const chat = await readChat(id);
  const persisted = (chat.messages ?? []) as UIMessage[];
  const incomingMessage = message as UIMessage | undefined;

  const messages = incomingMessage
    ? [...persisted, incomingMessage]
    : persisted;

  await saveChat({
    id,
    activeStreamId: null,
    canceledAt: null,
    goal: goal ?? chat.goal,
    messages,
    status: "running",
  });

  const userStopSignal = new AbortController();
  let lastCancelCheck = 0;

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const result = streamText({
        model: provider.languageModel("chat-model"),
        system: systemPrompt(goal ?? chat.goal),
        messages: await convertToModelMessages(messages),
        tools: toolSet,
        stopWhen: stepCountIs(config.ai.maxSteps),
        abortSignal: userStopSignal.signal,
        onChunk: async () => {
          const now = Date.now();
          if (now - lastCancelCheck < 1000) {
            return;
          }

          lastCancelCheck = now;
          const latest = await readChat(id);
          if (latest.canceledAt) {
            userStopSignal.abort("user_stop");
          }
        },
        onAbort: async () => {
          await saveChat({ id, activeStreamId: null, status: "stopped" });
        },
      });

      writer.merge(result.toUIMessageStream({ sendReasoning: true }));
    },
    generateId,
    onFinish: async ({ messages: finishedMessages }) => {
      await saveChat({
        id,
        activeStreamId: null,
        canceledAt: null,
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
