"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openSession } from "../../actions";

type Timetable = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
};

type Props = {
  courseId: string;
  courseName: string;
  courseCode: string;
  semesterId: string;
  timetables: Timetable[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function NewSessionClient({
  courseId,
  courseName,
  courseCode,
  semesterId,
  timetables,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTimetable, setSelectedTimetable] = useState<string | null>(
    timetables.length === 1 ? timetables[0].id : null
  );
  const [venue, setVenue] = useState(
    timetables.length === 1 ? (timetables[0].venue ?? "") : ""
  );
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  function handleTimetableSelect(tt: Timetable) {
    setSelectedTimetable(tt.id);
    if (tt.venue) setVenue(tt.venue);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await openSession({
        courseId,
        semesterId,
        timetableId: selectedTimetable,
        durationMinutes: parseInt(duration, 10) || 60,
        venue: venue.trim() || null,
        notes: notes.trim() || null,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/lecturer/sessions/${result.id}`);
      }
    });
  }

  const durations = [
    { label: "45 min", value: "45" },
    { label: "1 hr", value: "60" },
    { label: "1.5 hr", value: "90" },
    { label: "2 hr", value: "120" },
    { label: "3 hr", value: "180" },
  ];

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Course badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-full)",
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          marginBottom: "var(--space-6)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--color-primary)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {courseCode}
        </span>
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.4)",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-2)",
            fontWeight: 500,
          }}
        >
          {courseName}
        </span>
      </div>

      {/* Timetable slots */}
      {timetables.length > 0 && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <label
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "var(--space-2)",
            }}
          >
            Timetable Slot
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {timetables.map((tt) => {
              const selected = selectedTimetable === tt.id;
              return (
                <button
                  key={tt.id}
                  type="button"
                  onClick={() => handleTimetableSelect(tt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-base)",
                    border: selected
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    background: selected
                      ? "rgba(99,102,241,0.06)"
                      : "var(--color-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 180ms ease",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-base)",
                      background: selected
                        ? "var(--color-primary)"
                        : "var(--color-surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "var(--text-xs)",
                      fontWeight: 800,
                      color: selected ? "#fff" : "var(--color-text-3)",
                      flexShrink: 0,
                      transition: "all 180ms ease",
                    }}
                  >
                    {DAYS[tt.day_of_week]}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "var(--text-sm)",
                        color: selected
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      }}
                    >
                      {fmtTime(tt.start_time)} – {fmtTime(tt.end_time)}
                    </div>
                    {tt.venue && (
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-3)",
                          marginTop: 2,
                        }}
                      >
                        {tt.venue}
                      </div>
                    )}
                  </div>
                  {selected && (
                    <svg
                      style={{ marginLeft: "auto", color: "var(--color-primary)", flexShrink: 0 }}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Duration */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <label
          style={{
            display: "block",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "var(--space-2)",
          }}
        >
          Session Duration
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {durations.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDuration(d.value)}
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-full)",
                border:
                  duration === d.value
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                background:
                  duration === d.value
                    ? "rgba(99,102,241,0.08)"
                    : "var(--color-surface)",
                color:
                  duration === d.value
                    ? "var(--color-primary)"
                    : "var(--color-text-2)",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Venue */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <label
          htmlFor="venue"
          style={{
            display: "block",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "var(--space-2)",
          }}
        >
          Venue <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span>
        </label>
        <input
          id="venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          onFocus={() => setFocused("venue")}
          onBlur={() => setFocused(null)}
          placeholder="e.g. Room 101, Block A"
          style={{
            width: "100%",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border:
              focused === "venue"
                ? "2px solid var(--color-primary)"
                : "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "var(--text-sm)",
            outline: "none",
            transition: "border-color 150ms ease",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Notes */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <label
          htmlFor="notes"
          style={{
            display: "block",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "var(--space-2)",
          }}
        >
          Notes <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={() => setFocused("notes")}
          onBlur={() => setFocused(null)}
          placeholder="Any notes for this session..."
          rows={3}
          style={{
            width: "100%",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border:
              focused === "notes"
                ? "2px solid var(--color-primary)"
                : "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "var(--text-sm)",
            outline: "none",
            resize: "vertical",
            transition: "border-color 150ms ease",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.25)",
            marginBottom: "var(--space-4)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-danger)", flexShrink: 0, marginTop: 1 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-danger)",
              fontWeight: 500,
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-base)",
          background: isPending ? "var(--color-surface-2)" : "var(--color-primary)",
          border: "none",
          color: isPending ? "var(--color-text-3)" : "#fff",
          fontWeight: 800,
          fontSize: "var(--text-base)",
          cursor: isPending ? "not-allowed" : "pointer",
          transition: "all 200ms ease",
          letterSpacing: "-0.01em",
        }}
      >
        {isPending ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "spin 0.8s linear infinite" }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Opening Session…
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
            Open Session
          </>
        )}
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
