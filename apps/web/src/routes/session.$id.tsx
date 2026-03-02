// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import { Bot, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool } from "@/components/tool";
import { Card } from "@/components/ui/card";
import { asRecord, asString } from "@/lib/utils";

interface ChatRecord {
  messages?: UIMessage[];
}

interface ChatResponse {
  data?: ChatRecord;
}

interface HealthResponse {
  data?: {
    hub?: {
      error?: string | null;
      ok?: boolean;
    };
  };
}

export const Route = createFileRoute("/session/$id")({
  loader: async ({ params }) => {
    const response = await fetch(`/api/v1/chat/${params.id}`).catch(() => null);
    if (!response?.ok) {
      return { messages: [] as UIMessage[] };
    }

    const payload = (await response.json()) as ChatResponse;
    const data = payload.data;
    return {
      messages: data?.messages ?? [],
    };
  },
  component: SessionPage,
});

function stateLabel(status: string): string {
  if (status === "streaming" || status === "submitted") {
    return "running";
  }

  if (status === "error") {
    return "stopped";
  }

  return "ready";
}

function SessionPage() {
  const { id } = Route.useParams();
  const chat = Route.useLoaderData();
  const [hubOk, setHubOk] = useState<boolean | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);

  const initialMessages = useMemo(() => chat.messages ?? [], [chat.messages]);

  const { messages, sendMessage, status } = useChat({
    id,
    messages: initialMessages,
    generateId,
    resume: true,
    transport: new DefaultChatTransport({
      api: "/api/v1/chat",
      prepareSendMessagesRequest: ({
        id: chatId,
        messages: currentMessages,
      }) => {
        const lastMessage = currentMessages.at(-1);

        return {
          body: {
            id: chatId,
            message: lastMessage,
          },
        };
      },
      prepareReconnectToStreamRequest: ({ id: chatId }) => ({
        api: `/api/v1/chat/${chatId}/stream`,
      }),
    }),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toolEvents = useMemo(
    () =>
      messages.flatMap((message) =>
        message.parts.flatMap((part, partIndex) => {
          const payload = asRecord(part);
          const type = asString(payload?.type);
          if (!type?.startsWith("tool-")) {
            return [];
          }

          return [
            {
              input: payload?.input,
              output: payload?.output,
              state: asString(payload?.state) ?? undefined,
              toolCallId:
                asString(payload?.toolCallId) ?? `${message.id}-${partIndex}`,
              toolName: type.replace("tool-", ""),
            },
          ];
        })
      ),
    [messages]
  );

  useEffect(() => {
    const loadHubHealth = async () => {
      const response = await fetch("/api/v1/health").catch(() => null);
      if (!response?.ok) {
        setHubOk(false);
        setHubError("health_request_failed");
        return;
      }

      const payload = (await response.json()) as HealthResponse;
      const hub = payload.data?.hub;
      setHubOk(Boolean(hub?.ok));
      setHubError(hub?.error ?? null);
    };

    loadHubHealth();
    const interval = setInterval(loadHubHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = status === "streaming" || status === "submitted";
  const hubStatusLabel = (() => {
    if (hubOk === null) {
      return "checking";
    }

    if (hubOk) {
      return "online";
    }

    return "offline";
  })();
  const hubStatusClass = (() => {
    if (hubOk === null) {
      return "text-muted-foreground";
    }
    return hubOk ? "text-emerald-500" : "text-destructive";
  })();

  const submitPrompt = ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    sendMessage({ text: trimmed });
  };

  return (
    <main className="grid h-full min-h-0 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
        <Card className="min-h-0 overflow-hidden border p-0">
          <Conversation>
            <ConversationContent className="px-3 py-3">
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
                  description="Send your first message to start the chat."
                  title="No messages yet"
                />
              )}
              {isRunning ? <Shimmer className="mt-3 h-12 w-full" /> : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </Card>

        <PromptInput onSubmit={submitPrompt}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Type a message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </section>

      <aside className="flex h-full min-h-0 flex-col gap-3">
        <Card className="min-h-0 flex-1 border p-3">
          <p className="mb-3 font-medium text-sm">System Status</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="size-4" />
                Chat
              </dt>
              <dd className="capitalize">{stateLabel(status)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Bot className="size-4" />
                Hub
              </dt>
              <dd className={hubStatusClass}>{hubStatusLabel}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Tool Calls</dt>
              <dd>{toolEvents.length}</dd>
            </div>
            {hubError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive text-xs">
                {hubError}
              </div>
            ) : null}
          </dl>
        </Card>
      </aside>
    </main>
  );
}
