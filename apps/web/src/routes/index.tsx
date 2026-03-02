import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatListItem {
  id: string;
  messages: unknown[];
  status: "completed" | "running" | "stopped";
  title: string;
  updatedAt: string;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [draftMessage, setDraftMessage] = useState("");
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

  const start = async () => {
    const trimmed = draftMessage.trim();
    if (!trimmed) {
      return;
    }

    const id = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    const response = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        message: {
          id: messageId,
          role: "user",
          parts: [{ type: "text", text: trimmed }],
        },
      }),
    }).catch(() => null);

    if (!response?.ok) {
      toast.error("Failed to start chat session");
      return;
    }

    navigate({
      to: "/session/$id",
      params: { id },
    });
  };

  return (
    <main className="flex h-full w-full flex-col gap-4 p-4">
      <Card className="shrink-0 space-y-4 p-6">
        <h1 className="font-semibold text-2xl tracking-tight">New Chat</h1>
        <p className="text-muted-foreground text-sm">
          Send the first message and open the live AI chat + tool pane.
        </p>
        <div className="flex gap-2">
          <Input
            autoFocus
            onChange={(event) => setDraftMessage(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && start()}
            placeholder="e.g. move forward slowly and inspect nearby objects"
            value={draftMessage}
          />
          <Button disabled={!draftMessage.trim()} onClick={start}>
            Start
          </Button>
        </div>
      </Card>

      <Card className="min-h-0 flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Previous Chats</h2>
          <p className="text-muted-foreground text-xs">
            {history.length} total
          </p>
        </div>
        <div className="h-full space-y-2 overflow-y-auto pr-1">
          {history.length > 0 ? (
            history.map((chat) => (
              <Link
                className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
                key={chat.id}
                params={{ id: chat.id }}
                to="/session/$id"
              >
                <span className="truncate">
                  {chat.title || "untitled chat"}
                </span>
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
