import type { AttendanceStatus } from "@/types";

/** Fixed attendance statuses — mirrors the backend enum. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "half_day",
  "on_leave",
];

/** Human-readable labels for each attendance status. */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "On Leave",
};

/**
 * Badge variant and display metadata for each attendance status.
 * Uses shadcn badge variant names for consistent styling.
 */
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; colorClass: string; bgClass: string; borderClass: string }
> = {
  present: {
    label: "Present",
    variant: "default",
    colorClass: "text-emerald-700 dark:text-emerald-400",
    bgClass: "bg-emerald-500/15",
    borderClass: "border-emerald-500/30",
  },
  absent: {
    label: "Absent",
    variant: "destructive",
    colorClass: "text-red-700 dark:text-red-400",
    bgClass: "bg-red-500/15",
    borderClass: "border-red-500/30",
  },
  late: {
    label: "Late Arrival",
    variant: "secondary",
    colorClass: "text-amber-700 dark:text-amber-400",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/30",
  },
  half_day: {
    label: "Half Day",
    variant: "outline",
    colorClass: "text-blue-700 dark:text-blue-400",
    bgClass: "bg-blue-500/15",
    borderClass: "border-blue-500/30",
  },
  on_leave: {
    label: "On Leave",
    variant: "secondary",
    colorClass: "text-purple-700 dark:text-purple-400",
    bgClass: "bg-purple-500/15",
    borderClass: "border-purple-500/30",
  },
};

/** Formats a date string (YYYY-MM-DD or ISO) for display. */
export function formatAttendanceDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T00:00:00.000Z") : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats a time string or ISO datetime for display (e.g. "9:00 AM"). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Returns today's date as YYYY-MM-DD in local time. */
export function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the first day of the current month as YYYY-MM-DD. */
export function startOfMonthString(dateInput?: Date | string): string {
  const d = dateInput ? (typeof dateInput === "string" ? new Date(dateInput) : dateInput) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Returns the last day of the month as YYYY-MM-DD. */
export function endOfMonthString(dateInput?: Date | string): string {
  const d = dateInput ? (typeof dateInput === "string" ? new Date(dateInput) : dateInput) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Returns the start of the week (Monday) as YYYY-MM-DD. */
export function startOfWeekString(dateInput?: Date | string): string {
  const d = dateInput ? (typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput)) : new Date();
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const dateStr = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateStr}`;
}

/** Returns the end of the week (Sunday) as YYYY-MM-DD. */
export function endOfWeekString(dateInput?: Date | string): string {
  const mondayStr = startOfWeekString(dateInput);
  const monday = new Date(mondayStr);
  monday.setDate(monday.getDate() + 6);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const dateStr = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateStr}`;
}

/** Returns the start of the year as YYYY-01-01. */
export function startOfYearString(yearInput?: number | string): string {
  const year = yearInput ? Number(yearInput) : new Date().getFullYear();
  return `${year}-01-01`;
}

/** Returns the end of the year as YYYY-12-31. */
export function endOfYearString(yearInput?: number | string): string {
  const year = yearInput ? Number(yearInput) : new Date().getFullYear();
  return `${year}-12-31`;
}

/** Returns 7 days metadata of the week given a Monday date string. */
export function getWeekDates(mondayDateStr: string): Array<{
  dateStr: string;
  dayName: string;
  shortDay: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}> {
  const base = new Date(`${mondayDateStr}T00:00:00.000Z`);
  const today = todayString();
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return Array.from({ length: 7 }, (_, i) => {
    const current = new Date(base.getTime() + i * 86_400_000);
    const dateStr = current.toISOString().slice(0, 10);
    return {
      dateStr,
      dayName: dayNames[i],
      shortDay: shortDays[i],
      dayNumber: current.getUTCDate(),
      isToday: dateStr === today,
      isWeekend: i >= 5,
    };
  });
}

/** Returns 12 months metadata for annual views. */
export function getYearMonths(year: number): Array<{
  monthIndex: number;
  monthName: string;
  shortName: string;
  startDate: string;
  endDate: string;
}> {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const shortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return Array.from({ length: 12 }, (_, i) => {
    const start = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, i + 1, 0).getDate();
    const end = `${year}-${String(i + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return {
      monthIndex: i,
      monthName: monthNames[i],
      shortName: shortNames[i],
      startDate: start,
      endDate: end,
    };
  });
}
