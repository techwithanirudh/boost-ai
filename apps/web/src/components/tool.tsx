import {
  ArrowDown,
  ArrowUp,
  Flag,
  MapPin,
  OctagonX,
  RotateCw,
  Wrench,
  Zap,
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
  snapshot,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  snapshot?: string;
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
      {snapshot ? (
        // biome-ignore lint/correctness/useImageSize: snapshot comes from camera stream
        <img
          alt={`${title} snapshot`}
          className="mb-2 max-h-56 w-full rounded-md border object-contain"
          src={snapshot}
        />
      ) : null}
      {children}
    </div>
  );
}

function ForwardBackwardTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const output = asRecord(tool.output);
  const distance = asNumber(input?.value);
  const speed = asNumber(input?.speed);
  const reason = asString(input?.text);
  const snapshot = asString(output?.snapshot) ?? undefined;

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
      snapshot={snapshot}
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
  const output = asRecord(tool.output);
  const degrees = asNumber(input?.value);
  const speed = asNumber(input?.speed);
  const reason = asString(input?.text);
  const snapshot = asString(output?.snapshot) ?? undefined;

  return (
    <ToolFrame
      icon={<RotateCw className="size-3.5" />}
      snapshot={snapshot}
      title="Turn"
    >
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
  const output = asRecord(tool.output);
  const reason = asString(input?.text);
  const snapshot = asString(output?.snapshot) ?? undefined;

  return (
    <ToolFrame
      icon={<OctagonX className="size-3.5" />}
      snapshot={snapshot}
      title="Stop"
    >
      <p className="whitespace-pre-wrap text-sm">
        {reason ?? "Stop called without reason."}
      </p>
    </ToolFrame>
  );
}

function CompleteTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const output = asRecord(tool.output);
  const summary = asString(input?.summary);
  const snapshot = asString(output?.snapshot) ?? undefined;

  return (
    <ToolFrame
      icon={<Flag className="size-3.5" />}
      snapshot={snapshot}
      title="Complete"
    >
      <p className="whitespace-pre-wrap text-sm">
        {summary ?? "Session marked complete."}
      </p>
    </ToolFrame>
  );
}

function StrikeTool({ tool }: { tool: ToolRenderModel }) {
  const input = asRecord(tool.input);
  const output = asRecord(tool.output);
  const duration = asNumber(input?.value);
  const reason = asString(input?.text);
  const snapshot = asString(output?.snapshot) ?? undefined;

  return (
    <ToolFrame
      icon={<Zap className="size-3.5" />}
      snapshot={snapshot}
      title="Strike"
    >
      <p className="text-muted-foreground text-xs">
        {duration !== null ? `jaw open ${duration}s` : ""}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {reason ?? "No decision text provided."}
      </p>
    </ToolFrame>
  );
}

function GetPoseTool({ tool }: { tool: ToolRenderModel }) {
  const output = asRecord(tool.output);
  const pose = asRecord(output?.pose);
  const x = asNumber(pose?.x);
  const y = asNumber(pose?.y);
  const heading = asNumber(pose?.heading);

  return (
    <ToolFrame icon={<MapPin className="size-3.5" />} title="Get Pose">
      {pose !== null ? (
        <p className="text-muted-foreground text-xs">
          {x !== null ? `x: ${x.toFixed(2)} m` : ""}
          {y !== null ? `  y: ${y.toFixed(2)} m` : ""}
          {heading !== null ? `  heading: ${heading.toFixed(1)}°` : ""}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Pose unavailable</p>
      )}
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
    case "strike":
      return <StrikeTool tool={tool} />;
    case "getPose":
      return <GetPoseTool tool={tool} />;
    default:
      return <UnknownTool tool={tool} />;
  }
}
