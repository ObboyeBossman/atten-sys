import type { FeedbackItem, FeedbackCategory, FeedbackSentiment } from "@/actions/feedback";
import styles from "./FeedbackHistory.module.css";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General",
  attendance_system: "Attendance System",
  course_experience: "Course Experience",
  lecturer_feedback: "Lecturer Feedback",
  platform_suggestion: "Suggestion",
  technical_issue: "Technical Issue",
  other: "Other",
};

const SENTIMENT_META: Record<FeedbackSentiment, { emoji: string; label: string; color: string }> = {
  positive: { emoji: "😊", label: "Positive", color: "var(--color-success)" },
  neutral:  { emoji: "😐", label: "Neutral",  color: "var(--color-warning)" },
  negative: { emoji: "😞", label: "Negative", color: "var(--color-danger)"  },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" });
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className={styles.starDisplay} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={n <= rating ? "#f59e0b" : "none"}
          stroke={n <= rating ? "#f59e0b" : "var(--color-border-hover)"}
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function FeedbackHistory({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" aria-hidden="true">
          <path d="M20 6C12.27 6 6 12.27 6 20s6.27 14 14 14 14-6.27 14-14S27.73 6 20 6z" />
          <path d="M20 14v8M20 25v2" strokeLinecap="round" />
        </svg>
        <p className={styles.emptyText}>No feedback submitted yet</p>
        <p className={styles.emptyHint}>Your past submissions will appear here.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {items.map((item, i) => {
        const sm = SENTIMENT_META[item.sentiment];
        return (
          <article
            key={item.id}
            className={styles.card}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className={styles.cardTop}>
              <span
                className={styles.categoryBadge}
              >
                {CATEGORY_LABELS[item.category]}
              </span>
              <div className={styles.cardMeta}>
                {item.isAnonymous && (
                  <span className={styles.anonBadge} title="Submitted anonymously">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M8 2a4 4 0 100 8 4 4 0 000-8zM2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" strokeLinecap="round" />
                      <line x1="2" y1="2" x2="14" y2="14" strokeLinecap="round" />
                    </svg>
                    Anon
                  </span>
                )}
                <time className={styles.timeAgo} dateTime={item.createdAt}>
                  {timeAgo(item.createdAt)}
                </time>
              </div>
            </div>

            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardBody}>{item.body}</p>

            <div className={styles.cardFooter}>
              <StarDisplay rating={item.rating} />
              <span
                className={styles.sentimentTag}
                style={{ color: sm.color }}
              >
                {sm.emoji} {sm.label}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
