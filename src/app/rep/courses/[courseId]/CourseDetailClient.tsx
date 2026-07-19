"use client";

import { useState, useTransition } from "react";
import { addTimetableEntry } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Props = {
  courseId: string;
  groupId: string;
};

export function CourseDetailClient({ courseId, groupId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [venue, setVenue] = useState("");

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await addTimetableEntry({
        courseId,
        groupId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        venue: venue.trim() || null,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccess(true);
        setShowForm(false);
        setVenue("");
      }
    });
  }

  return (
    <div style={{ marginTop: "var(--space-5)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
      {success && (
        <div className="alert alert-success" style={{ marginBottom: "var(--space-3)" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 5L8 13l-4-4" />
          </svg>
          Timetable slot added.
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-3)" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="9" /><path d="M10 7v3M10 13h.01" />
          </svg>
          {error}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => { setShowForm(true); setSuccess(false); }}
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--color-text-3)" }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="9" /><path d="M10 6v8M6 10h8" />
          </svg>
          Add timetable slot
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>
            New timetable slot
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="input-group" style={{ gridColumn: "1 / -1" }}>
              <label className="label" htmlFor="tt-day">Day</label>
              <select
                id="tt-day"
                className="input"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="label" htmlFor="tt-start">Start time</label>
              <input
                id="tt-start"
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="label" htmlFor="tt-end">End time</label>
              <input
                id="tt-end"
                type="time"
                className="input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ gridColumn: "1 / -1" }}>
              <label className="label" htmlFor="tt-venue">Venue (optional)</label>
              <input
                id="tt-venue"
                type="text"
                className="input"
                placeholder="e.g. Room 204"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className={`btn btn-primary btn-sm${isPending ? " btn-loading" : ""}`}
            >
              {!isPending && "Add Slot"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
