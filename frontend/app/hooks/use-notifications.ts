import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { API_BASE_URL, api } from "@/lib/api";
import type {
  Notification,
  NotificationListResponse,
  NotificationReadResponse,
  UnreadCountResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (limit: number | null, offset: number) =>
    ["notifications", "list", { limit, offset }] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Current user's notifications (newest first, paginated). */
export function useNotifications(params: { limit?: number; offset?: number } = {}) {
  const { limit, offset = 0 } = params;

  return useQuery({
    queryKey: notificationKeys.list(limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResponse>("/notifications", {
        params: {
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Unread notification count — used for the badge. Polls every 30s as fallback. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const { data } = await api.get<UnreadCountResponse>("/notifications/unread-count");
      return data;
    },
    refetchInterval: 30_000, // Poll every 30s as SSE fallback
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mark a single notification as read. */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<NotificationReadResponse>(`/notifications/${id}/read`);
      return data.notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Mark all notifications as read. */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Web Audio chime helper (soft & non-intrusive)
// ---------------------------------------------------------------------------

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // 2-tone melodic chime: C6 (1046Hz) to G6 (1568Hz)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio permission/context errors silently
  }
}

// ---------------------------------------------------------------------------
// SSE hook — real-time push notifications & live stream
// ---------------------------------------------------------------------------

export type SSEStatus = "connecting" | "connected" | "disconnected";

/**
 * Opens an SSE connection to `/api/notifications/stream` and keeps it alive.
 * Listens for inbound events (`notification`, `insight-ready`, `task-updated`, etc.),
 * invalidates relevant TanStack cache queries, triggers floating toasts, and plays audio chimes.
 */
export function useNotificationSSE() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SSEStatus>("disconnected");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    function handleInboundMessage(rawData: string) {
      if (!rawData || rawData.startsWith(":")) return;
      try {
        const payload = JSON.parse(rawData);
        const eventType = payload.type || "notification";
        const eventData = payload.data;

        // Invalidate notification queries
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

        // Handle specific event kinds
        if (eventType === "notification" && eventData) {
          playNotificationChime();
          toast.add({
            type: "info",
            title: eventData.title || "New Notification",
            description: eventData.message || undefined,
          });
        } else if (eventType === "insight-ready") {
          void queryClient.invalidateQueries({ queryKey: ["insights"] });
          playNotificationChime();
          toast.add({
            type: "success",
            title: "Strategic AI Insight Ready",
            description: eventData?.title || "New AI intelligence report has been synthesized.",
          });
        } else if (eventType === "task-updated") {
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        } else if (eventType === "leave-updated") {
          void queryClient.invalidateQueries({ queryKey: ["leaves"] });
        } else if (eventType === "announcement-new") {
          void queryClient.invalidateQueries({ queryKey: ["announcements"] });
          playNotificationChime();
          toast.add({
            type: "info",
            title: "New Company Announcement",
            description: eventData?.title || "Check announcements for updates.",
          });
        } else if (eventType === "kudos-new") {
          void queryClient.invalidateQueries({ queryKey: ["kudos"] });
        } else if (eventType === "attendance-updated") {
          void queryClient.invalidateQueries({ queryKey: ["attendance"] });
        }
      } catch {
        // Fallback generic invalidation
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    }

    function connect() {
      if (cancelled) return;

      setStatus("connecting");

      const eventSource = new EventSource(`${API_BASE_URL}/notifications/stream`, {
        withCredentials: true,
      });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCountRef.current = 0; // Reset backoff on successful connection.
      };

      eventSource.onmessage = (event) => {
        if (cancelled) return;
        handleInboundMessage(event.data);
      };

      // Custom event listeners if dispatched with event: name
      eventSource.addEventListener("notification", (event: MessageEvent) => {
        if (cancelled) return;
        handleInboundMessage(event.data);
      });

      eventSource.addEventListener("insight-ready", (event: MessageEvent) => {
        if (cancelled) return;
        handleInboundMessage(event.data);
      });

      eventSource.onerror = () => {
        if (cancelled) return;
        eventSource.close();
        eventSourceRef.current = null;
        setStatus("disconnected");

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max.
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
        retryCountRef.current += 1;

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient]);

  return { status };
}
