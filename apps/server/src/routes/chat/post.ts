import { config } from "@boost/config";
import { readChat, saveChat } from "@boost/db/queries/chats";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  hasToolCall,
  Output,
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
  const titlePromise: Promise<string | null> | null = shouldGenerateTitle
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
    originalMessages: messages,
    execute: async ({ writer }) => {
      const result = streamText({
        model: provider.languageModel("chat-model"),
        system: systemPrompt(),
        messages: await convertToModelMessages(messages, { tools: toolSet }),
        tools: toolSet,
        toolChoice: "required",
        providerOptions: {
          openai: {
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
        experimental_repairToolCall: async ({
          toolCall,
          tools,
          inputSchema,
          system,
          messages,
        }) => {
          const tool = tools[toolCall.toolName as keyof typeof tools];
          if (!tool) {
            return null;
          }

          const schema = await inputSchema({ toolName: toolCall.toolName });

          const { output: repairedArgs } = await generateText({
            model: provider.languageModel("chat-model"),
            output: Output.object({
              schema,
            }),
            system,
            messages: [
              ...messages,
              {
                role: "assistant",
                content: [
                  {
                    type: "tool-call",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  },
                ],
              },
            ],
          });

          return { ...toolCall, input: JSON.stringify(repairedArgs) };
        },
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

      writer.merge(result.toUIMessageStream());

      const title = await titlePromise;
      if (title) {
        writer.write({ type: "data-chat-title", data: title });
        saveChat({ id, title }).catch((err) =>
          log.warn({ err, id }, "Failed to save title")
        );
      }
    },
    generateId,
    onFinish: async ({ messages: finishedMessages, isAborted }) => {
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
      log.error({ err, id }, "Stream error");
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
