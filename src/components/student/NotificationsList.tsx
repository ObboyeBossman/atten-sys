"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  session_id: string | null;
}

interface NotificationsListProps {
  initialNotifications: NotificationItem[];
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  dispute_resolved: {
    color: "var(--color-success)",
    bg: "var(--color-success-bg)",
    label: "Dispute resolved",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  session_started: {
    color: "var(--color-primary)",
    bg: "var(--color-primary-bg, var(--color-surface-3))",
    label: "Session started",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  session_ended: {
    color: "var(--color-text-3)",
    bg: "var(--color-surface-2)",
    label: "Session ended",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  default: {
    color: "var(--color-text-2)",
    bg: "var(--color-surface-2)",
    label: "Notification",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
};

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function markRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  async function handleNotifClick(notif: NotificationItem) {
    if (!notif.is_read) markRead(notif.id);

    if (!notif.session_id) return;

    // For session_started notifications: check whether the session is still live
    // so we can send the student directly to check-in instead of the detail page.
    if (notif.type === "session_started") {
      try {
        const res = await fetch(`/api/sessions/${notif.session_id}/status`);
        if (res.ok) {
          const { live } = await res.json();
          if (live) {
            router.push(`/student/checkin/${notif.session_id}`);
            return;
          }
        }
      } catch {
        // If the check fails, fall through to the attendance detail page
      }
    }

    router.push(`/student/attendance/${notif.session_id}`);
  }

  if (notifications.length === 0) {
    return (
      <div className="card text-center py-12">
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--color-surface-2)",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-4)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <p className="text-[var(--color-text-3)] font-medium">All caught up</p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginTop: "var(--space-1)" }}>
          You have no notifications yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Mark all as read — only shown when there are unread */}
      {unreadCount > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-2)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              transition: "all var(--transition-fast)",
              minHeight: 44,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark all as read
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 20,
              height: 20,
              borderRadius: "var(--radius-full)",
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              padding: "0 5px",
            }}>
              {unreadCount}
            </span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {notifications.map((notif) => {
          const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
          const isClickable = !!notif.session_id;

          return (
            <div
              key={notif.id}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? () => handleNotifClick(notif) : () => { if (!notif.is_read) markRead(notif.id); }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && isClickable) handleNotifClick(notif);
              }}
              className="card"
              style={{
                cursor: isClickable ? "pointer" : "default",
                borderLeft: !notif.is_read ? "4px solid var(--color-primary)" : "4px solid transparent",
                transition: "all var(--transition-fast)",
                position: "relative",
                outline: "none",
              }}
              onFocus={(e) => { if (isClickable) e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = ""; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                {/* Type icon + badge — color + icon + text, never color alone */}
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: cfg.bg,
                  color: cfg.color,
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {cfg.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{notif.title}</span>
                      {/* Unread dot + label — never only the border */}
                      {!notif.is_read && (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "1px 7px",
                          borderRadius: "var(--radius-full)",
                          background: "var(--color-primary)",
                          color: "#fff",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", display: "inline-block" }} aria-hidden="true" />
                          New
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {new Date(notif.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.5 }}>{notif.message}</p>

                  {isClickable && (
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                    }}>
                      View details
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 2l4 4-4 4" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
