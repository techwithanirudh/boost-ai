import { config } from "@boost/config";
import { readChat, saveChat } from "@boost/db/queries/chats";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  hasToolCall,
  pruneMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { systemPrompt } from "@/lib/prompts/system";
import { provider } from "@/lib/providers";
import { getResumableStreamContext } from "@/lib/resume-stream";
import { generateTitleFromUserMessage } from "@/lib/title";
import { toolSet } from "@/lib/tools";

const log = createLogger("chat");

const postBodySchema = z.object({
  id: z.string().min(1),
  message: z.unknown().optional(),
  messages: z.array(z.unknown()).optional(),
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

  // Track whether onError fired so onFinish doesn't overwrite the error status
  let streamErrored = false;

  const stream = createUIMessageStream({
    originalMessages: messages,
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
        prepareStep: ({ messages: stepMessages }) => ({
          messages: pruneMessages({
            messages: stepMessages,
            toolCalls: "before-last-2-messages",
          }),
        }),
      });

      writer.merge(result.toUIMessageStream({ sendReasoning: true }));

      // Fire title generation after stream content is written, non-blocking
      if (titlePromise) {
        titlePromise.then(async (title) => {
          if (title) {
            try {
              await saveChat({ id, title });
              writer.write({ type: "data-chat-title", data: title });
            } catch (err) {
              log.warn({ err, id }, "Failed to save title");
            }
          }
        });
      }
    },
    generateId,
    onFinish: async ({ messages: finishedMessages, isAborted }) => {
      if (streamErrored) {
        return;
      }
      // If stream was aborted or hit the step limit without a stop/complete
      // tool call, mark as stopped rather than completed
      const finalStatus = isAborted ? "stopped" : "completed";
      try {
        await saveChat({
          id,
          activeStreamId: null,
          messages: finishedMessages,
          status: finalStatus,
        });
      } catch (err) {
        log.error({ err, id }, "Failed to save chat on finish");
      }
    },
    onError: (err) => {
      streamErrored = true;
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
