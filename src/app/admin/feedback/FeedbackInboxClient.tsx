"use client";

import { useState, useTransition } from "react";
import type { AdminFeedbackItem, FeedbackCategory, FeedbackSentiment } from "@/actions/feedback";
import { markFeedbackRead } from "@/actions/feedback";
import styles from "./FeedbackInbox.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General",
  attendance_system: "Attendance System",
  course_experience: "Course Experience",
  lecturer_feedback: "Lecturer Feedback",
  platform_suggestion: "Suggestion",
  technical_issue: "Technical Issue",
  other: "Other",
};

const SENTIMENT_CONFIG: Record<FeedbackSentiment, { emoji: string; color: string }> = {
  positive: { emoji: "😊", color: "var(--color-success)" },
  neutral:  { emoji: "😐", color: "var(--color-warning)" },
  negative: { emoji: "😞", color: "var(--color-danger)" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={n <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
          style={{ color: n <= rating ? "var(--color-warning)" : "var(--color-border)" }}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = "all" | "unread" | FeedbackSentiment;

export function FeedbackInboxClient({ items: initialItems }: { items: AdminFeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = items.filter((f) => {
    if (filter === "all") return true;
    if (filter === "unread") return !f.isReadAdmin;
    return f.sentiment === filter;
  });

  function handleExpand(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    // Mark as read when opened
    const item = items.find((f) => f.id === id);
    if (next && item && !item.isReadAdmin) {
      startTransition(async () => {
        await markFeedbackRead(id);
        setItems((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isReadAdmin: true } : f))
        );
      });
    }
  }

  const unreadCount = items.filter((f) => !f.isReadAdmin).length;

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className={styles.filterBar}>
        {(["all", "unread", "positive", "neutral", "negative"] as Filter[]).map((f) => {
          const label =
            f === "all"     ? `All (${items.length})` :
            f === "unread"  ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` :
            f === "positive"? "😊 Positive" :
            f === "neutral" ? "😐 Neutral" :
                              "😞 Negative";
          return (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="5" y="8" width="30" height="24" rx="3" />
            <path d="M13 16h14M13 22h8" />
          </svg>
          <p>No feedback matches this filter.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {filtered.map((item, idx) => {
            const isOpen = expanded === item.id;
            const sentiment = SENTIMENT_CONFIG[item.sentiment];
            const displayTitle = item.title || item.body.slice(0, 60) + (item.body.length > 60 ? "…" : "");

            return (
              <div
                key={item.id}
                className={`${styles.row} ${!item.isReadAdmin ? styles.rowUnread : ""}`}
                style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--color-border)" : "none" }}
              >
                {/* ── Collapsed header ─────────────────────────── */}
                <button
                  className={styles.rowHeader}
                  onClick={() => handleExpand(item.id)}
                  aria-expanded={isOpen}
                >
                  {/* Unread dot */}
                  <span
                    className={styles.unreadDot}
                    style={{ opacity: item.isReadAdmin ? 0 : 1 }}
                    aria-label={item.isReadAdmin ? "" : "Unread"}
                  />

                  {/* Sentiment emoji */}
                  <span className={styles.sentimentEmoji} title={item.sentiment}>
                    {sentiment.emoji}
                  </span>

                  {/* Title + meta */}
                  <div className={styles.rowMeta}>
                    <span className={styles.rowTitle}>{displayTitle || "(No title or body)"}</span>
                    <span className={styles.rowSub}>
                      <span
                        className={styles.roleBadge}
                        data-role={item.authorRole}
                      >
                        {item.authorRole === "student" ? "Student" : "Lecturer"}
                      </span>
                      {item.isAnonymous && (
                        <span className={styles.anonBadge}>Anonymous</span>
                      )}
                      · {CATEGORY_LABELS[item.category]} · {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Rating */}
                  <StarDisplay rating={item.rating} />

                  {/* Chevron */}
                  <svg
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                    width="16" height="16" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {/* ── Expanded body ─────────────────────────────── */}
                {isOpen && (
                  <div className={styles.rowBody}>
                    {item.title && item.body && (
                      <div className={styles.bodySection}>
                        <span className={styles.bodyLabel}>Title</span>
                        <p className={styles.bodyText}>{item.title}</p>
                      </div>
                    )}
                    {item.body && (
                      <div className={styles.bodySection}>
                        <span className={styles.bodyLabel}>Details</span>
                        <p className={styles.bodyText}>{item.body}</p>
                      </div>
                    )}
                    {!item.title && !item.body && (
                      <p className={styles.bodyText} style={{ color: "var(--color-text-3)", fontStyle: "italic" }}>
                        No written content was provided.
                      </p>
                    )}
                    <div className={styles.bodyMeta}>
                      <span>Submitted {new Date(item.createdAt).toLocaleString("en-GH", { dateStyle: "full", timeStyle: "short" })}</span>
                      {item.isAnonymous && <span>· Identity hidden (anonymous)</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
