import { Link } from "@tanstack/react-router";
import { SessionSkeleton } from "@/components/session-skeleton";
import { Badge } from "@/components/ui/badge";

export interface ChatListItem {
  id: string;
  messages: unknown[];
  status: "completed" | "running" | "stopped";
  title: string;
  updatedAt: string;
}

function statusVariant(
  status: ChatListItem["status"]
): "default" | "secondary" | "destructive" {
  if (status === "running") {
    return "default";
  }
  if (status === "stopped") {
    return "destructive";
  }
  return "secondary";
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sessions({
  history,
  isLoading,
}: {
  history: ChatListItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <SessionSkeleton />;
  }

  if (history.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        No sessions yet. Start your first task above.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {history.map((chat) => (
        <Link
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
          key={chat.id}
          params={{ id: chat.id }}
          to="/session/$id"
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {chat.title || "Untitled session"}
          </span>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {formatRelativeTime(chat.updatedAt)}
            </span>
            <Badge className="capitalize" variant={statusVariant(chat.status)}>
              {chat.status}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
