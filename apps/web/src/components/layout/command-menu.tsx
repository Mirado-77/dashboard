"use client";

import {
  LayoutDashboard,
  Moon,
  Plug,
  RefreshCw,
  Search,
  Shield,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { openAddPanel } from "@/components/dashboard/add-widget/add-widget-panel";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";
import { catalogEntry } from "@/lib/widgets/catalog";
import { REFRESH_ALL_WIDGETS } from "@/lib/widgets/events";

const DASHBOARD = "/dashboard";

function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
}

export function CommandMenu({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceSummary[] | null>(null);

  async function show() {
    setOpen(true);
    // Fresh each time: a service may have been connected since.
    const { data } = await servicesClient.list();
    if (data) setServices(data);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (open) setOpen(false);
        else void show();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  function addWidget(selection: string) {
    if (pathname === DASHBOARD) openAddPanel(selection);
    else router.push(`${DASHBOARD}?add=${encodeURIComponent(selection)}`);
  }

  function refreshAll() {
    if (pathname === DASHBOARD) window.dispatchEvent(new Event(REFRESH_ALL_WIDGETS));
    else router.push(DASHBOARD);
  }

  const pages = [
    { href: DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings/services", label: "Services", icon: Plug },
    { href: "/settings/accounts", label: "Accounts", icon: UserRound },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-56 sm:px-3"
        onClick={() => void show()}
        aria-label="Search and run a command"
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      >
        <Search className="mx-auto sm:mx-0" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command menu"
        description="Add a widget, go to a page or run an action."
      >
        <CommandInput placeholder="Type a command or search a widget…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          <CommandGroup heading="Add a widget">
            {services === null && <CommandItem disabled>Loading widgets…</CommandItem>}
            {services?.flatMap((service) =>
              service.widgets.map((widget) => {
                const key = `${service.id}/${widget.id}`;
                const Icon = catalogEntry(service.id, widget.id).icon;
                return (
                  <CommandItem
                    key={key}
                    value={`add ${service.name} ${widget.name}`}
                    onSelect={() => run(() => addWidget(key))}
                  >
                    <Icon aria-hidden />
                    {widget.name}
                    <span className="text-muted-foreground">· {service.name}</span>
                    {!service.available && <CommandShortcut>Connect first</CommandShortcut>}
                  </CommandItem>
                );
              }),
            )}
          </CommandGroup>


          <CommandGroup heading="Go to" className="border-t">
            {pages.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={`go ${label}`} onSelect={() => run(() => router.push(href))}>
                <Icon aria-hidden />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>


          <CommandGroup heading="Actions" className="border-t">
            <CommandItem value="refresh all widgets" onSelect={() => run(refreshAll)}>
              <RefreshCw aria-hidden />
              Refresh all widgets
            </CommandItem>
            <CommandItem
              value="toggle dark mode theme"
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              <Moon aria-hidden />
              Toggle dark mode
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
