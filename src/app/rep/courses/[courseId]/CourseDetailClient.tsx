"use client";

import { useState, useTransition } from "react";
import { addTimetableEntry, assignLecturer } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type LecturerOption = { id: string; name: string };

type Props = {
  courseId: string;
  groupId: string;
  lecturers: LecturerOption[];
  currentLecturerId: string | null;
};

export function CourseDetailClient({ courseId, groupId, lecturers, currentLecturerId }: Props) {
  // ── Timetable state ─────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [ttPending, startTtTransition] = useTransition();
  const [ttError, setTtError] = useState<string | null>(null);
  const [ttSuccess, setTtSuccess] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [venue, setVenue] = useState("");

  // ── Lecturer assignment state ────────────────────────────
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(currentLecturerId ?? "");
  const [lcPending, startLcTransition] = useTransition();
  const [lcError, setLcError] = useState<string | null>(null);
  const [lcSuccess, setLcSuccess] = useState(false);

  // ── Timetable handlers ───────────────────────────────────
  function handleTtSubmit() {
    setTtError(null);
    setTtSuccess(false);
    startTtTransition(async () => {
      const res = await addTimetableEntry({
        courseId,
        groupId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        venue: venue.trim() || null,
      });
      if ("error" in res) {
        setTtError(res.error);
      } else {
        setTtSuccess(true);
        setShowForm(false);
        setVenue("");
      }
    });
  }

  // ── Lecturer handler ─────────────────────────────────────
  function handleAssignLecturer() {
    setLcError(null);
    setLcSuccess(false);
    startLcTransition(async () => {
      const res = await assignLecturer({
        courseId,
        lecturerId: selectedLecturerId || null,
      });
      if ("error" in res) {
        setLcError(res.error);
      } else {
        setLcSuccess(true);
        setTimeout(() => setLcSuccess(false), 3000);
      }
    });
  }

  const lecturerChanged = selectedLecturerId !== (currentLecturerId ?? "");

  return (
    <>
      {/* ── Lecturer Assignment Section ─────────────────────── */}
      <div
        style={{
          marginTop: "var(--space-6)",
          padding: "var(--space-5)",
          borderRadius: "var(--radius-xl)",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-4)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Assigned Lecturer
        </h3>

        {lcError && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-3)" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" />
              <path d="M10 7v3M10 13h.01" />
            </svg>
            {lcError}
          </div>
        )}

        {lcSuccess && (
          <div className="alert alert-success" style={{ marginBottom: "var(--space-3)" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 10l5 5 7-9" />
            </svg>
            Lecturer updated.
          </div>
        )}

        <div className="lecturer-assign-row" style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label" htmlFor="lecturer-select">
              Lecturer
            </label>
            <select
              id="lecturer-select"
              className="form-input"
              value={selectedLecturerId}
              onChange={(e) => {
                setSelectedLecturerId(e.target.value);
                setLcSuccess(false);
              }}
              disabled={lcPending}
            >
              <option value="">— No lecturer assigned —</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAssignLecturer}
            disabled={lcPending || !lecturerChanged}
            className="btn btn-secondary"
            style={{
              flexShrink: 0,
              minWidth: 90,
              opacity: lecturerChanged ? 1 : 0.45,
              transition: "opacity 200ms",
            }}
            type="button"
          >
            {lcPending ? "Saving…" : "Save"}
          </button>
        </div>

        {lecturers.length === 0 && (
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-3)",
              marginTop: "var(--space-2)",
            }}
          >
            No lecturers are registered yet. Contact the admin.
          </p>
        )}
      </div>

      {/* ── Timetable Add Form ──────────────────────────────── */}
      <div
        style={{
          marginTop: "var(--space-5)",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "var(--space-4)",
        }}
      >
        {ttSuccess && (
          <div className="alert alert-success" style={{ marginBottom: "var(--space-3)" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 5L8 13l-4-4" />
            </svg>
            Timetable slot added.
          </div>
        )}
        {ttError && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-3)" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" />
              <path d="M10 7v3M10 13h.01" />
            </svg>
            {ttError}
          </div>
        )}

        {!showForm ? (
          <button
            onClick={() => {
              setShowForm(true);
              setTtSuccess(false);
            }}
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--color-text-3)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" />
              <path d="M10 6v8M6 10h8" />
            </svg>
            Add timetable slot
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                color: "var(--color-text-2)",
              }}
            >
              New timetable slot
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label className="label" htmlFor="tt-day">
                  Day
                </label>
                <select
                  id="tt-day"
                  className="input"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="label" htmlFor="tt-start">
                  Start time
                </label>
                <input
                  id="tt-start"
                  type="time"
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label" htmlFor="tt-end">
                  End time
                </label>
                <input
                  id="tt-end"
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label className="label" htmlFor="tt-venue">
                  Venue (optional)
                </label>
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
                onClick={handleTtSubmit}
                disabled={ttPending}
                className={`btn btn-primary btn-sm${ttPending ? " btn-loading" : ""}`}
              >
                {!ttPending && "Add Slot"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setTtError(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Stack lecturer select + save button on mobile */
        @media (max-width: 479px) {
          .lecturer-assign-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .lecturer-assign-row .btn {
            width: 100%;
            justify-content: center;
            min-height: 44px;
          }
        }
      `}</style>
    </>
  );
}
