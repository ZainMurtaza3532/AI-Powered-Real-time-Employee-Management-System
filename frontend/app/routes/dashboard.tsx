import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  PlusCircle,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Users2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDashboardAnalytics, useEmployeeDashboard } from "@/hooks/use-dashboard";
import { useSelfPunch, useTodayAttendance } from "@/hooks/use-attendance";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/dashboard";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Dashboard | Employee Management System" },
    {
      name: "description",
      content: "Employee Management System dashboard.",
    },
  ];
}

// ---------------------------------------------------------------------------

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(47 100% 50%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
];

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "hsl(220 9% 46%)",
  in_progress: "hsl(var(--primary))",
  in_review: "hsl(47 100% 50%)",
  completed: "hsl(142 76% 36%)",
  rejected: "hsl(0 84% 60%)",
};

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: "logged in",
  logout: "logged out",
  user_created: "created a user",
  user_updated: "updated a user",
  user_deleted: "deleted a user",
  profile_updated: "updated their profile",
  department_created: "created a department",
  department_updated: "updated a department",
  department_deleted: "deleted a department",
  department_members_updated: "updated department members",
  leave_created: "requested leave",
  leave_cancelled: "cancelled a leave request",
  leave_approved: "approved a leave request",
  leave_rejected: "rejected a leave request",
  leave_balance_adjusted: "adjusted leave balance",
  announcement_created: "created an announcement",
  announcement_updated: "updated an announcement",
  announcement_deleted: "deleted an announcement",
  feedback_created: "submitted feedback",
  feedback_responded: "responded to feedback",
  feedback_resolved: "resolved feedback",
  attendance_marked: "marked attendance",
  attendance_bulk_marked: "bulk-marked attendance",
  review_created: "created a performance review",
  review_acknowledged: "acknowledged a review",
  review_deleted: "deleted a review",
  goal_updated: "updated a goal",
  task_created: "created a task",
  task_status_updated: "updated a task",
  task_submitted: "submitted a task",
  task_reviewed: "reviewed a task",
  ai_insight_deleted: "deleted an AI insight",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// =========================================================================
// Dashboard Page
// =========================================================================

export default function Dashboard() {
  const { isPending: isAuthPending, data: user } = useCurrentUser();

  // Route to the correct dashboard based on role.
  if (isAuthPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <Skeleton className="h-9 w-48" />
        </header>
        <DashboardSkeleton />
      </div>
    );
  }

  if (user?.role === "employee") {
    return <EmployeeDashboard />;
  }

  return <AdminDashboard />;
}

// =========================================================================
// Stats Cards
// =========================================================================

function StatsCards({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { summary } = analytics;

  const cards = [
    {
      label: "Total Employees",
      value: summary.totalEmployees,
      icon: Users,
      color: "text-muted-foreground",
    },
    {
      label: "Active Tasks",
      value: summary.activeTasks,
      icon: ListTodo,
      color: "text-primary",
    },
    {
      label: "Pending Leaves",
      value: summary.pendingLeaves,
      icon: CalendarDays,
      color: summary.pendingLeaves > 0 ? "text-amber-600" : "text-muted-foreground",
    },
    {
      label: "Attendance Rate",
      value: `${summary.attendanceRate}%`,
      icon: TrendingUp,
      color:
        summary.attendanceRate >= 80
          ? "text-emerald-600"
          : summary.attendanceRate >= 60
            ? "text-amber-600"
            : "text-destructive",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              <card.icon className={`size-4 ${card.color}`} />
            </div>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =========================================================================
// Task Status Pie Chart
// =========================================================================

function TaskStatusPie({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { taskStats } = analytics;
  const total = Object.values(taskStats).reduce((s, v) => s + v, 0);

  const pieData = [
    { name: "To Do", value: taskStats.todo, key: "todo" },
    { name: "In Progress", value: taskStats.in_progress, key: "in_progress" },
    { name: "In Review", value: taskStats.in_review, key: "in_review" },
    { name: "Completed", value: taskStats.completed, key: "completed" },
    { name: "Rejected", value: taskStats.rejected, key: "rejected" },
  ].filter((d) => d.value > 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Task Distribution
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Current task status breakdown ({total} total)
            </p>
          </div>
          <ListTodo className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 h-64">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        TASK_STATUS_COLORS[entry.key] ??
                        "hsl(var(--muted-foreground))"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No tasks yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Attendance Pie Chart
// =========================================================================

function AttendancePie({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { attendanceOverview } = analytics;
  const total = Object.values(attendanceOverview).reduce((s, v) => s + v, 0);

  const pieData = [
    { name: "Present", value: attendanceOverview.present },
    { name: "Absent", value: attendanceOverview.absent },
    { name: "Late", value: attendanceOverview.late },
    { name: "Half Day", value: attendanceOverview.half_day },
    { name: "On Leave", value: attendanceOverview.on_leave },
  ].filter((d) => d.value > 0);

  const ATTENDANCE_COLORS = [
    "hsl(142 76% 36%)",
    "hsl(0 84% 60%)",
    "hsl(47 100% 50%)",
    "hsl(var(--primary))",
    "hsl(262 83% 58%)",
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Attendance Overview
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This month&apos;s attendance ({total} records)
            </p>
          </div>
          <CalendarCheck className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 h-64">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`att-${index}`}
                      fill={ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No attendance records yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Leave by Type Bar Chart
// =========================================================================

function LeaveByTypeBar({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { leaveStats } = analytics;
  const total = leaveStats.pending + leaveStats.approved + leaveStats.rejected;

  const barData = leaveStats.byType.map((t) => ({
    name: t.type.charAt(0).toUpperCase() + t.type.slice(1),
    count: t.count,
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Leave Statistics
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {total} requests — {leaveStats.pending} pending, {leaveStats.approved} approved
            </p>
          </div>
          <CalendarDays className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 h-64">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No leave requests yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Department Performance Bar Chart
// =========================================================================

function DepartmentPerformanceBar({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { departmentStats } = analytics;

  const chartData = departmentStats.map((dept) => ({
    name: dept.name.length > 14 ? dept.name.slice(0, 14) + "…" : dept.name,
    members: dept.memberCount,
    attendance: dept.attendanceRate,
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Department Performance
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member count and attendance rate by department
            </p>
          </div>
          <Building2 className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="attendance"
                  fill="hsl(var(--primary))"
                  name="Attendance %"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="members"
                  fill="hsl(142 76% 36%)"
                  name="Members"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No departments yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Recent Activity Table
// =========================================================================

function RecentActivityTable({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useDashboardAnalytics>["data"]>;
}) {
  const { recentActivity } = analytics;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Recent Activity
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Latest actions across the system
              </p>
            </div>
            <FileText className="size-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          {recentActivity.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((activity, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm font-medium">
                      {activity.actorName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ACTIVITY_ACTION_LABELS[activity.action] ?? activity.action}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {activity.targetName || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {timeAgo(activity.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Loading Skeleton
// =========================================================================

function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Activity table */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// =========================================================================
// Admin / Head Dashboard
// =========================================================================

function AdminDashboard() {
  const { isPending: isAuthPending, data: user } = useCurrentUser();
  const {
    data: analytics,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useDashboardAnalytics();

  const isHead = user?.role === "head";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm text-muted-foreground">
          {isHead ? "Department Overview" : "Organization Overview"}
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground">
          {isAuthPending ? (
            <Skeleton className="h-9 w-48" />
          ) : user ? (
            `Welcome back, ${user.name.split(" ")[0]}`
          ) : (
            "Welcome"
          )}
        </h1>
      </header>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t load dashboard</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getErrorMessage(error)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : analytics ? (
        <div className="mt-6 space-y-6">
          {/* Executive AI Intelligence Banner */}
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
            <div className="absolute right-0 top-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1">
                    <Sparkles className="size-3 animate-pulse" />
                    AI Workforce Intelligence
                  </Badge>
                  <span className="text-xs text-muted-foreground">Real-time Telemetry</span>
                </div>
                <h3 className="font-heading font-semibold text-lg text-foreground">
                  Executive Briefing & Organizational Health Index
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                  Synthesizes real-time attendance, overtime burnout risks, task throughput, and provides actionable HR strategy memos.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/copilot?tab=executive"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                  )}
                >
                  <Sparkles className="size-3.5 mr-1.5" />
                  Executive Briefing
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Link>
                <Link
                  to="/attendance"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <ShieldAlert className="size-3.5 mr-1.5 text-amber-500" />
                  Burnout Radar
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Shortcuts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <Zap className="size-3 text-amber-500" /> Quick Launch:
            </span>
            <Link
              to="/copilot?tab=1on1"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-xs rounded-full"
              )}
            >
              <Users2 className="size-3.5 mr-1 text-primary" />
              AI 1-on-1 Prep
            </Link>
            <Link
              to={isHead ? "/tasks" : "/admin/tasks"}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-xs rounded-full"
              )}
            >
              <PlusCircle className="size-3.5 mr-1 text-emerald-600" />
              AI Task Breakdown
            </Link>
            <Link
              to={isHead ? "/leaves" : "/admin/leaves"}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-xs rounded-full"
              )}
            >
              <CalendarDays className="size-3.5 mr-1 text-purple-600" />
              Leave Management
            </Link>
            <Link
              to="/performance-reviews"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-xs rounded-full"
              )}
            >
              <TrendingUp className="size-3.5 mr-1 text-blue-600" />
              Performance Reviews
            </Link>
          </div>

          {/* Stats Cards */}
          <StatsCards analytics={analytics} />

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TaskStatusPie analytics={analytics} />
            <AttendancePie analytics={analytics} />
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LeaveByTypeBar analytics={analytics} />
            <DepartmentPerformanceBar analytics={analytics} />
          </div>

          {/* Recent Activity — admin only, not shown to heads */}
          {!isHead && <RecentActivityTable analytics={analytics} />}
        </div>
      ) : null}
    </div>
  );
}

// =========================================================================
// Employee Punch & Quick Actions Card
// =========================================================================

function EmployeePunchCard() {
  const { data: todayData } = useTodayAttendance();
  const punchMutation = useSelfPunch();
  const [elapsed, setElapsed] = useState<number>(0);

  const status = todayData?.status ?? "not_checked_in";
  const checkInTime = todayData?.checkIn;

  useEffect(() => {
    if (status !== "checked_in" || !checkInTime) {
      setElapsed(todayData?.workingSeconds || 0);
      return;
    }

    const startTime = new Date(checkInTime).getTime();
    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setElapsed(diffSec);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [status, checkInTime, todayData?.workingSeconds]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isPunching = punchMutation.isPending;

  return (
    <Card className="border-primary/20 bg-card">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${status === "checked_in"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
                }`}
            >
              <Clock className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Today&apos;s Shift</span>
                {status === "checked_in" ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-xs"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                    Working • {formatTimer(elapsed)}
                  </Badge>
                ) : status === "checked_out" ? (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs"
                  >
                    Completed ({formatTimer(elapsed)})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Not Clocked In
                  </Badge>
                )}
              </div>
              <p className="font-heading font-semibold text-base text-foreground mt-0.5">
                {status === "checked_in"
                  ? "You are currently clocked in and active"
                  : status === "checked_out"
                    ? "Shift completed for today. Great job!"
                    : "Ready to work? Clock in with 1-click"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status !== "checked_in" ? (
              <Button
                onClick={() => punchMutation.mutate({ action: "check_in" })}
                disabled={isPunching}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {isPunching ? (
                  <LoaderCircle className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Clock className="size-4 mr-1.5" />
                )}
                Clock In
              </Button>
            ) : (
              <Button
                onClick={() => punchMutation.mutate({ action: "check_out" })}
                disabled={isPunching}
                variant="destructive"
                className="shadow-sm"
              >
                {isPunching ? (
                  <LoaderCircle className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Clock className="size-4 mr-1.5" />
                )}
                Clock Out
              </Button>
            )}
          </div>
        </div>

        {/* Quick Shortcut Pills */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link
            to="/copilot"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 justify-start text-xs"
            )}
          >
            <Bot className="size-3.5 mr-1.5 text-primary" />
            AI Copilot
          </Link>
          <Link
            to="/tasks"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 justify-start text-xs"
            )}
          >
            <ListTodo className="size-3.5 mr-1.5 text-emerald-600" />
            My Tasks
          </Link>
          <Link
            to="/leaves"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 justify-start text-xs"
            )}
          >
            <CalendarPlus className="size-3.5 mr-1.5 text-purple-600" />
            Request Leave
          </Link>
          <Link
            to="/copilot?tab=1on1"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 justify-start text-xs"
            )}
          >
            <Sparkles className="size-3.5 mr-1.5 text-amber-500" />
            AI 1-on-1 Prep
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Employee Dashboard
// =========================================================================

function EmployeeDashboard() {
  const { isPending: isAuthPending, data: user } = useCurrentUser();
  const {
    data: dashboard,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useEmployeeDashboard();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm text-muted-foreground">My Overview</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground">
          {isAuthPending ? (
            <Skeleton className="h-9 w-48" />
          ) : user ? (
            `Welcome back, ${user.name.split(" ")[0]}`
          ) : (
            "Welcome"
          )}
        </h1>
      </header>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t load dashboard</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getErrorMessage(error)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : dashboard ? (
        <div className="mt-6 space-y-6">
          {/* Quick Punch & Shortcuts Card */}
          <EmployeePunchCard />

          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                  <CalendarCheck className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
                  {dashboard.attendance.rate}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {dashboard.attendance.overview.present + dashboard.attendance.overview.late + dashboard.attendance.overview.half_day} of {dashboard.attendance.workingDays} working days
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Tasks Completed</p>
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
                  {dashboard.tasks.completedCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dashboard.tasks.active.length} active tasks
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Leave Balance</p>
                  <CalendarDays className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
                  {Object.values(dashboard.leaveBalance).reduce((s, b) => s + b.remaining, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  days remaining this year
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Attendance & Leave Balance */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-foreground">Attendance</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">This month</p>
                  </div>
                  <CalendarCheck className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-2">
                  {([
                    ["Present", dashboard.attendance.overview.present, "text-emerald-600"],
                    ["Late", dashboard.attendance.overview.late, "text-amber-600"],
                    ["Absent", dashboard.attendance.overview.absent, "text-destructive"],
                    ["Half Day", dashboard.attendance.overview.half_day, "text-primary"],
                    ["On Leave", dashboard.attendance.overview.on_leave, "text-purple-600"],
                  ] as const).map(([label, count, color]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-sm font-medium ${color}`}>{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-foreground">Leave Balance</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{new Date().getFullYear()}</p>
                  </div>
                  <CalendarDays className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-3">
                  {Object.entries(dashboard.leaveBalance).map(([type, balance]) => (
                    <div key={type}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{type}</span>
                        <span className="font-medium">
                          {balance.remaining}/{balance.total}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${balance.total > 0 ? ((balance.total - balance.remaining) / balance.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Tasks */}
          {dashboard.tasks.active.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-lg font-semibold text-foreground">Active Tasks</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Your pending tasks</p>
                    </div>
                    <ListTodo className="size-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.tasks.active.map((task) => (
                        <TableRow key={task._id}>
                          <TableCell className="text-sm font-medium">
                            {task.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {task.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`capitalize ${task.priority === "urgent"
                                  ? "border-destructive text-destructive"
                                  : task.priority === "high"
                                    ? "border-amber-600 text-amber-600"
                                    : ""
                                }`}
                            >
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
