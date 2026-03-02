import { cn } from "@/lib/utils";

interface BatteryProps {
  className?: string;
  level: number;
}

function batteryFill(level: number): string {
  if (level <= 15) {
    return "bg-destructive";
  }
  if (level <= 30) {
    return "bg-amber-500";
  }
  return "bg-primary";
}

function batteryText(level: number): string {
  if (level <= 15) {
    return "text-destructive";
  }
  if (level <= 30) {
    return "text-amber-500";
  }
  return "text-primary";
}

export function Battery({ level, className }: BatteryProps) {
  const clamped = Math.max(0, Math.min(100, level));

  return (
    <span
      className={cn(
        "relative inline-flex h-5 w-13 shrink-0 items-center justify-center overflow-hidden rounded-none border border-transparent bg-secondary py-0.5 font-medium text-xs",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0", batteryFill(clamped))}
        style={{ width: `${clamped}%`, opacity: 0.3 }}
      />
      <span className={cn("relative tabular-nums", batteryText(clamped))}>
        {clamped}%
      </span>
    </span>
  );
}
