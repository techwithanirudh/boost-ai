import { Link } from "@tanstack/react-router";
import { SessionSkeleton } from "@/components/session-skeleton";

export interface ChatListItem {
  id: string;
  messages: unknown[];
  status: "completed" | "running" | "stopped";
  title: string;
  updatedAt: string;
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
      <p className="text-muted-foreground text-sm">No previous chats yet.</p>
    );
  }

  return history.map((chat) => (
    <Link
      className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
      key={chat.id}
      params={{ id: chat.id }}
      to="/session/$id"
    >
      <span className="truncate">{chat.title || "untitled chat"}</span>
      <span className="ml-3 shrink-0 text-muted-foreground text-xs">
        {chat.status}
      </span>
    </Link>
  ));
}
