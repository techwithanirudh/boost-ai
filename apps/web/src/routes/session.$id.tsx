// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
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
  message: z.string().optional(),
});

export const Route = createFileRoute("/session/$id")({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const response = await fetch(`/api/v1/chat/${params.id}`).catch(() => null);
    if (!response?.ok) {
      return { messages: [] as UIMessage[], title: "Session" };
    }
    const payload = (await response.json()) as ChatResponse;
    return {
      messages: payload.data?.messages ?? [],
      title: payload.data?.title ?? "Session",
    };
  },
  component: SessionPage,
});

// Stable transport defined at module level to avoid recreation on re-renders
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
  const { message: initialGoal } = Route.useSearch();
  const chat = Route.useLoaderData();
  const hasSentInitial = useRef(false);

  const initialMessages = useMemo(() => chat.messages ?? [], [chat.messages]);

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

  // Auto-send the goal passed from the home page
  useEffect(() => {
    if (
      initialGoal &&
      !hasSentInitial.current &&
      messages.length === 0 &&
      status === "ready"
    ) {
      hasSentInitial.current = true;
      sendMessage({ text: initialGoal });
    }
  }, [initialGoal, messages.length, status, sendMessage]);

  const toolCallCount = useMemo(
    () =>
      messages.reduce(
        (count, message) =>
          count +
          message.parts.filter((p) => {
            const type = asString(asRecord(p)?.type);
            return type?.startsWith("tool-") ?? false;
          }).length,
        0
      ),
    [messages]
  );

  const isRunning = status === "streaming" || status === "submitted";

  const submitPrompt = ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    sendMessage({ text: trimmed });
  };

  return (
    <main className="grid h-full min-h-0 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_300px]">
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
                  description="Send a task and the robot will start moving."
                  title="Robot ready"
                />
              )}
              {isRunning ? <Shimmer className="mt-3 h-12 w-full" /> : null}
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
        <Card className="border p-3">
          <p className="mb-2 font-medium text-sm">Camera</p>
          <CameraFeed />
        </Card>

        <StatusPanel
          chatStatus={status}
          isRunning={isRunning}
          onStop={stop}
          toolCallCount={toolCallCount}
        />
      </aside>
    </main>
  );
}
