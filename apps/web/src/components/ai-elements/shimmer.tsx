import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Shimmer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted",
        className
      )}
      {...props}
    />
  );
}
