import {
  ArrowDown,
  ArrowUp,
  Flag,
  OctagonX,
  RotateCw,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { asNumber, asRecord, asString, formatValue } from "@/lib/utils";

export interface ToolRenderModel {
  input: unknown;
  output?: unknown;
  state?: string;
  toolCallId: string;
  toolName: string;
}

function ToolFrame({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-md border bg-muted text-muted-foreground">
          {icon}
        </span>
        <p className="font-medium text-sm">{title}</p>
      </div>
      {children}
    </div>
  );
}

function ForwardBackwardTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const distance = asNumber(input?.value);
  const speed = asNumber(input?.speed);
  const reason = asString(input?.text);

  const isForward = tool.toolName === "forward";

  return (
    <ToolFrame
      icon={
        isForward ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      }
      title={isForward ? "Forward" : "Backward"}
    >
      <p className="text-muted-foreground text-xs">
        {distance !== null ? `${distance}m` : "Distance unknown"}
        {speed !== null ? ` at speed ${speed}` : ""}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {reason ?? "No decision text provided."}
      </p>
    </ToolFrame>
  );
}

function TurnTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const degrees = asNumber(input?.value);
  const speed = asNumber(input?.speed);
  const reason = asString(input?.text);

  return (
    <ToolFrame icon={<RotateCw className="size-3.5" />} title="Turn">
      <p className="text-muted-foreground text-xs">
        {degrees !== null ? `${degrees} deg` : "Angle unknown"}
        {speed !== null ? ` at speed ${speed}` : ""}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {reason ?? "No decision text provided."}
      </p>
    </ToolFrame>
  );
}

function StopTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const reason = asString(input?.text);

  return (
    <ToolFrame icon={<OctagonX className="size-3.5" />} title="Stop">
      <p className="whitespace-pre-wrap text-sm">
        {reason ?? "Stop called without reason."}
      </p>
    </ToolFrame>
  );
}

function CompleteTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const summary = asString(input?.summary);

  return (
    <ToolFrame icon={<Flag className="size-3.5" />} title="Complete">
      <p className="whitespace-pre-wrap text-sm">
        {summary ?? "Session marked complete."}
      </p>
    </ToolFrame>
  );
}

function UnknownTool({ tool }: { tool: ToolRenderModel }) {
  return (
    <ToolFrame icon={<Wrench className="size-3.5" />} title={tool.toolName}>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
        {formatValue(tool.input)}
      </pre>
    </ToolFrame>
  );
}

export function Tool({ tool }: { tool: ToolRenderModel }) {
  switch (tool.toolName) {
    case "forward":
    case "backward":
      return <ForwardBackwardTool tool={tool} />;
    case "turn":
      return <TurnTool tool={tool} />;
    case "stop":
      return <StopTool tool={tool} />;
    case "complete":
      return <CompleteTool tool={tool} />;
    default:
      return <UnknownTool tool={tool} />;
  }
}
