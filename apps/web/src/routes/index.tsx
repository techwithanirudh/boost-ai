import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [goal, setGoal] = useState("");
  const navigate = Route.useNavigate();

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
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Card className="space-y-4 p-6">
        <h1 className="font-semibold text-2xl tracking-tight">Start Mission</h1>
        <p className="text-muted-foreground text-sm">
          Enter a goal, then the app redirects to the live session workspace.
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
    </main>
  );
}
