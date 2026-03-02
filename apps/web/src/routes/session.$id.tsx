// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { CameraFeed } from "@/components/session/camera-feed";
import { StatusPanel } from "@/components/session/status-panel";
import { Tool } from "@/components/tool";
import { Card } from "@/components/ui/card";
import { asRecord, asString } from "@/lib/utils";

interface ChatRecord {
  messages?: UIMessage[];
  title?: string;
}

interface ChatResponse {
  data?: ChatRecord;
}

const searchSchema = z.object({
  task: z.string().optional(),
});

export const Route = createFileRoute("/session/$id")({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const response = await fetch(`/api/v1/chat/${params.id}`).catch(() => null);
    if (!response) {
      throw new Error("Network error — could not reach the server");
    }
    if (response.status === 404) {
      return { messages: [], title: null };
    }
    if (!response.ok) {
      throw new Error(`Server error (${response.status})`);
    }
    const payload = (await response.json()) as ChatResponse;
    return {
      messages: payload.data?.messages ?? [],
      title: payload.data?.title ?? null,
    };
  },
  component: SessionPage,
});

const transport = new DefaultChatTransport({
  api: "/api/v1/chat",
  prepareSendMessagesRequest: ({ id: chatId, messages: current }) => ({
    body: { id: chatId, message: current.at(-1) },
  }),
  prepareReconnectToStreamRequest: ({ id: chatId }) => ({
    api: `/api/v1/chat/${chatId}/stream`,
  }),
});

function SessionPage() {
  const { id } = Route.useParams();
  const { task: initialTask } = Route.useSearch();
  const { messages: initialMessages, title } = Route.useLoaderData();
  const pendingTask = useRef(initialTask ?? null);

  const { messages, sendMessage, status, stop } = useChat({
    id,
    messages: initialMessages,
    generateId,
    resume: true,
    transport,
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const navigate = Route.useNavigate();

  useEffect(() => {
    if (status === "ready" && pendingTask.current) {
      const task = pendingTask.current;
      pendingTask.current = null;
      sendMessage({ text: task });
      navigate({ search: {}, replace: true });
    }
  }, [status, sendMessage, navigate]);

  const isRunning = status === "streaming" || status === "submitted";
  const displayTitle = title && title !== "New chat" ? title : null;

  const submitPrompt = ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    sendMessage({ text: trimmed });
  };

  return (
    <main className="mx-auto grid h-full min-h-0 w-full max-w-5xl gap-3 p-3 md:grid-cols-[minmax(0,1fr)_280px]">
      <section className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
        <Card className="min-h-0 gap-0 overflow-hidden border p-0">
          {displayTitle ? (
            <div className="border-b px-3 py-2">
              <p className="truncate font-medium text-sm">{displayTitle}</p>
            </div>
          ) : null}
          <Conversation>
            <ConversationContent className="px-3 py-7">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, partIndex) => {
                        const payload = asRecord(part);
                        const type = asString(payload?.type);

                        if (type === "text") {
                          return (
                            <MessageResponse
                              key={`${message.id}-text-${partIndex}`}
                            >
                              {asString(payload?.text) ?? ""}
                            </MessageResponse>
                          );
                        }

                        if (!type?.startsWith("tool-")) {
                          return null;
                        }

                        return (
                          <Tool
                            key={`${message.id}-tool-${partIndex}`}
                            tool={{
                              input: payload?.input,
                              output: payload?.output,
                              state: asString(payload?.state) ?? undefined,
                              toolCallId:
                                asString(payload?.toolCallId) ??
                                `${message.id}-${partIndex}`,
                              toolName: type.replace("tool-", ""),
                            }}
                          />
                        );
                      })}
                    </MessageContent>
                  </Message>
                ))
              ) : (
                <ConversationEmptyState
                  description="Send a task and the robot will start moving."
                  title="Robot ready"
                />
              )}
              {isRunning ? (
                <div className="mt-3 flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40" />
                </div>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </Card>

        <PromptInput onSubmit={submitPrompt}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Give the robot a task…" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </section>

      <aside className="flex min-h-0 flex-col gap-3">
        <Card className="gap-0 overflow-hidden border p-0">
          <div className="border-b px-3 py-2">
            <p className="font-medium text-sm">Camera</p>
          </div>
          <div className="p-3">
            <CameraFeed />
          </div>
        </Card>

        <StatusPanel chatStatus={status} isRunning={isRunning} onStop={stop} />
      </aside>
    </main>
  );
}
