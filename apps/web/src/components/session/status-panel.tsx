import { useQuery } from "@tanstack/react-query";
import { Bot, ShieldAlert, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface HealthData {
  hub?: { ok: boolean; error?: string | null };
  service?: string;
}

interface HealthResponse {
  data?: HealthData | null;
}

async function fetchHealth(): Promise<HealthData | null> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) {
    throw new Error("health_request_failed");
  }
  const payload = (await res.json()) as HealthResponse;
  return payload.data ?? null;
}

function chatStatusVariant(status: string) {
  if (status === "running") {
    return "default" as const;
  }
  if (status === "error") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function chatStatusLabel(status: string): string {
  if (status === "streaming" || status === "submitted") {
    return "running";
  }
  if (status === "error") {
    return "error";
  }
  return "ready";
}

interface StatusPanelProps {
  chatStatus: string;
  isRunning: boolean;
  onStop: () => void;
  toolCallCount: number;
}

export function StatusPanel({
  chatStatus,
  isRunning,
  onStop,
  toolCallCount,
}: StatusPanelProps) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5000,
    retry: false,
  });

  const hubOk = health?.hub?.ok ?? null;
  const hubError = health?.hub?.error ?? null;
  const label = chatStatusLabel(chatStatus);

  return (
    <Card className="border p-3">
      <CardHeader className="p-0 pb-2">
        <p className="font-medium text-sm">Status</p>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldAlert className="size-3.5" />
              Chat
            </dt>
            <dd>
              <Badge className="capitalize" variant={chatStatusVariant(label)}>
                {label}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Bot className="size-3.5" />
              Hub
            </dt>
            <dd>
              {hubOk === null ? (
                <Badge variant="secondary">checking</Badge>
              ) : (
                <Badge variant={hubOk ? "default" : "destructive"}>
                  {hubOk ? "online" : "offline"}
                </Badge>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Tool calls</dt>
            <dd className="tabular-nums">{toolCallCount}</dd>
          </div>
        </dl>

        {hubError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive text-xs">
            {hubError}
          </div>
        ) : null}

        {isRunning ? (
          <>
            <Separator className="my-3" />
            <Button
              className="w-full"
              onClick={onStop}
              size="sm"
              variant="destructive"
            >
              <Square className="mr-1.5 size-3.5 fill-current" />
              Emergency Stop
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
