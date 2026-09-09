import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Clock,
  Sparkles,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Receipt,
  Target,
  Trophy,
  Network,
  Megaphone,
  Star,
  MessageSquare,
  BarChart3,
  UserRound,
  Building2,
  FileText,
  History,
  Zap,
  Play,
  Square,
  Bot,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSelfPunch, useTodayAttendance } from "@/hooks/use-attendance";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange: setControlledOpen }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data: todayAttendance } = useTodayAttendance();
  const selfPunchMutation = useSelfPunch();

  const isCheckedIn = todayAttendance?.status === "checked_in";

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (value: boolean) => {
      if (isControlled && setControlledOpen) {
        setControlledOpen(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, setControlledOpen]
  );

  // Global keydown listener for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const isAdminOrHead = user?.role === "admin" || user?.role === "head";
  const isAdmin = user?.role === "admin";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Global Command Palette"
      description="Quick actions, navigation, and employee lookup..."
      className="max-w-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden"
    >
      <CommandInput placeholder="Type a command, page name, or action (e.g., 'punch', 'leave', 'task', 'ai')..." />
      <CommandList className="max-h-96 p-2">
        <CommandEmpty>No matching commands or pages found.</CommandEmpty>

        {/* ⚡ Quick Actions */}
        <CommandGroup heading="⚡ Quick Actions">
          {todayAttendance?.status !== "checked_in" ? (
            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  selfPunchMutation.mutate({ action: "check_in" });
                })
              }
              className="gap-3 py-2.5 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Play className="h-4 w-4 fill-current" />
              </div>
              <span>Clock In / Punch In (Start Work Shift)</span>
              <CommandShortcut>Shift+I</CommandShortcut>
            </CommandItem>
          ) : (
            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  selfPunchMutation.mutate({ action: "check_out" });
                })
              }
              className="gap-3 py-2.5 cursor-pointer font-medium text-amber-600 dark:text-amber-400"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Square className="h-4 w-4 fill-current" />
              </div>
              <span>Clock Out / Punch Out (End Work Shift)</span>
              <CommandShortcut>Shift+O</CommandShortcut>
            </CommandItem>
          )}

          <CommandItem
            onSelect={() => handleSelect(() => navigate("/copilot"))}
            className="gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <span>Ask EMS AI Copilot</span>
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => handleSelect(() => navigate("/leaves"))}
            className="gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <CalendarDays className="h-4 w-4" />
            </div>
            <span>Apply for Time Off / Leave</span>
          </CommandItem>

          <CommandItem
            onSelect={() => handleSelect(() => navigate(isAdminOrHead ? "/admin/tasks" : "/tasks"))}
            className="gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <ClipboardList className="h-4 w-4" />
            </div>
            <span>{isAdminOrHead ? "Create & Assign Tasks" : "View My Assigned Tasks"}</span>
          </CommandItem>

          <CommandItem
            onSelect={() => handleSelect(() => navigate("/expenses"))}
            className="gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Receipt className="h-4 w-4" />
            </div>
            <span>Submit Expense Claim</span>
          </CommandItem>

          <CommandItem
            onSelect={() => handleSelect(() => navigate("/kudos"))}
            className="gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Trophy className="h-4 w-4" />
            </div>
            <span>Award Kudos to Teammate</span>
          </CommandItem>

          {isAdminOrHead && (
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/copilot?tab=executive"))}
              className="gap-3 py-2.5 cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Generate AI Executive Briefing</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* 🧭 Navigation */}
        <CommandGroup heading="🧭 Main Navigation">
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard"))} className="gap-3 py-2">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/attendance"))} className="gap-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Attendance & Timecards</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/tasks"))} className="gap-3 py-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span>Tasks Kanban & List</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/okrs"))} className="gap-3 py-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>OKRs & Strategic Goals</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/org-chart"))} className="gap-3 py-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span>Organization Hierarchy Chart</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/payroll"))} className="gap-3 py-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>Payroll & Digital Payslips</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/kudos"))} className="gap-3 py-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span>Kudos Recognition Wall</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/performance-reviews"))} className="gap-3 py-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span>Performance Reviews</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/feedback"))} className="gap-3 py-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>Employee Feedback & Helpdesk</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/announcements"))} className="gap-3 py-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span>Company Announcements</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/profile"))} className="gap-3 py-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <span>My Profile & Settings</span>
          </CommandItem>
        </CommandGroup>

        {/* 🛡️ Admin & Leadership */}
        {isAdminOrHead && (
          <>
            <CommandSeparator />
            <CommandGroup heading="🛡️ Administration & Management">
              {isAdmin && (
                <CommandItem onSelect={() => handleSelect(() => navigate("/admin/users"))} className="gap-3 py-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <span>Employee User Management</span>
                </CommandItem>
              )}
              {isAdmin && (
                <CommandItem onSelect={() => handleSelect(() => navigate("/admin/departments"))} className="gap-3 py-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Department Setup & Structure</span>
                </CommandItem>
              )}
              <CommandItem onSelect={() => handleSelect(() => navigate("/admin/reports"))} className="gap-3 py-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Executive Reports & Analytics</span>
              </CommandItem>
              {isAdmin && (
                <CommandItem onSelect={() => handleSelect(() => navigate("/admin/activity-log"))} className="gap-3 py-2">
                  <History className="h-4 w-4 text-primary" />
                  <span>System Audit & Activity Logs</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
