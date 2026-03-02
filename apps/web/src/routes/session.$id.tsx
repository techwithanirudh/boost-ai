// biome-ignore lint/style/useFilenamingConvention: TanStack file routes require `$param` segments.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type SessionStatus, type StepEvent } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const Route = createFileRoute("/session/$id")({
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    goal: typeof search.goal === "string" ? search.goal : "",
  }),
});

function formatUptime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusColor(status: SessionStatus): string {
  if (status === "running") {
    return "text-green-400";
  }
  if (status === "stopped") {
    return "text-red-400";
  }
  return "text-zinc-400";
}

function statusDdColor(status: SessionStatus): string {
  if (status === "running") {
    return "text-green-400";
  }
  if (status === "stopped") {
    return "text-red-400";
  }
  return "text-zinc-300";
}

function dotColor(isStreaming: boolean, status: SessionStatus): string {
  if (isStreaming) {
    return "animate-pulse bg-green-400";
  }
  if (status === "stopped") {
    return "bg-red-400";
  }
  return "bg-zinc-500";
}

const TILE_SLOTS = [0, 1, 2, 3, 4, 5] as const;

function FilmStrip({ snapshots }: { snapshots: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {TILE_SLOTS.map((slot) => {
        const src = snapshots[slot] ?? null;
        return (
          <div
            className="relative aspect-[3/4] overflow-hidden rounded bg-zinc-900"
            key={slot}
          >
            {src ? (
              // biome-ignore lint/correctness/useImageSize: dynamic base64 frame, size unknown at render
              <img
                alt={`Frame ${slot + 1}`}
                className="h-full w-full object-cover"
                src={src}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-700">
                —
              </div>
            )}
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 font-mono text-[10px] text-zinc-300">
              {slot + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SessionPage() {
  const { id } = Route.useParams();
  const { goal: initialGoal } = Route.useSearch();

  const [status, setStatus] = useState<SessionStatus>("running");
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [uptime, setUptime] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  // Uptime counter
  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    startTimeRef.current = Date.now();
    setUptime(0);
    const timerId = setInterval(() => {
      if (startTimeRef.current !== null) {
        setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [isStreaming]);

  const latestStep = steps.at(-1) ?? null;
  const movementLog = steps
    .map((s) => s.action)
    .filter(Boolean)
    .join(" → ");

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
      setSteps([]);

      try {
        await api.streamSession(trimmed, {
          id,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "step") {
              const { type: _type, ...stepData } = event;
              setSteps((prev) => [...prev, stepData as StepEvent]);
            }
            if (event.type === "session_result") {
              setStatus(event.status);
            }
            if (event.type === "session_error") {
              setStatus("stopped");
              toast.error(event.error);
            }
            if (event.type === "session_complete") {
              setStatus(event.status);
            }
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
      toast.error(error instanceof Error ? error.message : String(error));
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
      toast.error(error instanceof Error ? error.message : String(error));
    });
  };

  const snapshotSrc =
    latestStep?.snapshot ?? `${API_URL}/v1/snapshot?t=${Date.now()}`;

  const reasoningText =
    latestStep?.text ??
    (isStreaming ? "Waiting for first step…" : "No session running.");

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 p-3 font-mono">
      {/* Top bar */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm">
        <span className="font-bold text-white tracking-wider">BOOST</span>
        <span className={`flex items-center gap-1.5 ${statusColor(status)}`}>
          <span
            className={`inline-block h-2 w-2 rounded-full ${dotColor(isStreaming, status)}`}
          />
          {status.toUpperCase()}
        </span>
        <span className="text-xs text-zinc-500">{id.slice(0, 8)}</span>
        <span className="ml-auto text-xs text-zinc-500">
          step {steps.length} · {formatUptime(uptime)}
        </span>
        <Button
          className="h-7 bg-red-900 text-xs hover:bg-red-700"
          onClick={emergencyStop}
          size="sm"
          variant="destructive"
        >
          STOP
        </Button>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Left: snapshot */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
            {/* biome-ignore lint/correctness/useImageSize: dynamic frame, size varies */}
            <img
              alt="Latest camera frame"
              className="w-full object-contain"
              src={snapshotSrc}
              style={{ maxHeight: "55vh" }}
            />
            {latestStep?.action && (
              <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-bold text-green-400 text-sm">
                {latestStep.action}
              </div>
            )}
            {isStreaming && (
              <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-green-400">
                LIVE
              </div>
            )}
          </div>

          {/* AI reasoning */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-1.5 text-[10px] text-zinc-500 uppercase tracking-widest">
              AI Reasoning
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              {reasoningText}
            </p>
          </div>

          {/* Movement log */}
          {movementLog && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              <div className="mb-1 text-[10px] text-zinc-500 uppercase tracking-widest">
                Movement Log
              </div>
              <div className="flex flex-wrap gap-1">
                {steps
                  .filter((s) => s.action)
                  .map((s) => (
                    <span
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
                      key={s.stepIndex}
                    >
                      {s.action}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: sys status + film strip */}
        <div className="flex w-64 shrink-0 flex-col gap-3">
          {/* Sys status */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2 text-[10px] text-zinc-500 uppercase tracking-widest">
              Sys Status
            </div>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Status</dt>
                <dd className={statusDdColor(status)}>{status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Steps</dt>
                <dd className="text-zinc-300">{steps.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Uptime</dt>
                <dd className="text-zinc-300">{formatUptime(uptime)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Last action</dt>
                <dd className="max-w-[120px] truncate text-right text-zinc-300">
                  {latestStep?.action ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Motion film strip */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2 text-[10px] text-zinc-500 uppercase tracking-widest">
              Motion Snapshots
            </div>
            <FilmStrip snapshots={latestStep?.movementSnapshots ?? []} />
          </div>
        </div>
      </div>

      {/* Goal input */}
      <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <Input
          className="border-zinc-700 bg-zinc-900 font-mono text-sm text-white placeholder:text-zinc-600"
          disabled={isStreaming}
          onChange={(e) => setFollowUp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendFollowUp()}
          placeholder="Enter goal or follow-up…"
          value={followUp}
        />
        <Button
          disabled={isStreaming || !followUp.trim()}
          onClick={sendFollowUp}
          size="sm"
        >
          {isStreaming ? "Running…" : "Run"}
        </Button>
      </div>
    </main>
  );
}
