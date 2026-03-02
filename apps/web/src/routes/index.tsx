import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { generateId } from "ai";
import { useState } from "react";
import {
  NewTaskForm,
  type NewTaskFormValues,
} from "@/components/new-task-form";
import { type ChatListItem, Sessions } from "@/components/sessions";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: HomePage,
});

async function fetchChatHistory(): Promise<ChatListItem[]> {
  const res = await fetch("/api/v1/chat");
  if (!res.ok) {
    throw new Error("Failed to load history");
  }
  const payload = (await res.json()) as { data?: ChatListItem[] };
  return payload.data ?? [];
}

function HomePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = Route.useNavigate();

  const { data: history = [], isPending: isLoadingHistory } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChatHistory,
  });

  const start = ({ message }: NewTaskFormValues, reset: () => void) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    const id = generateId();
    reset();
    navigate({
      to: "/session/$id",
      params: { id },
      search: { message: trimmed },
    });
    setIsSubmitting(false);
  };

  return (
    <main className="flex h-full w-full flex-col gap-4 p-4">
      <Card className="shrink-0 p-6">
        <h1 className="mb-4 font-semibold text-2xl tracking-tight">New Task</h1>
        <NewTaskForm isSubmitting={isSubmitting} onSubmit={start} />
      </Card>

      <Card className="min-h-0 flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Previous Sessions</h2>
          <p className="text-muted-foreground text-xs">
            {history.length} total
          </p>
        </div>
        <div className="h-full space-y-2 overflow-y-auto pr-1">
          <Sessions history={history} isLoading={isLoadingHistory} />
        </div>
      </Card>
    </main>
  );
}
