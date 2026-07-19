"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { addCourse } from "./actions";

type Props = {
  groupId: string;
  semesterId: string;
};

export function AddCourseClient({ groupId, semesterId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creditHours, setCreditHours] = useState("3");

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name field when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open]);

  function handleOpen() {
    setError(null);
    setSaved(false);
    setName("");
    setCode("");
    setCreditHours("3");
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSubmit() {
    if (!name.trim() || !code.trim()) {
      setError("Course name and code are required.");
      return;
    }
    const ch = parseInt(creditHours, 10);
    if (isNaN(ch) || ch < 1 || ch > 12) {
      setError("Credit hours must be between 1 and 12.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addCourse({
        groupId,
        semesterId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        creditHours: ch,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => {
          setOpen(false);
          setSaved(false);
        }, 900);
      }
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="btn btn-primary"
        style={{ flexShrink: 0 }}
        aria-haspopup="dialog"
      >
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
          <path d="M10 4v12M4 10h12" />
        </svg>
        Add Course
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={handleClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 40,
            animation: "fadeIn 180ms ease-out both",
          }}
        />
      )}

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Course"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
          padding: "var(--space-6) var(--space-6) calc(var(--space-8) + env(safe-area-inset-bottom))",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          maxWidth: 560,
          margin: "0 auto",
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Handle */}
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 4,
            borderRadius: 9999,
            background: "var(--color-border)",
            margin: "0 auto var(--space-5)",
          }}
        />

        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-5)",
          }}
        >
          Add Course
        </h2>

        {error && (
          <div
            className="alert alert-error"
            style={{ marginBottom: "var(--space-4)" }}
          >
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
            {error}
          </div>
        )}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="course-name">
              Course Name
            </label>
            <input
              ref={nameRef}
              id="course-name"
              className="form-input"
              type="text"
              placeholder="e.g. Introduction to Computing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending || saved}
              autoComplete="off"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="course-code">
                Course Code
              </label>
              <input
                id="course-code"
                className="form-input"
                type="text"
                placeholder="e.g. ITC 101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isPending || saved}
                autoComplete="off"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="credit-hours">
                Credit Hours
              </label>
              <select
                id="credit-hours"
                className="form-input"
                value={creditHours}
                onChange={(e) => setCreditHours(e.target.value)}
                disabled={isPending || saved}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            marginTop: "var(--space-6)",
          }}
        >
          <button
            onClick={handleClose}
            className="btn btn-secondary"
            style={{ flex: 1 }}
            disabled={isPending}
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            style={{
              flex: 1,
              gap: "var(--space-2)",
              background: saved ? "var(--color-success)" : undefined,
              borderColor: saved ? "var(--color-success)" : undefined,
              transition: "background 200ms, border-color 200ms",
            }}
            disabled={isPending || saved}
            type="button"
          >
            {saved ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 10l5 5 7-9" />
                </svg>
                Saved
              </>
            ) : isPending ? (
              "Saving…"
            ) : (
              "Save Course"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  );
}
