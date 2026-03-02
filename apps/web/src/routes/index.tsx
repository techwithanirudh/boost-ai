import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { generateId } from "ai";
import { Bot } from "lucide-react";
import { useState } from "react";
import {
  NewTaskForm,
  type NewTaskFormValues,
} from "@/components/new-task-form";
import { type ChatListItem, Sessions } from "@/components/sessions";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

  const start = ({ task }: NewTaskFormValues, reset: () => void) => {
    const trimmed = task.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    const id = generateId();
    reset();
    navigate({
      to: "/session/$id",
      params: { id },
      search: { task: trimmed },
    });
    setIsSubmitting(false);
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Bot className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Boost Control</h1>
          <p className="text-muted-foreground text-xs">
            LEGO Boost autonomous robot
          </p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="mb-1 font-medium text-base">New task</h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Describe what you want the robot to do and it will navigate
          autonomously.
        </p>
        <NewTaskForm isSubmitting={isSubmitting} onSubmit={start} />
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-sm">Previous sessions</h2>
          {history.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {history.length} total
            </span>
          ) : null}
        </div>
        <Separator className="mb-3" />
        <Sessions history={history} isLoading={isLoadingHistory} />
      </div>
    </main>
  );
}
