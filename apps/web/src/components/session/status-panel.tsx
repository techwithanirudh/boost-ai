import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { healthQuery } from "@/lib/queries/health";

function chatStatusVariant(
  label: string
): "default" | "secondary" | "destructive" {
  if (label === "running") {
    return "default";
  }
  if (label === "error") {
    return "destructive";
  }
  return "secondary";
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
}

export function StatusPanel({
  chatStatus,
  isRunning,
  onStop,
}: StatusPanelProps) {
  const { data: health } = useQuery(healthQuery);

  const hubOk = health?.hub?.ok ?? null;
  const hubError = health?.hub?.error ?? null;
  const label = chatStatusLabel(chatStatus);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border p-0">
      <div className="border-b px-3 py-2">
        <p className="font-medium text-sm">Status</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="size-3.5" />
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
        </dl>

        {hubError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive text-xs">
            {hubError}
          </div>
        ) : null}

        {isRunning ? (
          <div className="mt-auto">
            <Separator className="my-3" />
            <Button
              className="w-full"
              onClick={onStop}
              size="sm"
              variant="destructive"
            >
              <Square className="mr-1.5 size-3.5 fill-current" />
              Stop
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
