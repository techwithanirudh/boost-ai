import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatListItem {
  goal: string;
  id: string;
  status: "completed" | "running" | "stopped";
  updatedAt: string;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [goal, setGoal] = useState("");
  const [history, setHistory] = useState<ChatListItem[]>([]);
  const navigate = Route.useNavigate();

  useEffect(() => {
    const loadHistory = async () => {
      const res = await fetch("/api/v1/chat").catch(() => null);
      if (!res?.ok) {
        return;
      }

      const payload = (await res.json()) as {
        data?: ChatListItem[];
      };
      setHistory(payload.data ?? []);
    };

    loadHistory();
  }, []);

  const start = () => {
    const trimmed = goal.trim();
    if (!trimmed) {
      return;
    }

    const id = crypto.randomUUID();
    navigate({
      to: "/session/$id",
      params: { id },
      search: { goal: trimmed },
    });
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 px-6 py-8">
      <Card className="space-y-4 p-6">
        <h1 className="font-semibold text-2xl tracking-tight">New Chat</h1>
        <p className="text-muted-foreground text-sm">
          Enter a goal and open the live AI chat + tool pane.
        </p>
        <div className="flex gap-2">
          <Input
            autoFocus
            onChange={(event) => setGoal(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && start()}
            placeholder="e.g. inspect the room and stop near the desk"
            value={goal}
          />
          <Button disabled={!goal.trim()} onClick={start}>
            Start
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-lg">Previous Chats</h2>
        <div className="mt-4 space-y-2">
          {history.length > 0 ? (
            history.map((chat) => (
              <Link
                className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
                key={chat.id}
                params={{ id: chat.id }}
                search={{ goal: chat.goal }}
                to="/session/$id"
              >
                <span className="truncate">{chat.goal || "Untitled chat"}</span>
                <span className="ml-3 shrink-0 text-muted-foreground text-xs">
                  {chat.status}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No previous chats yet.
            </p>
          )}
        </div>
      </Card>
    </main>
  );
}
