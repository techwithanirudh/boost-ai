// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { api, type SessionResult, type SessionStatus } from "@/lib/api";

interface UiMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

const MEDIAMTX_URL =
  import.meta.env.VITE_MEDIAMTX_URL ?? "http://localhost:8889";

export const Route = createFileRoute("/session/$id")({
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    goal: typeof search.goal === "string" ? search.goal : "",
  }),
});

function SessionPage() {
  const { id } = Route.useParams();
  const { goal: initialGoal } = Route.useSearch();
  const [status, setStatus] = useState<SessionStatus>("running");
  const [followUp, setFollowUp] = useState("");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const bootstrappedRef = useRef(false);

  const streamUrl = useMemo(() => `${MEDIAMTX_URL}/live/stream`, []);

  const runGoal = useCallback(
    async (goal: string) => {
      const trimmed = goal.trim();
      if (!trimmed || isStreamingRef.current) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      isStreamingRef.current = true;
      setIsStreaming(true);
      setStatus("running");
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

      try {
        await api.streamSession(trimmed, {
          id,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "session_result") {
              setResult({
                sessionId: event.sessionId,
                status: event.status,
                steps: event.steps,
                text: event.text,
              });
              setStatus(event.status);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", text: event.text || "(no text output)" },
              ]);
            }

            if (event.type === "session_error") {
              setStatus("stopped");
              setMessages((prev) => [
                ...prev,
                { role: "system", text: event.error },
              ]);
              toast.error(event.error);
            }

            if (event.type === "session_complete") {
              setStatus(event.status);
            }
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [...prev, { role: "system", text: message }]);
        toast.error(message);
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (!initialGoal || bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;
    runGoal(initialGoal).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    });
    return () => {
      abortRef.current?.abort();
    };
  }, [initialGoal, runGoal]);

  const emergencyStop = async () => {
    const res = await api.stopSession(id).catch(() => null);
    if (!res?.ok) {
      toast.error("Emergency stop failed");
      return;
    }
    setStatus("stopped");
    abortRef.current?.abort();
    toast.warning("Emergency stop sent");
  };

  const sendFollowUp = () => {
    const trimmed = followUp.trim();
    if (!trimmed) {
      return;
    }
    setFollowUp("");
    runGoal(trimmed).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    });
  };

  return (
    <main className="h-full min-h-0 p-3">
      <ResizablePanelGroup
        className="h-full overflow-hidden rounded-lg border bg-background"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize="64%">
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-2 text-muted-foreground text-xs uppercase tracking-wider">
              Stream
            </div>
            <iframe
              allow="autoplay"
              className="h-full w-full border-0 bg-black"
              src={streamUrl}
              title="Live camera feed"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="36%">
          <ResizablePanelGroup className="h-full" orientation="vertical">
            <ResizablePanel defaultSize="72%">
              <div className="flex h-full flex-col">
                <div className="border-b px-4 py-2 text-muted-foreground text-xs uppercase tracking-wider">
                  Session {id.slice(0, 8)}... · {status}
                </div>
                <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
                  {messages.map((message, index) => (
                    <div
                      className="rounded border bg-card px-3 py-2"
                      key={`${message.role}-${index}`}
                    >
                      <div className="mb-1 text-[11px] text-zinc-500 uppercase tracking-wider">
                        {message.role}
                      </div>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="28%">
              <div className="flex h-full flex-col gap-3 p-4">
                <Input
                  disabled={isStreaming}
                  onChange={(event) => setFollowUp(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && sendFollowUp()}
                  placeholder="Send follow-up goal..."
                  value={followUp}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={isStreaming || !followUp.trim()}
                    onClick={sendFollowUp}
                  >
                    {isStreaming ? "Running..." : "Send"}
                  </Button>
                  <Button onClick={emergencyStop} variant="destructive">
                    Stop
                  </Button>
                </div>
                {result && (
                  <div className="rounded border bg-muted/40 px-3 py-2 text-xs">
                    Last run: {result.steps} step{result.steps === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
