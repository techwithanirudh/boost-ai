import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function AppHeader() {
  return (
    <header className="w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 hover:opacity-80"
          to="/"
        >
          <Bot className="size-5 shrink-0 text-primary" />
          <p className="truncate font-semibold text-sm">Boost Control</p>
        </Link>

        <div className="ml-auto">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
