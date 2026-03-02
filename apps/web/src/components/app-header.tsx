import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Sparkles } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function AppHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const inSession = pathname.startsWith("/session/");

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-3 px-4">
        {inSession ? (
          <Link
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            to="/"
          >
            <ChevronLeft className="size-3.5" />
            Home
          </Link>
        ) : null}

        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="truncate font-semibold text-sm">Boost Control</p>
        </div>

        <div className="ml-auto">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
