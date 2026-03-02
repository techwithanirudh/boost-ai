// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import {
  Activity,
  Bot,
  Camera,
  Clock3,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Tool, type ToolRenderModel } from "@/components/tool";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function toolFromPart(
  part: unknown,
  fallbackId: string
): ToolRenderModel | null {
  const payload = asRecord(part);
  const type = asString(payload?.type);
  if (!type?.startsWith("tool-")) {
    return null;
  }

  const toolName = type.replace("tool-", "");
  return {
    toolName,
    toolCallId: asString(payload?.toolCallId) ?? fallbackId,
    input: payload?.input,
    output: payload?.output,
    state: asString(payload?.state) ?? undefined,
  };
}

function SessionPage() {
  const { id } = Route.useParams();
  const { goal: initialGoal } = Route.useSearch();

  const [followUp, setFollowUp] = useState("");
  const [uptime, setUptime] = useState(0);
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
      prepareReconnectToStreamRequest: ({ id: chatId }) => {
        return {
          api: `/api/v1/chat/${chatId}/stream`,
        };
      },
    }),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toolEvents = useMemo(
    () =>
      messages.flatMap((message, messageIndex) =>
        message.parts
          .map((part, partIndex) =>
            toolFromPart(part, `${message.id}-${messageIndex}-${partIndex}`)
          )
          .filter((part): part is ToolRenderModel => part !== null)
      ),
    [messages]
  );

  const toolSnapshots = useMemo(
    () =>
      toolEvents
        .map((tool) => {
          const output = asRecord(tool.output);
          const snapshot = asString(output?.snapshot);
          return snapshot;
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

  const sendFollowUp = () => {
    const trimmed = followUp.trim();
    if (!trimmed) {
      return;
    }

    setFollowUp("");
    sendMessage({ text: trimmed });
  };

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

  return (
    <main className="grid h-full min-h-0 grid-rows-[1fr_auto] gap-3 p-3 md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-[1fr]">
      <section className="flex min-h-0 flex-col gap-3">
        <Card className="flex items-center gap-3 border p-3">
          <span
            className={`inline-block size-2.5 rounded-full ${statusDotClass(status)}`}
          />
          <p className="font-semibold text-sm">Session {id.slice(0, 8)}</p>
          <span className="text-muted-foreground text-xs">
            {stateLabel(status)}
          </span>
          <span className="ml-auto text-muted-foreground text-xs">
            {formatUptime(uptime)}
          </span>
          <Button onClick={emergencyStop} size="sm" variant="destructive">
            STOP
          </Button>
        </Card>

        <Card className="overflow-hidden border p-0">
          {/* biome-ignore lint/correctness/useImageSize: dynamic stream frame size */}
          <img
            alt="Latest session snapshot"
            className="h-64 w-full object-contain md:h-80"
            src={latestSnapshot}
          />
        </Card>

        <Card className="min-h-0 flex-1 overflow-y-auto border p-3">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <p className="font-medium text-sm">Chat + Tool History</p>
          </div>

          <div className="space-y-3">
            {messages.length > 0 ? (
              messages.map((message) => (
                <article
                  className="rounded-xl border bg-card p-3"
                  key={message.id}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                      {message.role === "assistant" ? (
                        <Bot className="size-3.5" />
                      ) : (
                        <MessageSquare className="size-3.5" />
                      )}
                    </span>
                    <p className="font-medium text-sm capitalize">
                      {message.role}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {message.parts.map((part, partIndex) => {
                      const data = asRecord(part);
                      const type = asString(data?.type);

                      if (type === "text") {
                        return (
                          <p
                            className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-2 text-sm"
                            key={`${message.id}-text-${partIndex}`}
                          >
                            {asString(data?.text) ?? ""}
                          </p>
                        );
                      }

                      const tool = toolFromPart(
                        part,
                        `${message.id}-tool-${partIndex}`
                      );

                      if (!tool) {
                        return null;
                      }

                      return <Tool key={tool.toolCallId} tool={tool} />;
                    })}
                  </div>
                </article>
              ))
            ) : (
              <article className="rounded-xl border bg-muted/20 p-3 text-muted-foreground text-sm">
                No messages yet.
              </article>
            )}
          </div>
        </Card>
      </section>

      <aside className="flex min-h-0 flex-col gap-3">
        <Card className="border p-3">
          <p className="mb-3 font-medium text-sm">System</p>
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
                Boost status
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

        <Card className="border p-3">
          <label
            className="mb-2 flex items-center gap-2 font-medium text-sm"
            htmlFor="goal-input"
          >
            <Clock3 className="size-4 text-muted-foreground" />
            New Goal
          </label>
          <div className="flex gap-2">
            <Input
              className="bg-background"
              disabled={isRunning}
              id="goal-input"
              onChange={(event) => setFollowUp(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendFollowUp()}
              placeholder="Enter next task"
              value={followUp}
            />
            <Button
              disabled={isRunning || !followUp.trim()}
              onClick={sendFollowUp}
            >
              Run
            </Button>
          </div>
        </Card>
      </aside>
    </main>
  );
}
