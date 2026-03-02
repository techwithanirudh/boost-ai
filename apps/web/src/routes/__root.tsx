import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { healthQuery } from "@/lib/queries/health";

import "../index.css";

export interface RouterAppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Boost AI",
      },
      {
        name: "description",
        content: "LEGO Boost autonomous robot control interface",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: "/icon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/icon-256.png",
      },
    ],
  }),
});

function HubOfflineBanner() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-semibold text-base">Hub offline</p>
      <p className="max-w-xs text-muted-foreground text-sm">
        The Boost hub is not reachable. Make sure the hub is powered on and
        connected, then refresh the page.
      </p>
    </div>
  );
}

function RootComponent() {
  const { data: health, isFetched } = useQuery(healthQuery);
  const hubOffline = isFetched && health?.hub?.ok === false;

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <TooltipProvider>
          <div className="flex h-svh flex-col">
            <AppHeader />
            <div className="min-h-0 flex-1">
              {hubOffline ? <HubOfflineBanner /> : <Outlet />}
            </div>
          </div>
        </TooltipProvider>
        <Toaster richColors />
      </ThemeProvider>
    </>
  );
}
