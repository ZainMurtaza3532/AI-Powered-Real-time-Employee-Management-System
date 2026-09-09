import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  Play,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Square,
  Trophy,
  Users,
} from "lucide-react";

import { CommandPalette } from "@/components/globals/command-palette";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSelfPunch, useTodayAttendance } from "@/hooks/use-attendance";
import { useNotificationSSE } from "@/hooks/use-notifications";

function formatSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function HeaderPunchWidget() {
  const { data: today, isLoading } = useTodayAttendance();
  const punchMutation = useSelfPunch();
  const [elapsed, setElapsed] = useState(0);

  const isCheckedIn = today?.status === "checked_in";

  useEffect(() => {
    if (!isCheckedIn || !today?.checkIn) {
      setElapsed(0);
      return;
    }

    const checkInTime = new Date(today.checkIn).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - checkInTime) / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [isCheckedIn, today?.checkIn]);

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-1.5">
      {isCheckedIn ? (
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/15">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-semibold">Working</span>
          <span className="font-mono tabular-nums font-bold">{formatSeconds(elapsed)}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => punchMutation.mutate({ action: "check_out" })}
            disabled={punchMutation.isPending}
            className="h-5 px-1.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 rounded-md"
          >
            Clock Out
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => punchMutation.mutate({ action: "check_in" })}
            disabled={punchMutation.isPending}
            className="h-7 gap-1.5 rounded-full border-emerald-500/30 bg-background px-3 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Clock In</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Chrome around every protected page: collapsible sidebar + premium top header
 * with Spotlight search (Ctrl+K), Live Punch stopwatch, quick actions (+), and SSE notifications.
 */
export function AppShell() {
  useNotificationSSE();
  const [commandOpen, setCommandOpen] = useState(false);
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const isAdminOrHead = user?.role === "admin" || user?.role === "head";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md transition-colors">
            {/* Left section: Sidebar trigger & Global Search */}
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4 hidden sm:block" />

              {/* Spotlight Omnisearch trigger button */}
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/70 hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-normal">Quick search or commands...</span>
                <kbd className="pointer-events-none ml-3 inline-flex h-4 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            {/* Right section: Live Punch clock, Quick Actions, Notification Bell */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile search trigger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCommandOpen(true)}
                className="h-8 w-8 sm:hidden text-muted-foreground"
                aria-label="Open search palette"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Real-time Attendance punch stopwatch */}
              <HeaderPunchWidget />

              {/* Quick Action (+) dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border/80 bg-background shadow-xs hover:border-primary/50 hover:bg-primary/5 cursor-pointer">
                  <Plus className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                      ⚡ Fast Actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(isAdminOrHead ? "/admin/tasks" : "/tasks")} className="cursor-pointer gap-2">
                      <ClipboardList className="h-4 w-4 text-purple-600" />
                      <span>{isAdminOrHead ? "New Task Assignment" : "View Assigned Tasks"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/leaves")} className="cursor-pointer gap-2">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      <span>Request Leave</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/expenses")} className="cursor-pointer gap-2">
                      <Receipt className="h-4 w-4 text-emerald-600" />
                      <span>Claim Expense</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/kudos")} className="cursor-pointer gap-2">
                      <Trophy className="h-4 w-4 text-amber-600" />
                      <span>Give Kudos</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/copilot")} className="cursor-pointer gap-2 font-medium text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span>Ask AI Copilot</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-4" />

              {/* Notification Bell */}
              <NotificationBell />
            </div>
          </header>

          <div className="flex-1">
            <Outlet />
          </div>
        </SidebarInset>

        {/* Global Command Palette modal */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </SidebarProvider>
    </TooltipProvider>
  );
}

