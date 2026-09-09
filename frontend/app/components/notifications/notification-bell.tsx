import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CircleCheck,
  Filter,
  LoaderCircle,
  Megaphone,
  MessageSquareText,
  PartyPopper,
  Radio,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useNotificationSSE,
  useUnreadCount,
} from "@/hooks/use-notifications";
import { getErrorMessage } from "@/lib/api";
import type { Notification, NotificationType } from "@/types";

const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  leave_approved: PartyPopper,
  leave_rejected: XCircle,
  feedback_responded: MessageSquareText,
  announcement_created: Megaphone,
  review_assigned: ClipboardList,
  review_acknowledged: CheckCircle2,
  task_assigned: ClipboardList,
  task_completed: ClipboardCheck,
  task_approved: CircleCheck,
  task_rejected: XCircle,
};

const NOTIFICATION_ICON_COLORS: Record<NotificationType, string> = {
  leave_approved: "text-emerald-500 bg-emerald-500/10",
  leave_rejected: "text-rose-500 bg-rose-500/10",
  feedback_responded: "text-sky-500 bg-sky-500/10",
  announcement_created: "text-amber-500 bg-amber-500/10",
  review_assigned: "text-purple-500 bg-purple-500/10",
  review_acknowledged: "text-emerald-500 bg-emerald-500/10",
  task_assigned: "text-blue-500 bg-blue-500/10",
  task_completed: "text-indigo-500 bg-indigo-500/10",
  task_approved: "text-emerald-500 bg-emerald-500/10",
  task_rejected: "text-rose-500 bg-rose-500/10",
};

type CategoryFilter = "all" | "unread" | "tasks" | "leaves" | "announcements" | "reviews";

const FILTER_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "tasks", label: "Tasks" },
  { id: "leaves", label: "Leaves" },
  { id: "announcements", label: "Announce" },
  { id: "reviews", label: "Reviews" },
];

/**
 * Bell icon with unread count badge. Clicking opens a rich real-time popover panel
 * featuring live stream status, category tabs, mark all read, and quick actions.
 */
export function NotificationBell() {
  const { data: unreadData, isPending: unreadPending } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative rounded-full hover:bg-muted/80 transition-colors"
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-4 text-foreground" />
        {unreadPending ? null : unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-bold text-destructive-foreground animate-in zoom-in shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0 shadow-xl border-border/80">
        <NotificationPanel />
      </PopoverContent>
    </Popover>
  );
}

/** The dropdown panel content. */
function NotificationPanel() {
  const navigate = useNavigate();
  const { status } = useNotificationSSE();
  const [activeTab, setActiveTab] = useState<CategoryFilter>("all");

  const {
    data,
    isPending,
    isError,
    error,
  } = useNotifications({ limit: 40 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.notifications ?? [];
  const unreadTotal = notifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === "unread") return !n.read;
      if (activeTab === "tasks") {
        return ["task_assigned", "task_completed", "task_approved", "task_rejected"].includes(n.type);
      }
      if (activeTab === "leaves") {
        return ["leave_approved", "leave_rejected"].includes(n.type);
      }
      if (activeTab === "announcements") {
        return n.type === "announcement_created";
      }
      if (activeTab === "reviews") {
        return ["review_assigned", "review_acknowledged", "feedback_responded"].includes(n.type);
      }
      return true;
    });
  }, [notifications, activeTab]);

  function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      markAsRead.mutate(notification._id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  }

  function handleIndividualMarkRead(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    markAsRead.mutate(id);
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <PopoverHeader className="flex flex-col gap-2 border-b border-border/60 p-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PopoverTitle className="text-sm font-bold tracking-tight">Notifications</PopoverTitle>
            {/* Live SSE status indicator */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                status === "connected"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : status === "connecting"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
              title={`Real-time status: ${status}`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  status === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : status === "connecting"
                    ? "bg-amber-500 animate-ping"
                    : "bg-muted-foreground"
                }`}
              />
              {status === "connected" ? "Live" : status === "connecting" ? "Syncing" : "Offline"}
            </span>
          </div>

          {unreadTotal > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.id === "unread" && unreadTotal > 0 && (
                <span className="ml-1 px-1 rounded-full text-[9px] bg-destructive text-destructive-foreground font-bold">
                  {unreadTotal}
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverHeader>

      {/* Notifications list */}
      <ScrollArea className="h-[340px]">
        {isPending ? (
          <NotificationListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-xs text-muted-foreground">
              {getErrorMessage(error)}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center space-y-2">
            <div className="p-3 rounded-full bg-muted/60 text-muted-foreground/60">
              <Bell className="size-6" />
            </div>
            <p className="text-xs font-semibold text-foreground">No {activeTab !== "all" ? activeTab : ""} notifications</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px]">
              {activeTab === "unread" ? "You have caught up with all activity!" : "New updates and alerts will show up here in real-time."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onMarkRead={(e) => handleIndividualMarkRead(e, notification._id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function NotificationItem({
  notification,
  onClick,
  onMarkRead,
}: {
  notification: Notification;
  onClick: () => void;
  onMarkRead: (e: React.MouseEvent) => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const colorClass = NOTIFICATION_ICON_COLORS[notification.type] || "text-primary bg-primary/10";

  const relativeTime = useMemo(
    () => formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }),
    [notification.createdAt]
  );

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`group relative flex w-full items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-muted/40 ${
        !notification.read ? "bg-primary/[0.04]" : ""
      }`}
    >
      <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg p-1.5 ${colorClass}`}>
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-semibold leading-tight truncate ${!notification.read ? "text-foreground font-bold" : "text-foreground/80"}`}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="size-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>

        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {notification.message}
        </p>

        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span>{relativeTime}</span>
          {notification.actor && (
            <span className="truncate max-w-[120px]">
              by {notification.actor.name}
            </span>
          )}
        </div>
      </div>

      {/* Quick Mark-as-Read Hover Button */}
      {!notification.read && (
        <button
          type="button"
          onClick={onMarkRead}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title="Mark as read"
        >
          <Check className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function NotificationListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/40" aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3 p-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
