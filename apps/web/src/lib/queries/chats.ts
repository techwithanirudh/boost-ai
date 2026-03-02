import { queryOptions } from "@tanstack/react-query";
import type { ChatListItem } from "@/components/sessions";

async function fetchChatHistory(): Promise<ChatListItem[]> {
  const res = await fetch("/api/v1/chat");
  if (!res.ok) {
    throw new Error("Failed to load history");
  }
  const payload = (await res.json()) as { data?: ChatListItem[] };
  return payload.data ?? [];
}

export const chatHistoryQuery = queryOptions({
  queryKey: ["chats"],
  queryFn: fetchChatHistory,
});
