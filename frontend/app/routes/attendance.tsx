import { useEffect, useState, useMemo, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Flame,
  Globe,
  HeartPulse,
  Laptop,
  Layers,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useDepartmentAttendance,
  useMarkAttendance,
  useMyAttendance,
  useSelfPunch,
  useTodayAttendance,
} from "@/hooks/use-attendance";
import { useAttendanceAnomaly } from "@/hooks/use-copilot";
import { getErrorMessage } from "@/lib/api";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_META,
  endOfMonthString,
  endOfWeekString,
  endOfYearString,
  formatAttendanceDate,
  formatTime,
  getWeekDates,
  getYearMonths,
  startOfMonthString,
  startOfWeekString,
  startOfYearString,
  todayString,
} from "@/lib/attendance";
import type { Attendance, AttendanceStatus } from "@/types";

import type { Route } from "./+types/attendance";

const PAGE_SIZE = 15;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Attendance & Time Records | Employee Management System" }];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

function calculateSecondsWorked(r: Attendance): number {
  if (!r.checkIn || !r.checkOut) return 0;
  const diff = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 1000;
  return diff > 0 ? diff : 0;
}

function exportAttendanceToCsv(records: Attendance[], filenamePrefix = "attendance-records") {
  const headers = ["Date", "Status", "Check In", "Check Out", "Hours Worked", "Marked By", "Notes"];
  const rows = records.map((r) => {
    const sec = calculateSecondsWorked(r);
    const hrs = sec > 0 ? (Math.round((sec / 3600) * 10) / 10).toFixed(1) : "0.0";
    return [
      formatAttendanceDate(r.date),
      r.status,
      r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "",
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "",
      `${hrs}h`,
      typeof r.markedBy === "object" && r.markedBy !== null ? (r.markedBy as { name: string }).name : "Self",
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ];
  });
  const csvContent =
    "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filenamePrefix}-${todayString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===========================================================================
// Main Attendance Page
// ===========================================================================

export default function AttendancePage() {
  const { data: currentUser, isPending: userPending } = useCurrentUser();
  const role = currentUser?.role;
  const isPrivileged = role === "head" || role === "admin";

  if (userPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="size-6" />
            </span>
            Workplace Attendance & Time Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time punch clock, shift stopwatch, multi-horizon logs, and AI burnout anomaly radar.
          </p>
        </div>
      </div>

      {isPrivileged ? (
        <Tabs defaultValue="my-attendance" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="my-attendance" className="flex items-center gap-2 text-xs">
              <Timer className="size-3.5" /> My Punch & Records
            </TabsTrigger>
            <TabsTrigger value="roster" className="flex items-center gap-2 text-xs">
              <Users className="size-3.5" /> Department Roster
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="flex items-center gap-2 text-xs text-primary font-medium">
              <Sparkles className="size-3.5" /> AI Burnout Radar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-attendance" className="space-y-6 pt-2">
            <PunchClockBanner />
            <EmployeeMultiHorizonAttendanceView />
          </TabsContent>

          <TabsContent value="roster" className="space-y-6 pt-2">
            <MarkAttendanceView />
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-6 pt-2">
            <AttendanceAnomalyView />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <PunchClockBanner />
          <EmployeeMultiHorizonAttendanceView />
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Interactive Live Punch Clock & Stopwatch Banner
// ===========================================================================

function PunchClockBanner() {
  const { data: todayData } = useTodayAttendance();
  const punchMutation = useSelfPunch();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [location, setLocation] = useState<"office" | "remote">("office");
  const [quickNote, setQuickNote] = useState("");

  // Live real-time clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live elapsed work stopwatch ticker
  useEffect(() => {
    if (todayData?.status === "checked_in" && todayData.checkIn) {
      const startTime = new Date(todayData.checkIn).getTime();
      const updateElapsed = () => {
        const secs = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        setElapsed(secs);
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    } else if (todayData?.status === "checked_out" && todayData.checkIn && todayData.checkOut) {
      const startTime = new Date(todayData.checkIn).getTime();
      const endTime = new Date(todayData.checkOut).getTime();
      setElapsed(Math.max(0, Math.floor((endTime - startTime) / 1000)));
    } else {
      setElapsed(0);
    }
  }, [todayData]);

  const handlePunch = (action: "check_in" | "check_out") => {
    punchMutation.mutate({
      action,
      location,
      notes: quickNote.trim() || undefined,
    });
    setQuickNote("");
  };

  const isCheckedIn = todayData?.status === "checked_in";
  const isCheckedOut = todayData?.status === "checked_out";
  const isNotCheckedIn = !todayData || todayData.status === "not_checked_in";

  return (
    <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Section 1: Live Digital Clock & Shift Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20 gap-1.5 font-medium">
                <Clock className="size-3.5" /> Live Work Clock
              </Badge>
              {isCheckedIn && (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-pulse">
                  🟢 On Shift
                </Badge>
              )}
              {todayData?.record?.branchName && (
                <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 font-medium text-xs">
                  <MapPin className="size-3" /> {todayData.record.branchName}
                </Badge>
              )}
              {todayData?.record?.isAnomalous && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-medium text-xs">
                  <AlertTriangle className="size-3" /> Unverified IP (Remote)
                </Badge>
              )}
              {isCheckedOut && (
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  🏁 Shift Completed
                </Badge>
              )}
              {isNotCheckedIn && (
                <Badge variant="secondary" className="text-muted-foreground">
                  ⚪ Not Checked In
                </Badge>
              )}
            </div>

            <div>
              <p className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Shift info chips */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded-md bg-muted/60">
                Standard: <strong>9:00 AM - 5:00 PM</strong>
              </span>
              <span className="px-2 py-1 rounded-md bg-muted/60">
                Grace Period: <strong>9:30 AM</strong>
              </span>
            </div>
          </div>

          {/* Section 2: Active Stopwatch / Timer */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-muted/30 text-center">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Timer className="size-4 text-primary" /> Today&apos;s Active Time
            </div>
            <p className="font-heading text-2xl md:text-3xl font-bold text-foreground mt-2 font-mono">
              {formatDuration(elapsed)}
            </p>
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
              <div>
                In:{" "}
                <strong className="text-foreground">
                  {todayData?.checkIn ? formatTime(todayData.checkIn) : "—"}
                </strong>
              </div>
              <div>&bull;</div>
              <div>
                Out:{" "}
                <strong className="text-foreground">
                  {todayData?.checkOut ? formatTime(todayData.checkOut) : "—"}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 3: 1-Click Punch Center */}
          <div className="space-y-3">
            {isNotCheckedIn && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLocation("office")}
                    className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium border transition-colors ${
                      location === "office"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Building className="size-3.5" /> In Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation("remote")}
                    className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium border transition-colors ${
                      location === "remote"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Laptop className="size-3.5" /> Remote / WFH
                  </button>
                </div>

                <Input
                  placeholder="Optional note (e.g. Project focus, travel)..."
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  className="text-xs h-8"
                />

                <Button
                  onClick={() => handlePunch("check_in")}
                  disabled={punchMutation.isPending}
                  className="w-full h-11 text-sm font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md glow-primary"
                >
                  {punchMutation.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Zap className="size-4 fill-white" />
                  )}
                  ⚡ 1-Click Check In Now
                </Button>
              </div>
            )}

            {isCheckedIn && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>
                    Checked in at <strong>{formatTime(todayData.checkIn)}</strong>
                    {todayData.record?.notes ? ` (${todayData.record.notes})` : ""}
                  </span>
                </div>

                <Button
                  variant="destructive"
                  onClick={() => handlePunch("check_out")}
                  disabled={punchMutation.isPending}
                  className="w-full h-11 text-sm font-semibold gap-2 shadow-sm"
                >
                  {punchMutation.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Clock className="size-4" />
                  )}
                  🏁 Check Out for Today
                </Button>
              </div>
            )}

            {isCheckedOut && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> Shift Completed Today
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(todayData.checkIn)} &rarr; {formatTime(todayData.checkOut)} ({formatDuration(elapsed)} logged)
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Employee Multi-Horizon Attendance Records View (Daily, Weekly, Monthly, Yearly)
// ===========================================================================

type TimeHorizon = "daily" | "weekly" | "monthly" | "yearly" | "custom";

function EmployeeMultiHorizonAttendanceView() {
  const [horizon, setHorizon] = useState<TimeHorizon>("monthly");

  // State for Daily Horizon
  const [selectedDay, setSelectedDay] = useState(todayString());

  // State for Weekly Horizon
  const [selectedWeekMonday, setSelectedWeekMonday] = useState(startOfWeekString());

  // State for Monthly Horizon
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());

  // State for Yearly Horizon
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // State for Custom Horizon
  const [customFrom, setCustomFrom] = useState(startOfMonthString());
  const [customTo, setCustomTo] = useState(todayString());

  // Compute active query range based on selected horizon
  const { queryFrom, queryTo } = useMemo(() => {
    if (horizon === "daily") {
      return {
        queryFrom: selectedDay,
        queryTo: selectedDay,
      };
    }
    if (horizon === "weekly") {
      const sundayStr = endOfWeekString(selectedWeekMonday);
      return {
        queryFrom: selectedWeekMonday,
        queryTo: sundayStr,
      };
    }
    if (horizon === "monthly") {
      const from = startOfMonthString(selectedMonthDate);
      const to = endOfMonthString(selectedMonthDate);
      return { queryFrom: from, queryTo: to };
    }
    if (horizon === "yearly") {
      const from = startOfYearString(selectedYear);
      const to = endOfYearString(selectedYear);
      return { queryFrom: from, queryTo: to };
    }
    // Custom
    return {
      queryFrom: customFrom,
      queryTo: customTo,
    };
  }, [horizon, selectedDay, selectedWeekMonday, selectedMonthDate, selectedYear, customFrom, customTo]);

  // Fetch all attendance records in active range (limit 1000 to cover full year)
  const { data, isPending, isError, error, refetch, isRefetching } = useMyAttendance({
    from: queryFrom,
    to: queryTo,
    limit: 1000,
  });

  const allRecords = data?.attendance ?? [];

  // Compute Metrics across active records
  const metrics = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let halfDay = 0;
    let onLeave = 0;
    let totalSeconds = 0;

    for (const r of allRecords) {
      if (r.status === "present") present++;
      else if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
      else if (r.status === "half_day") halfDay++;
      else if (r.status === "on_leave") onLeave++;

      totalSeconds += calculateSecondsWorked(r);
    }

    const attended = present + late + halfDay;
    const rate = allRecords.length > 0 ? Math.round((attended / allRecords.length) * 100) : 100;
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    const avgHoursPerDay = attended > 0 ? Math.round((totalHours / attended) * 10) / 10 : 0;

    return {
      present,
      late,
      absent,
      halfDay,
      onLeave,
      attended,
      rate,
      totalHours,
      avgHoursPerDay,
      totalCount: allRecords.length,
    };
  }, [allRecords]);

  // Quick navigation helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() - 1);
    setSelectedDay(d.toISOString().slice(0, 10));
  };
  const handleNextDay = () => {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + 1);
    setSelectedDay(d.toISOString().slice(0, 10));
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedWeekMonday);
    d.setDate(d.getDate() - 7);
    setSelectedWeekMonday(startOfWeekString(d));
  };
  const handleNextWeek = () => {
    const d = new Date(selectedWeekMonday);
    d.setDate(d.getDate() + 7);
    setSelectedWeekMonday(startOfWeekString(d));
  };

  const handlePrevMonth = () => {
    setSelectedMonthDate(new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setSelectedMonthDate(new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 1));
  };

  const handlePrevYear = () => setSelectedYear((y) => y - 1);
  const handleNextYear = () => setSelectedYear((y) => y + 1);

  return (
    <div className="space-y-6">
      {/* Time Horizon Selector Pills */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <span className="text-sm font-semibold">Attendance Record Horizon</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Switch between Daily, Weekly, Monthly, and Annual summary timeframes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setHorizon("daily")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizon === "daily"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            📅 Daily
          </button>
          <button
            type="button"
            onClick={() => setHorizon("weekly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizon === "weekly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            📆 Weekly
          </button>
          <button
            type="button"
            onClick={() => setHorizon("monthly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizon === "monthly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            🗓️ Monthly
          </button>
          <button
            type="button"
            onClick={() => setHorizon("yearly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizon === "yearly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            📈 Yearly
          </button>
          <button
            type="button"
            onClick={() => setHorizon("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              horizon === "custom"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            🔍 Custom Range
          </button>
        </div>
      </div>

      {/* Date Horizon Navigator Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card">
        {/* Horizon-Specific Navigation Controls */}
        {horizon === "daily" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-xs" onClick={handlePrevDay}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDay(todayString())}
              className="h-8 text-xs"
            >
              Today
            </Button>
            <Button variant="outline" size="icon-xs" onClick={handleNextDay}>
              <ChevronRight className="size-4" />
            </Button>
            <Input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-36 h-8 text-xs font-mono"
            />
            <span className="text-xs font-medium text-muted-foreground hidden md:inline">
              ({formatAttendanceDate(selectedDay)})
            </span>
          </div>
        )}

        {horizon === "weekly" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-xs" onClick={handlePrevWeek}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeekMonday(startOfWeekString())}
              className="h-8 text-xs"
            >
              This Week
            </Button>
            <Button variant="outline" size="icon-xs" onClick={handleNextWeek}>
              <ChevronRight className="size-4" />
            </Button>
            <span className="text-xs font-semibold text-foreground px-2 py-1 bg-muted/60 rounded-md">
              {formatAttendanceDate(selectedWeekMonday)} &rarr; {formatAttendanceDate(endOfWeekString(selectedWeekMonday))}
            </span>
          </div>
        )}

        {horizon === "monthly" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-xs" onClick={handlePrevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonthDate(new Date())}
              className="h-8 text-xs"
            >
              This Month
            </Button>
            <Button variant="outline" size="icon-xs" onClick={handleNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground px-2">
              {selectedMonthDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </span>
          </div>
        )}

        {horizon === "yearly" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-xs" onClick={handlePrevYear}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(new Date().getFullYear())}
              className="h-8 text-xs"
            >
              Current Year
            </Button>
            <Button variant="outline" size="icon-xs" onClick={handleNextYear}>
              <ChevronRight className="size-4" />
            </Button>
            <Select value={String(selectedYear)} onValueChange={(val) => val && setSelectedYear(Number(val))}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    Year {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {horizon === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">From:</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-36 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">To:</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-36 h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Global Export CSV Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAttendanceToCsv(allRecords, `attendance-${horizon}`)}
            disabled={allRecords.length === 0}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="size-3.5" /> Export {horizon.charAt(0).toUpperCase() + horizon.slice(1)} CSV
          </Button>
        </div>
      </div>

      {/* Horizon-Agnostic Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/70 p-4 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Attendance Rate</span>
            <Flame className="size-3.5 text-emerald-500" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.rate}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.present + metrics.late} of {metrics.totalCount} logged days
          </p>
        </Card>

        <Card className="border-border/70 p-4 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Days Present</span>
            <CheckCircle2 className="size-3.5 text-primary" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-foreground font-mono">
            {metrics.present}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.late > 0 ? `${metrics.late} late arrival` : "100% on time"}
          </p>
        </Card>

        <Card className="border-border/70 p-4 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Hours Logged</span>
            <Timer className="size-3.5 text-primary" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-primary font-mono">
            {metrics.totalHours}h
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Avg {metrics.avgHoursPerDay}h / attended day
          </p>
        </Card>

        <Card className="border-border/70 p-4 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Leaves & Absences</span>
            <CalendarDays className="size-3.5 text-muted-foreground" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-muted-foreground font-mono">
            {metrics.onLeave + metrics.absent}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.onLeave} leave &bull; {metrics.absent} absent
          </p>
        </Card>
      </div>

      {/* Main Horizon Content Renderers */}
      {isPending ? (
        <AttendanceTableSkeleton />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t load attendance records</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getErrorMessage(error)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {horizon === "daily" && (
            <DailyAttendanceDetailView selectedDay={selectedDay} records={allRecords} />
          )}

          {horizon === "weekly" && (
            <WeeklyAttendanceGridView
              mondayStr={selectedWeekMonday}
              records={allRecords}
            />
          )}

          {horizon === "monthly" && (
            <MonthlyAttendanceView
              monthDate={selectedMonthDate}
              records={allRecords}
            />
          )}

          {horizon === "yearly" && (
            <YearlyAttendanceView
              year={selectedYear}
              records={allRecords}
            />
          )}

          {horizon === "custom" && (
            <CustomRangeAttendanceView records={allRecords} />
          )}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Horizon 1: Daily Attendance Detail View
// ===========================================================================

function DailyAttendanceDetailView({
  selectedDay,
  records,
}: {
  selectedDay: string;
  records: Attendance[];
}) {
  const dayRecord = records.find((r) => {
    const dStr = new Date(r.date).toISOString().slice(0, 10);
    return dStr === selectedDay;
  });

  const isToday = selectedDay === todayString();
  const dateObj = new Date(selectedDay + "T00:00:00.000Z");
  const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;

  const secondsWorked = dayRecord ? calculateSecondsWorked(dayRecord) : 0;
  const hoursWorked = Math.round((secondsWorked / 3600) * 10) / 10;
  const targetHours = 8.0;
  const progressPercent = Math.min(100, Math.round((hoursWorked / targetHours) * 100));

  return (
    <div className="space-y-6">
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardHeader className="p-6 border-b border-border/60 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-background">
                {dayOfWeek}
              </Badge>
              {isToday && (
                <Badge className="bg-primary/10 text-primary border-primary/20">Today</Badge>
              )}
              {isWeekend && (
                <Badge variant="secondary" className="text-muted-foreground">Weekend</Badge>
              )}
            </div>
            <CardTitle className="text-xl font-bold mt-2">
              {formatAttendanceDate(selectedDay)}
            </CardTitle>
            <CardDescription className="text-xs">
              Daily timecard, punch verification, and shift progress.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            {dayRecord ? (
              <Badge
                variant={ATTENDANCE_STATUS_META[dayRecord.status].variant}
                className="text-sm px-3 py-1 font-semibold"
              >
                {ATTENDANCE_STATUS_META[dayRecord.status].label}
              </Badge>
            ) : isWeekend ? (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                🌴 Weekend Day
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">
                ⚪ No Record Logged
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Shift Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/60 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-emerald-600" /> Check In Time
              </span>
              <p className="text-xl font-bold mt-1 text-foreground">
                {dayRecord?.checkIn ? formatTime(dayRecord.checkIn) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {dayRecord?.checkIn ? "Recorded at workstation" : "No punch recorded"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-blue-600" /> Check Out Time
              </span>
              <p className="text-xl font-bold mt-1 text-foreground">
                {dayRecord?.checkOut ? formatTime(dayRecord.checkOut) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {dayRecord?.checkOut ? "Shift ended" : isToday ? "Active / In Progress" : "No punch"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="size-3.5 text-primary" /> Total Working Time
              </span>
              <p className="text-xl font-bold mt-1 text-primary font-mono">
                {secondsWorked > 0 ? formatDuration(secondsWorked) : "00h 00m 00s"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {hoursWorked}h logged ({progressPercent}% of 8h goal)
              </p>
            </div>
          </div>

          {/* 8-Hour Target Progress Gauge */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-primary" /> Shift Completion Target (8.0 Hours)
              </span>
              <span className="font-mono font-semibold text-foreground">
                {hoursWorked}h / 8.0h ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-2.5" />
          </div>

          {/* Day Note & Audit Details */}
          {dayRecord && (
            <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Record Details & Notes
              </p>
              <p className="text-sm text-foreground">
                {dayRecord.notes ? dayRecord.notes : "No special notes logged for this shift."}
              </p>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                Marked by:{" "}
                <strong>
                  {typeof dayRecord.markedBy === "object" && dayRecord.markedBy !== null
                    ? (dayRecord.markedBy as { name: string }).name
                    : "Self"}
                </strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Horizon 2: Weekly Attendance Grid View (7-Day Matrix)
// ===========================================================================

function WeeklyAttendanceGridView({
  mondayStr,
  records,
}: {
  mondayStr: string;
  records: Attendance[];
}) {
  const weekDays = useMemo(() => getWeekDates(mondayStr), [mondayStr]);

  const recordMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const r of records) {
      const dStr = new Date(r.date).toISOString().slice(0, 10);
      map.set(dStr, r);
    }
    return map;
  }, [records]);

  // Chart data for weekly hours
  const weeklyChartData = weekDays.map((d) => {
    const rec = recordMap.get(d.dateStr);
    const sec = rec ? calculateSecondsWorked(rec) : 0;
    const hrs = Math.round((sec / 3600) * 10) / 10;
    return {
      day: d.shortDay,
      date: d.dateStr,
      hours: hrs,
      status: rec?.status ?? (d.isWeekend ? "weekend" : "no_record"),
    };
  });

  return (
    <div className="space-y-6">
      {/* 7-Day Interactive Visual Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const rec = recordMap.get(day.dateStr);
          const sec = rec ? calculateSecondsWorked(rec) : 0;
          const hrs = Math.round((sec / 3600) * 10) / 10;
          const target = 8.0;
          const pct = Math.min(100, Math.round((hrs / target) * 100));

          let bgStyle = "border-border/60 bg-card";
          if (day.isToday) bgStyle = "border-primary ring-2 ring-primary/40 bg-card";
          else if (day.isWeekend) bgStyle = "border-border/40 bg-muted/20 opacity-80";

          return (
            <Card key={day.dateStr} className={`p-3.5 flex flex-col justify-between space-y-3 transition-all ${bgStyle}`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{day.shortDay}</span>
                  <span className="text-xs font-bold font-mono">{day.dayNumber}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{day.dateStr.slice(5)}</p>

                <div className="mt-2.5">
                  {rec ? (
                    <Badge variant={ATTENDANCE_STATUS_META[rec.status].variant} className="text-[10px] px-1.5 py-0.5">
                      {ATTENDANCE_STATUS_META[rec.status].label}
                    </Badge>
                  ) : day.isWeekend ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                      Weekend
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                      No Record
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40 text-[11px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>In:</span>
                  <span className="font-medium text-foreground">{rec?.checkIn ? formatTime(rec.checkIn) : "—"}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Out:</span>
                  <span className="font-medium text-foreground">{rec?.checkOut ? formatTime(rec.checkOut) : "—"}</span>
                </div>
                <div className="flex items-center justify-between font-mono font-semibold pt-1 text-primary">
                  <span>Time:</span>
                  <span>{hrs}h</span>
                </div>
                <Progress value={pct} className="h-1.5 mt-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Weekly Hours Bar Chart */}
      <Card className="border-border/80">
        <CardHeader className="py-4 px-6 border-b border-border/60">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Weekly Work Hours Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Daily hours logged against the standard 8.0h work shift.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 12]} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as { day: string; date: string; hours: number; status: string };
                      return (
                        <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{item.day} ({item.date})</p>
                          <p className="text-primary font-mono font-bold mt-1">{item.hours} hours logged</p>
                          <p className="text-muted-foreground capitalize">Status: {item.status.replace("_", " ")}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hours" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Detailed Table */}
      <AttendanceRecordsTable records={records} />
    </div>
  );
}

// ===========================================================================
// Horizon 3: Monthly Attendance View (Calendar Heatmap + Trend + Table)
// ===========================================================================

function MonthlyAttendanceView({
  monthDate,
  records,
}: {
  monthDate: Date;
  records: Attendance[];
}) {
  const [viewMode, setViewMode] = useState<"calendar" | "chart" | "table">("calendar");

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthName = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfWeek + 6) % 7; // Monday = 0

  const recordMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const r of records) {
      const dStr = new Date(r.date).toISOString().slice(0, 10);
      map.set(dStr, r);
    }
    return map;
  }, [records]);

  // Prepare monthly daily trend chart data
  const monthlyChartData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const rec = recordMap.get(dateStr);
      const sec = rec ? calculateSecondsWorked(rec) : 0;
      const hrs = Math.round((sec / 3600) * 10) / 10;
      return {
        day: String(dayNum),
        dateStr,
        hours: hrs,
        status: rec?.status ?? "no_record",
      };
    });
  }, [daysInMonth, year, month, recordMap]);

  return (
    <div className="space-y-6">
      {/* View Mode Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <h2 className="text-base font-semibold tracking-tight">{monthName} Overview</h2>
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "calendar" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📅 Calendar Heatmap
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "chart" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 Daily Hours Chart
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Records Table
          </button>
        </div>
      </div>

      {viewMode === "calendar" && (
        <Card className="border-border/80">
          <CardHeader className="py-4 px-6 border-b border-border/60">
            <CardTitle className="text-base font-semibold">{monthName} Attendance Calendar</CardTitle>
            <CardDescription className="text-xs">
              Color-coded status heatmap of your daily shifts and punch records.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground pb-2 border-b border-border/40">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty offset days */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 rounded-lg bg-muted/10 border border-transparent" />
              ))}

              {/* Actual days */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const record = recordMap.get(dateStr);
                const isToday = dateStr === todayString();

                const dateObj = new Date(year, month, day);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                let badgeClass = "bg-muted/30 text-muted-foreground border-border/40";
                let statusText = isWeekend ? "Weekend" : "No record";

                if (record) {
                  if (record.status === "present") {
                    badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
                    statusText = "Present";
                  } else if (record.status === "late") {
                    badgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
                    statusText = "Late Arrival";
                  } else if (record.status === "absent") {
                    badgeClass = "bg-destructive/15 text-destructive border-destructive/30";
                    statusText = "Absent";
                  } else if (record.status === "half_day") {
                    badgeClass = "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
                    statusText = "Half Day";
                  } else if (record.status === "on_leave") {
                    badgeClass = "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
                    statusText = "On Leave";
                  }
                }

                return (
                  <div
                    key={day}
                    className={`h-20 p-2 rounded-xl border flex flex-col justify-between transition-all hover:shadow-xs ${
                      isToday ? "ring-2 ring-primary border-primary/50" : ""
                    } ${badgeClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>
                        {day}
                      </span>
                      {isToday && (
                        <span className="text-[10px] px-1 rounded bg-primary text-primary-foreground font-medium">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] truncate font-medium">
                      {statusText}
                    </div>

                    <div className="text-[10px] text-muted-foreground truncate">
                      {record?.checkIn ? formatTime(record.checkIn) : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border/40 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Present
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" /> Late
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-destructive" /> Absent
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-blue-500" /> Half Day
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-purple-500" /> On Leave
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "chart" && (
        <Card className="border-border/80">
          <CardHeader className="py-4 px-6 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Daily Logged Hours in {monthName}
            </CardTitle>
            <CardDescription className="text-xs">
              Visual histogram of daily shift hours throughout the month.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 12]} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as { dateStr: string; hours: number; status: string };
                        return (
                          <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs">
                            <p className="font-semibold text-foreground">{item.dateStr}</p>
                            <p className="text-primary font-mono font-bold mt-1">{item.hours} hours logged</p>
                            <p className="text-muted-foreground capitalize">Status: {item.status.replace("_", " ")}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "table" && <AttendanceRecordsTable records={records} />}
    </div>
  );
}

// ===========================================================================
// Horizon 4: Yearly Attendance View (12-Month Annual Horizon)
// ===========================================================================

function YearlyAttendanceView({
  year,
  records,
}: {
  year: number;
  records: Attendance[];
}) {
  const monthsList = useMemo(() => getYearMonths(year), [year]);

  // Calculate per-month aggregations
  const monthlyStats = useMemo(() => {
    return monthsList.map((m) => {
      const monthPrefix = `${year}-${String(m.monthIndex + 1).padStart(2, "0")}`;
      const monthRecords = records.filter((r) => {
        const dStr = new Date(r.date).toISOString().slice(0, 7);
        return dStr === monthPrefix;
      });

      let present = 0;
      let late = 0;
      let absent = 0;
      let halfDay = 0;
      let onLeave = 0;
      let totalSec = 0;

      for (const r of monthRecords) {
        if (r.status === "present") present++;
        else if (r.status === "late") late++;
        else if (r.status === "absent") absent++;
        else if (r.status === "half_day") halfDay++;
        else if (r.status === "on_leave") onLeave++;

        totalSec += calculateSecondsWorked(r);
      }

      const attended = present + late + halfDay;
      const rate = monthRecords.length > 0 ? Math.round((attended / monthRecords.length) * 100) : 0;
      const hours = Math.round((totalSec / 3600) * 10) / 10;

      return {
        ...m,
        present,
        late,
        absent,
        halfDay,
        onLeave,
        attended,
        totalRecords: monthRecords.length,
        rate,
        hours,
      };
    });
  }, [monthsList, records, year]);

  return (
    <div className="space-y-6">
      {/* Annual Summary Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Year {year} Annual Attendance Summary</h2>
          <p className="text-xs text-muted-foreground">
            Complete 12-month performance, working hours, and annual attendance rates.
          </p>
        </div>
      </div>

      {/* 12-Month Annual Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthlyStats.map((m) => {
          const hasData = m.totalRecords > 0;
          return (
            <Card key={m.monthIndex} className="p-4 border-border/70 flex flex-col justify-between space-y-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{m.monthName}</span>
                  {hasData ? (
                    <Badge variant={m.rate >= 90 ? "default" : "secondary"} className="text-xs font-mono font-bold">
                      {m.rate}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      No Records
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono font-medium">
                  {m.hours}h logged &bull; {m.present} days present
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Late Arrivals:</span>
                  <span className="font-medium text-foreground">{m.late}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Leaves Taken:</span>
                  <span className="font-medium text-foreground">{m.onLeave}</span>
                </div>
                <Progress value={m.rate} className="h-1.5 mt-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Annual Monthly Hours Bar Chart */}
      <Card className="border-border/80">
        <CardHeader className="py-4 px-6 border-b border-border/60">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Annual Hours Logged Across {year}
          </CardTitle>
          <CardDescription className="text-xs">
            Comparison of monthly total hours worked from January to December.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="shortName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as { monthName: string; hours: number; rate: number; present: number };
                      return (
                        <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{item.monthName} {year}</p>
                          <p className="text-primary font-mono font-bold mt-1">{item.hours} hours logged</p>
                          <p className="text-muted-foreground">Attendance Rate: {item.rate}%</p>
                          <p className="text-muted-foreground">Days Present: {item.present}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hours" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Full Annual Table */}
      <AttendanceRecordsTable records={records} />
    </div>
  );
}

// ===========================================================================
// Horizon 5: Custom Date Range View
// ===========================================================================

function CustomRangeAttendanceView({
  records,
}: {
  records: Attendance[];
}) {
  return (
    <div className="space-y-6">
      <AttendanceRecordsTable records={records} />
    </div>
  );
}

// ===========================================================================
// Reusable Full Attendance Records Table with Search & Status Filter
// ===========================================================================

function AttendanceRecordsTable({ records }: { records: Attendance[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const dateFormatted = formatAttendanceDate(r.date).toLowerCase();
      const notes = (r.notes || "").toLowerCase();
      const matchesSearch = dateFormatted.includes(searchTerm.toLowerCase()) || notes.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const total = filteredRecords.length;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  return (
    <div className="space-y-4">
      {/* Table Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="size-3" /> Filter:
          </span>
          <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
            <SelectTrigger className="w-36 h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ATTENDANCE_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>
                  {ATTENDANCE_STATUS_LABELS[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search date or notes..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="h-7 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {total > 0 ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Working Time</TableHead>
                    <TableHead>Marked By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => {
                    const sec = calculateSecondsWorked(record);
                    const durationText = sec > 0 ? formatDuration(sec) : "—";

                    return (
                      <TableRow key={record._id}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {formatAttendanceDate(record.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ATTENDANCE_STATUS_META[record.status].variant}>
                            {ATTENDANCE_STATUS_META[record.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatTime(record.checkIn)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatTime(record.checkOut)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                          {durationText}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {typeof record.markedBy === "object" && record.markedBy !== null
                            ? (record.markedBy as { name: string }).name
                            : "Self"}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-muted-foreground truncate">
                          {record.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No attendance records found</EmptyTitle>
            <EmptyDescription>
              No records match your selected date horizon or active filters.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {total > PAGE_SIZE && (
        <DataTablePagination
          page={currentPage}
          limit={PAGE_SIZE}
          total={total}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Head / Admin View: Department Roster & Bulk Marking
// ===========================================================================

function MarkAttendanceView() {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const today = todayString();

  const { data, isPending, isError, error, refetch, isRefetching } = useDepartmentAttendance({
    date: selectedDate,
  });

  const members = data?.members ?? [];
  const existingRecords = data?.attendance ?? [];

  const recordMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const record of existingRecords) {
      const userId = typeof record.user === "string" ? record.user : record.user._id;
      map.set(userId, record);
    }
    return map;
  }, [existingRecords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Department Attendance Roster
          </h2>
          <p className="text-xs text-muted-foreground">
            Select a date to view and batch-record attendance for team members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="mark-date" className="text-xs text-muted-foreground">Date:</Label>
          <Input
            id="mark-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={today}
            className="w-40 h-8 text-xs font-mono"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(today)}
            className="h-8 text-xs"
          >
            Today
          </Button>
        </div>
      </div>

      <div>
        {isPending ? (
          <AttendanceTableSkeleton />
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t load department members</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {getErrorMessage(error)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : members.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarCheck />
              </EmptyMedia>
              <EmptyTitle>No department members found</EmptyTitle>
              <EmptyDescription>
                You don&apos;t have any department members assigned to mark attendance for.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <MarkAttendanceTable members={members} recordMap={recordMap} date={selectedDate} />
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Editable Batch Attendance Table
// ===========================================================================

interface Member {
  _id: string;
  name: string;
  email: string;
}

function MarkAttendanceTable({
  members,
  recordMap,
  date,
}: {
  members: Member[];
  recordMap: Map<string, Attendance>;
  date: string;
}) {
  const markAttendance = useMarkAttendance();
  const [searchTerm, setSearchTerm] = useState("");

  const [rows, setRows] = useState<
    Array<{
      userId: string;
      name: string;
      email: string;
      status: AttendanceStatus;
      checkIn: string;
      checkOut: string;
      notes: string;
      existingId?: string;
    }>
  >([]);

  useEffect(() => {
    setRows(
      members.map((member) => {
        const existing = recordMap.get(member._id);
        return {
          userId: member._id,
          name: member.name,
          email: member.email,
          status: existing?.status ?? "present",
          checkIn: existing?.checkIn ? new Date(existing.checkIn).toISOString().slice(0, 16) : "",
          checkOut: existing?.checkOut ? new Date(existing.checkOut).toISOString().slice(0, 16) : "",
          notes: existing?.notes ?? "",
          existingId: existing?._id,
        };
      })
    );
  }, [members, recordMap]);

  function updateRow(userId: string, field: string, value: string) {
    setRows((prev) => prev.map((row) => (row.userId === userId ? { ...row, [field]: value } : row)));
  }

  // Quick Action: Mark all present
  function handleMarkAllPresent() {
    setRows((prev) => prev.map((row) => ({ ...row, status: "present" })));
  }

  // Quick Action: Autofill standard 9am-5pm times
  function handleAutofillTimes() {
    const checkInVal = `${date}T09:00`;
    const checkOutVal = `${date}T17:00`;
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        checkIn: row.checkIn || checkInVal,
        checkOut: row.checkOut || checkOutVal,
      }))
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    markAttendance.mutate({
      date,
      records: rows.map((row) => ({
        userId: row.userId,
        status: row.status,
        ...(row.checkIn ? { checkIn: new Date(row.checkIn).toISOString() } : {}),
        ...(row.checkOut ? { checkOut: new Date(row.checkOut).toISOString() } : {}),
        ...(row.notes ? { notes: row.notes } : {}),
      })),
    });
  }

  const filteredRows = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Status counters
  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let halfDay = 0;
    let onLeave = 0;
    for (const r of rows) {
      if (r.status === "present") present++;
      else if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
      else if (r.status === "half_day") halfDay++;
      else if (r.status === "on_leave") onLeave++;
    }
    return { present, late, absent, halfDay, onLeave };
  }, [rows]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Power Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            ⚡ Quick Actions:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllPresent}
            className="h-7 text-xs gap-1 bg-background"
          >
            <Check className="size-3 text-emerald-600" /> Mark All Present
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofillTimes}
            className="h-7 text-xs gap-1 bg-background"
          >
            <Clock className="size-3 text-primary" /> Auto-fill 9 AM - 5 PM
          </Button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Status summary pill */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
          Present: {counts.present}
        </Badge>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
          Late: {counts.late}
        </Badge>
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          Absent: {counts.absent}
        </Badge>
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
          Half Day: {counts.halfDay}
        </Badge>
        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
          On Leave: {counts.onLeave}
        </Badge>
      </div>

      {/* Roster Table */}
      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(value) => value && updateRow(row.userId, "status", value)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDANCE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {ATTENDANCE_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        value={row.checkIn}
                        onChange={(e) => updateRow(row.userId, "checkIn", e.target.value)}
                        className="w-44 h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        value={row.checkOut}
                        onChange={(e) => updateRow(row.userId, "checkOut", e.target.value)}
                        className="w-44 h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRow(row.userId, "notes", e.target.value)}
                        placeholder="Notes..."
                        className="min-w-32 h-8 text-xs"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer Submit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} team member{rows.length === 1 ? "" : "s"} &bull; {formatAttendanceDate(date)}
        </p>
        <Button type="submit" disabled={markAttendance.isPending} className="gap-2 shadow-sm">
          {markAttendance.isPending ? <LoaderCircle className="animate-spin size-4" /> : <Save className="size-4" />}
          {markAttendance.isPending ? "Saving Records…" : "Save All Attendance"}
        </Button>
      </div>

      {markAttendance.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t save attendance</AlertTitle>
          <AlertDescription>{getErrorMessage(markAttendance.error)}</AlertDescription>
        </Alert>
      )}

      {markAttendance.isSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CalendarCheck className="size-4" />
          <AlertTitle>Attendance successfully saved</AlertTitle>
          <AlertDescription>
            Recorded attendance for {markAttendance.data.count} team member{markAttendance.data.count === 1 ? "" : "s"}.
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}

// ===========================================================================
// Skeleton Loader
// ===========================================================================

function AttendanceTableSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading attendance">
      <CardContent className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// 🚨 AI Attendance Anomaly & Burnout Radar View
// ===========================================================================

function AttendanceAnomalyView() {
  const anomalyQuery = useAttendanceAnomaly();

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Scanned Timecards</p>
              <p className="text-2xl font-bold mt-1 font-mono text-foreground">
                {anomalyQuery.data?.totalScanned || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-destructive">Overtime Burnout Risk</p>
              <p className="text-2xl font-bold text-destructive mt-1 font-mono">
                {anomalyQuery.data?.burnoutRisksCount || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Late Check-in Variances</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {anomalyQuery.data?.frequentLateCount || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Unclosed Timecards</p>
              <p className="text-2xl font-bold mt-1 font-mono text-foreground">
                {anomalyQuery.data?.missingCheckoutsCount || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted text-muted-foreground">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly list */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Workforce Attendance Anomaly Intelligence
              </CardTitle>
              <CardDescription className="text-xs">
                Analyzes 30-day shift logs for fatigue patterns, abnormal variances, and suggests restorative interventions.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => anomalyQuery.refetch()}
              disabled={anomalyQuery.isFetching}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${anomalyQuery.isFetching ? "animate-spin" : ""}`} />
              <span>Rescan</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {anomalyQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Scanning timecard signals & attendance variances...
            </div>
          ) : !anomalyQuery.data?.anomalies.length ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-foreground">Zero Critical Attendance Anomalies</p>
              <p className="text-xs text-muted-foreground">
                Workforce hours and check-in times are stable and aligned with standard working policies.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalyQuery.data.anomalies.map((anom, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-border/60 hover:border-border transition-all bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{anom.name}</span>
                      <span className="text-xs text-muted-foreground">({anom.email})</span>
                      {anom.type === "overtime_burnout" && (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px]">
                          🚨 Overtime Burnout Risk
                        </Badge>
                      )}
                      {anom.type === "frequent_late" && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                          ⏱️ Frequent Late Check-ins
                        </Badge>
                      )}
                      {anom.type === "missing_checkouts" && (
                        <Badge variant="outline" className="text-[11px]">
                          📝 Missing Punch-Outs
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground/90">{anom.description}</p>
                  </div>

                  <div className="md:text-right max-w-sm rounded-lg bg-muted/40 p-2.5 border border-border/40">
                    <p className="text-[11px] font-semibold text-primary flex items-center gap-1 md:justify-end">
                      <Sparkles className="size-3" /> Recommended Action:
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{anom.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

