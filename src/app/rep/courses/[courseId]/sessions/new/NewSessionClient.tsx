"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openSession } from "../../actions";

type Props = {
  courseId: string;
  semesterId: string;
  semesterName: string;
  defaultDuration: number;
  timetableOptions: { id: string; label: string; venue: string | null }[];
  suggestedVenue: string | null;
  suggestedTimetableId: string | null;
};

export function NewSessionClient({
  courseId,
  semesterId,
  semesterName,
  defaultDuration,
  timetableOptions,
  suggestedVenue,
  suggestedTimetableId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [duration, setDuration] = useState(String(defaultDuration));
  const [venue, setVenue] = useState(suggestedVenue ?? "");
  const [notes, setNotes] = useState("");
  const [timetableId, setTimetableId] = useState(suggestedTimetableId ?? "");

  function handleSubmit() {
    const mins = Number(duration);
    if (!mins || mins < 1 || mins > 480) {
      setError("Duration must be between 1 and 480 minutes.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await openSession({
        courseId,
        semesterId,
        timetableId: timetableId || null,
        durationMinutes: mins,
        venue: venue.trim() || null,
        notes: notes.trim() || null,
      });

      if ("error" in res) {
        setError(res.error);
      } else {
        router.push(`/rep/sessions/${res.id}`);
      }
    });
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>
          Semester
        </div>
        <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
          {semesterName}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="9" /><path d="M10 7v3M10 13h.01" />
          </svg>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Duration */}
        <div className="input-group">
          <label className="label" htmlFor="duration">Duration (minutes)</label>
          <input
            id="duration"
            type="number"
            className="input"
            min={1}
            max={480}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 60"
          />
        </div>

        {/* Venue */}
        <div className="input-group">
          <label className="label" htmlFor="venue">Venue <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span></label>
          <input
            id="venue"
            type="text"
            className="input"
            placeholder="e.g. Room 204"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>

        {/* Timetable link */}
        {timetableOptions.length > 0 && (
          <div className="input-group">
            <label className="label" htmlFor="timetable">Link to timetable slot <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span></label>
            <select
              id="timetable"
              className="input"
              value={timetableId}
              onChange={(e) => {
                setTimetableId(e.target.value);
                // Auto-fill venue from selected slot
                const slot = timetableOptions.find((t) => t.id === e.target.value);
                if (slot?.venue) setVenue(slot.venue);
              }}
            >
              <option value="">Not linked to a scheduled slot</option>
              {timetableOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div className="input-group">
          <label className="label" htmlFor="notes">Notes <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span></label>
          <textarea
            id="notes"
            className="input"
            rows={2}
            placeholder="Any notes about this session…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={`btn btn-primary${isPending ? " btn-loading" : ""}`}
          style={{ alignSelf: "flex-start" }}
        >
          {!isPending && (
            <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="9" /><path d="M10 6v8M6 10h8" />
              </svg>
              Start Session
            </>
          )}
        </button>
      </div>
    </div>
  );
}
