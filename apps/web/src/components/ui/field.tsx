import type { ComponentProps, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Field({
  children,
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      className={cn(
        orientation === "horizontal"
          ? "flex items-center justify-end gap-2"
          : "space-y-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function FieldGroup({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {children}
    </div>
  );
}

export function FieldLabel({
  children,
  className,
  ...props
}: ComponentProps<"label">) {
  return (
    <label className={cn("font-medium text-xs", className)} {...props}>
      {children}
    </label>
  );
}

export function FieldDescription({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-xs", className)} {...props}>
      {children}
    </p>
  );
}

export function FieldError({
  errors,
}: PropsWithChildren<{ errors: Array<{ message?: string } | undefined> }>) {
  const message = errors.find((error) => error?.message)?.message;
  if (!message) {
    return null;
  }

  return <p className="text-destructive text-xs">{message}</p>;
}
