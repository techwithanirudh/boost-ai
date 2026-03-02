// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Activity, Camera, ChevronLeft, ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { ModeToggle } from "@/components/mode-toggle";
import { Tool } from "@/components/tool";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { asRecord, asString, formatUptime } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const Route = createFileRoute("/session/$id")({
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    goal: typeof search.goal === "string" ? search.goal : "",
  }),
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

function statusDotClass(status: string): string {
  if (status === "streaming" || status === "submitted") {
    return "bg-emerald-500";
  }

  if (status === "error") {
    return "bg-destructive";
  }

  return "bg-muted-foreground";
}

function SessionPage() {
  const { id } = Route.useParams();
  const { goal: initialGoal } = Route.useSearch();

  const [uptime, setUptime] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [sentInitialGoal, setSentInitialGoal] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const { messages, sendMessage, status, stop } = useChat({
    id,
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
            goal: initialGoal,
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

  const toolSnapshots = useMemo(
    () =>
      toolEvents
        .map((tool) => {
          const output = asRecord(tool.output);
          return asString(output?.snapshot);
        })
        .filter((snapshot): snapshot is string => Boolean(snapshot)),
    [toolEvents]
  );

  const latestSnapshot =
    toolSnapshots.at(-1) ?? `${API_URL}/v1/snapshot?t=${Date.now()}`;

  useEffect(() => {
    if (!(status === "streaming" || status === "submitted")) {
      return;
    }

    startTimeRef.current = Date.now();
    setUptime(0);

    const timerId = setInterval(() => {
      if (startTimeRef.current !== null) {
        setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [status]);

  useEffect(() => {
    if (!initialGoal || sentInitialGoal || messages.length > 0) {
      return;
    }

    setSentInitialGoal(true);
    sendMessage({ text: initialGoal });
  }, [initialGoal, messages.length, sendMessage, sentInitialGoal]);

  const isRunning = status === "streaming" || status === "submitted";

  const emergencyStop = async () => {
    stop();

    const res = await fetch(`/api/v1/chat/${id}/stop`, {
      method: "POST",
    }).catch(() => null);

    if (!res?.ok) {
      toast.error("Emergency stop failed");
      return;
    }

    toast.warning("Emergency stop sent");
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed) {
      return;
    }

    sendMessage({ text: trimmed });
    setPromptText("");
  };

  const title = initialGoal?.trim() || "Robot Chat";

  return (
    <main className="grid h-full min-h-0 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <Card className="flex items-center gap-3 border p-3">
          <Link
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            to="/"
          >
            <ChevronLeft className="size-3.5" />
            Home
          </Link>

          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{title}</p>
            <p className="text-muted-foreground text-xs">Chat Pane</p>
          </div>

          <span
            className={`ml-auto inline-block size-2.5 rounded-full ${statusDotClass(status)}`}
          />

          <Button
            onClick={emergencyStop}
            size="sm"
            type="button"
            variant="destructive"
          >
            Stop Session
          </Button>

          <ModeToggle />
        </Card>

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
                  description="Send your first goal to start tool-driven robot chat."
                  title="No messages yet"
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </Card>

        <Card className="border p-2">
          <form className="space-y-2" onSubmit={submitPrompt}>
            <Textarea
              onChange={(event) => setPromptText(event.target.value)}
              placeholder="Add new goal / follow-up"
              rows={3}
              value={promptText}
            />
            <div className="flex items-center justify-between">
              <Button
                disabled={!isRunning}
                onClick={emergencyStop}
                type="button"
                variant="destructive"
              >
                Stop
              </Button>
              <Button disabled={!promptText.trim()} type="submit">
                Send
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <aside className="flex min-h-0 flex-col gap-3">
        <Card className="border p-3">
          <p className="mb-3 font-medium text-sm">Diagnostics</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Activity className="size-4" />
                Uptime
              </dt>
              <dd>{formatUptime(uptime)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="size-4" />
                Status
              </dt>
              <dd className="capitalize">{stateLabel(status)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Camera className="size-4" />
                Frames
              </dt>
              <dd>{toolSnapshots.length}</dd>
            </div>
          </dl>
        </Card>

        <Card className="overflow-hidden border p-0">
          {/* biome-ignore lint/correctness/useImageSize: dynamic stream frame size */}
          <img
            alt="Latest session snapshot"
            className="h-52 w-full object-contain"
            src={latestSnapshot}
          />
        </Card>

        <Card className="min-h-0 flex-1 overflow-y-auto border p-3">
          <p className="mb-3 font-medium text-sm">Recent Frames</p>
          <div className="space-y-2">
            {toolSnapshots.length > 0 ? (
              toolSnapshots
                .slice(-8)
                .reverse()
                .map((frame) => (
                  // biome-ignore lint/correctness/useImageSize: dynamic stream frame size
                  <img
                    alt="Recent frame"
                    className="w-full rounded-lg border object-contain"
                    key={frame}
                    src={frame}
                  />
                ))
            ) : (
              <p className="text-muted-foreground text-sm">No frames yet.</p>
            )}
          </div>
        </Card>
      </aside>
    </main>
  );
}
