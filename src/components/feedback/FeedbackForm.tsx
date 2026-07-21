"use client";

import { useState, useTransition } from "react";
import { submitFeedback } from "@/actions/feedback";
import type { FeedbackCategory, FeedbackSentiment, FeedbackAuthorRole } from "@/actions/feedback";
import styles from "./FeedbackForm.module.css";

const CATEGORIES: { value: FeedbackCategory; label: string; icon: string }[] = [
  { value: "general", label: "General", icon: "💬" },
  { value: "attendance_system", label: "Attendance System", icon: "📋" },
  { value: "course_experience", label: "Course Experience", icon: "📚" },
  { value: "lecturer_feedback", label: "Lecturer Feedback", icon: "🎓" },
  { value: "platform_suggestion", label: "Suggestion", icon: "💡" },
  { value: "technical_issue", label: "Technical Issue", icon: "🔧" },
  { value: "other", label: "Other", icon: "📝" },
];

const SENTIMENTS: { value: FeedbackSentiment; label: string; emoji: string; color: string }[] = [
  { value: "positive", label: "Positive", emoji: "😊", color: "var(--color-success)" },
  { value: "neutral", label: "Neutral", emoji: "😐", color: "var(--color-warning)" },
  { value: "negative", label: "Negative", emoji: "😞", color: "var(--color-danger)" },
];

function StarRating({
  value,
  onChange,
  submitted,
}: {
  value: number;
  onChange: (v: number) => void;
  submitted: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className={styles.stars} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = submitted ? n <= value : n <= (hovered || value);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`${styles.star} ${filled ? styles.starFilled : ""} ${submitted && n <= value ? styles.starDone : ""}`}
            onMouseEnter={() => !submitted && setHovered(n)}
            onMouseLeave={() => !submitted && setHovered(0)}
            onClick={() => !submitted && onChange(n)}
            disabled={submitted}
          >
            {submitted && n <= value ? (
              /* morphs into checkmark on submit — signature interaction */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function FeedbackForm({ authorRole }: { authorRole: FeedbackAuthorRole }) {
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [sentiment, setSentiment] = useState<FeedbackSentiment>("positive");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (rating === 0) { setError("Please select a star rating."); return; }
    if (!title.trim()) { setError("Please add a short title for your feedback."); return; }
    if (!body.trim()) { setError("Please share your thoughts in the details field."); return; }

    startTransition(async () => {
      const res = await submitFeedback({ category, sentiment, rating, title, body, isAnonymous, authorRole });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <div className={styles.successState}>
        <div className={styles.successRing}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 12L17 27l-9-9" />
          </svg>
        </div>
        <h2 className={styles.successTitle}>Thank you for your feedback</h2>
        <p className={styles.successBody}>
          Your {isAnonymous ? "anonymous " : ""}submission has been recorded. It helps us improve the system for everyone.
        </p>
        <button
          className={styles.submitBtn}
          onClick={() => {
            setSubmitted(false);
            setRating(0);
            setTitle("");
            setBody("");
            setError("");
            setSentiment("positive");
            setCategory("general");
            setIsAnonymous(false);
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* ── Category ───────────────────────────────── */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Category</legend>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={`${styles.categoryChip} ${category === cat.value ? styles.categoryChipActive : ""}`}
              onClick={() => setCategory(cat.value)}
              aria-pressed={category === cat.value}
            >
              <span className={styles.categoryIcon}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── Sentiment ──────────────────────────────── */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Overall feeling</legend>
        <div className={styles.sentimentRow}>
          {SENTIMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`${styles.sentimentBtn} ${sentiment === s.value ? styles.sentimentBtnActive : ""}`}
              style={{ "--sentiment-color": s.color } as React.CSSProperties}
              onClick={() => setSentiment(s.value)}
              aria-pressed={sentiment === s.value}
            >
              <span className={styles.sentimentEmoji}>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── Star Rating ────────────────────────────── */}
      <div className={styles.fieldset}>
        <label className={styles.legend}>Rating</label>
        <StarRating value={rating} onChange={setRating} submitted={false} />
        {rating > 0 && (
          <span className={styles.ratingHint}>
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </span>
        )}
      </div>

      {/* ── Title ──────────────────────────────────── */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="fb-title">
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="fb-title"
          type="text"
          className={styles.input}
          placeholder="Summarise your feedback in a few words"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          aria-required="true"
          disabled={isPending}
        />
        <span className={styles.charCount}>{title.length}/120</span>
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="fb-body">
          Details <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="fb-body"
          className={styles.textarea}
          placeholder="Share your experience, recommendation, or concern. Be as specific as you like — your input shapes real improvements."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          aria-required="true"
          disabled={isPending}
        />
        <span className={styles.charCount}>{body.length}/2000</span>
      </div>

      {/* ── Anonymous toggle ───────────────────────── */}
      <label className={styles.anonRow}>
        <span className={styles.anonToggle}>
          <input
            type="checkbox"
            className={styles.anonCheckbox}
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            disabled={isPending}
          />
          <span className={styles.anonSlider} aria-hidden="true" />
        </span>
        <span className={styles.anonLabel}>
          Submit anonymously
          <span className={styles.anonHint}>Your name won't be attached to this feedback</span>
        </span>
      </label>

      {/* ── Error ──────────────────────────────────── */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="7" />
            <path d="M8 5v4M8 11v.5" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Submit ─────────────────────────────────── */}
      <button
        type="submit"
        className={styles.submitBtn}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Sending…
          </>
        ) : (
          "Send feedback"
        )}
      </button>
    </form>
  );
}
