import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type SessionResult, type SessionStatus } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: ControlPanel,
});

const MEDIAMTX_URL =
  import.meta.env.VITE_MEDIAMTX_URL ?? "http://localhost:8889";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: SessionStatus | "unknown" }) {
  const colors: Record<string, string> = {
    running: "bg-yellow-400 animate-pulse",
    completed: "bg-green-500",
    stopped: "bg-red-500",
    unknown: "bg-zinc-500",
  };
  return (
    <span
      className={`inline-block size-2 rounded-full ${colors[status] ?? colors.unknown}`}
    />
  );
}

function HubBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) {
    return <span className="text-muted-foreground text-xs">checking hub…</span>;
  }
  return (
    <span
      className={`font-mono text-xs ${connected ? "text-green-400" : "text-red-400"}`}
    >
      hub {connected ? "● connected" : "○ offline"}
    </span>
  );
}

function CameraFeed() {
  return (
    <iframe
      allow="autoplay"
      className="aspect-video w-full rounded border border-border bg-black"
      src={`${MEDIAMTX_URL}/live/stream`}
      title="Live camera feed"
    />
  );
}

// ── main component ─────────────────────────────────────────────────────────────

function ControlPanel() {
  const [goal, setGoal] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionResult | null>(null);
  const [hubConnected, setHubConnected] = useState<boolean | null>(null);
  // ── health polling ──
  useEffect(() => {
    const check = async () => {
      const res = await api.health().catch(() => null);
      setHubConnected(res?.data?.hub?.ok ?? false);
    };
    check();
    const id = setInterval(check, 6000);
    return () => clearInterval(id);
  }, []);

  // ── start or follow-up session ──
  const runSession = useCallback(
    async (goalText: string, existingId?: string) => {
      if (!goalText.trim()) {
        return;
      }
      setLoading(true);
      try {
        const res = await api.startSession(goalText.trim(), existingId);
        if (!(res.ok && res.data)) {
          toast.error(String(res.error ?? "Unknown error"));
          return;
        }
        setSession(res.data);
        if (res.data.status === "completed") {
          toast.success("Session complete!");
        } else if (res.data.status === "stopped") {
          toast.warning("Session stopped.");
        } else {
          toast.info(`Reached step limit — ${res.data.steps} steps taken.`);
        }
      } catch (err) {
        toast.error(String(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── emergency stop ──
  const stopSession = useCallback(async () => {
    if (!session) {
      return;
    }
    const res = await api.stopSession(session.sessionId).catch(() => null);
    if (res?.ok) {
      setSession((s) => (s ? { ...s, status: "stopped" } : null));
      toast.warning("Emergency stop sent.");
    } else {
      toast.error("Stop request failed.");
    }
  }, [session]);

  const handleStart = () => {
    setSession(null);
    setFollowUp("");
    runSession(goal);
  };

  const handleFollowUp = () => {
    if (!session) {
      return;
    }
    runSession(followUp || goal, session.sessionId);
    setFollowUp("");
  };

  return (
    <main className="space-y-4 px-4 py-6">
      {/* ── Header status bar ── */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm uppercase tracking-widest">
          Boost Control
        </span>
        <HubBadge connected={hubConnected} />
      </div>

      {/* ── Camera feed ── */}
      <CameraFeed />

      {/* ── Goal input ── */}
      <Card className="space-y-3 px-4 py-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wider">
          New Mission
        </p>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            disabled={loading}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleStart()}
            placeholder="e.g. go to the kitchen"
            value={goal}
          />
          <Button
            disabled={loading || !goal.trim()}
            onClick={handleStart}
            variant="default"
          >
            {loading && !session ? "Running…" : "▶ Start"}
          </Button>
        </div>
      </Card>

      {/* ── Active / last session ── */}
      {session && (
        <Card className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot status={session.status} />
              <span className="font-mono text-muted-foreground text-xs">
                {session.sessionId.slice(0, 8)}…
              </span>
            </div>
            <span className="font-semibold text-xs uppercase tracking-wider">
              {session.status}
            </span>
          </div>

          <div className="text-muted-foreground text-xs">
            {session.steps} step{session.steps !== 1 ? "s" : ""}
          </div>

          {session.text && (
            <p className="whitespace-pre-wrap rounded border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed">
              {session.text}
            </p>
          )}

          {/* Stop — only when running */}
          {session.status === "running" && (
            <Button
              disabled={loading}
              onClick={stopSession}
              size="sm"
              variant="destructive"
            >
              ⏹ Emergency Stop
            </Button>
          )}

          {/* Follow-up — only after completed */}
          {session.status === "completed" && (
            <div className="space-y-2 border-border border-t pt-1">
              <p className="text-muted-foreground text-xs">
                Follow-up goal (continues same session):
              </p>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  disabled={loading}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !loading && handleFollowUp()
                  }
                  placeholder="e.g. now find the fridge"
                  value={followUp}
                />
                <Button
                  disabled={loading || !followUp.trim()}
                  onClick={handleFollowUp}
                  variant="outline"
                >
                  {loading ? "Running…" : "▶ Continue"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Loading state while waiting for server ── */}
      {loading && (
        <Card className="px-4 py-4">
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span className="inline-block size-2 animate-pulse rounded-full bg-yellow-400" />
            Agent running autonomously — waiting for response…
          </div>
        </Card>
      )}
    </main>
  );
}
