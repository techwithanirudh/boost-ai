import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function AppHeader() {
  return (
    <header className="w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-3 px-4">
        <Link
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 hover:opacity-80"
          to="/"
        >
          <Sparkles className="size-4 shrink-0 text-primary" />
          <p className="truncate font-semibold text-sm">Boost Control</p>
        </Link>

        <div className="ml-auto">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
