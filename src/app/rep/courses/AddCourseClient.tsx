"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { addCourse } from "./actions";

type Props = {
  groupId: string;
  semesterId: string;
};

const CREDIT_OPTIONS = [1, 2, 3, 4, 5, 6];

export function AddCourseClient({ groupId, semesterId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creditHours, setCreditHours] = useState(3);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleOpen() {
    setError(null);
    setSaved(false);
    setName("");
    setCode("");
    setCreditHours(3);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Course name is required."); return; }
    if (!code.trim()) { setError("Course code is required."); return; }
    setError(null);

    startTransition(async () => {
      const res = await addCourse({
        groupId,
        semesterId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        creditHours,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => { setOpen(false); setSaved(false); }, 900);
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <button onClick={handleOpen} className="btn btn-primary" aria-haspopup="dialog">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 4v12M4 10h12" />
        </svg>
        Add Course
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={`ac-backdrop${open ? " ac-backdrop--open" : ""}`}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Course"
        className={`ac-drawer${open ? " ac-drawer--open" : ""}`}
      >
        {/* Mobile drag handle */}
        <div className="ac-handle" aria-hidden="true" />

        {/* Header */}
        <div className="ac-header">
          <div>
            <h2 className="ac-title">New Course</h2>
            <p className="ac-subtitle">Added to the active semester</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close drawer"
            disabled={isPending}
            className="ac-close"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="ac-body">

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="9" /><path d="M10 7v3M10 13h.01" />
              </svg>
              {error}
            </div>
          )}

          {/* Course Name */}
          <div className="ac-field">
            <label htmlFor="ac-name" className="ac-label">Course Name</label>
            <input
              ref={nameRef}
              id="ac-name"
              className="input ac-input"
              type="text"
              placeholder="e.g. Introduction to Computing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending || saved}
              autoComplete="off"
            />
          </div>

          {/* Code + Credits */}
          <div className="ac-row">
            <div className="ac-field">
              <label htmlFor="ac-code" className="ac-label">Course Code</label>
              <input
                id="ac-code"
                className="input ac-input ac-mono"
                type="text"
                placeholder="ITC 101"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={isPending || saved}
                autoComplete="off"
              />
            </div>

            <div className="ac-field">
              <span className="ac-label" id="ac-credits-label">Credit Hours</span>
              <div className="ac-credit-grid" role="group" aria-labelledby="ac-credits-label">
                {CREDIT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCreditHours(n)}
                    disabled={isPending || saved}
                    aria-pressed={creditHours === n}
                    className={`ac-credit-btn${creditHours === n ? " ac-credit-btn--active" : ""}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="ac-credit-hint">{creditHours} credit hour{creditHours !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Info note */}
          <div className="ac-info">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="9" /><path d="M10 13v-3M10 7h.01" />
            </svg>
            <span>The course goes live immediately. Assign a lecturer from the course detail page.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="ac-footer">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="btn btn-secondary"
            style={{ flex: 1 }}
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || saved}
            className={`btn btn-primary ac-save${saved ? " ac-save--done" : ""}`}
            style={{ flex: 2 }}
            type="button"
          >
            {saved ? (
              <>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10l5 5 7-9" />
                </svg>
                Course Added
              </>
            ) : isPending ? (
              <>
                <span className="ac-spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save Course"
            )}
          </button>
        </div>
      </div>

      <style>{`
        /* ── Backdrop ── */
        .ac-backdrop {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          opacity: 0; pointer-events: none;
          transition: opacity 260ms ease;
        }
        .ac-backdrop--open { opacity: 1; pointer-events: auto; }

        /* ── Drawer base (mobile: bottom sheet) ── */
        .ac-drawer {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 50;
          background: var(--color-surface);
          border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
          box-shadow: var(--shadow-xl);
          /*
           * Cap at viewport minus the 56px mobile topbar so the sheet
           * never slides up behind the topbar chrome.
           */
          max-height: calc(100dvh - 56px);
          display: flex; flex-direction: column;
          transform: translateY(105%);
          transition: transform 300ms cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
        }
        .ac-drawer--open {
          transform: translateY(0);
          pointer-events: auto;
        }

        /* ── Desktop / Tablet: right-side drawer ── */
        @media (min-width: 768px) {
          .ac-drawer {
            top: 0; left: auto; right: 0; bottom: 0;
            width: 420px;
            border-radius: var(--radius-2xl) 0 0 var(--radius-2xl);
            max-height: 100dvh;
            transform: translateX(105%);
          }
          .ac-drawer--open { transform: translateX(0); }
          .ac-handle { display: none; }
        }

        /* ── Handle ── */
        .ac-handle {
          width: 36px; height: 4px;
          border-radius: 9999px;
          background: var(--color-surface-3);
          margin: 12px auto 0;
          flex-shrink: 0;
        }

        /* ── Header ── */
        .ac-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-5) var(--space-6) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
          gap: var(--space-4);
        }
        .ac-title { font-size: var(--text-lg); font-weight: 800; color: var(--color-text); line-height: 1.2; }
        .ac-subtitle { font-size: var(--text-xs); color: var(--color-text-3); margin-top: 3px; }
        .ac-close {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          border-radius: var(--radius-md);
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          cursor: pointer; color: var(--color-text-3);
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }
        .ac-close:hover { background: var(--color-surface-3); color: var(--color-text); }
        .ac-close:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Body ── */
        .ac-body {
          flex: 1; overflow-y: auto;
          padding: var(--space-6);
          display: flex; flex-direction: column;
          gap: 0;
        }

        /* ── Fields ── */
        .ac-field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-5); }
        .ac-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .ac-label {
          font-size: 11px; font-weight: 700;
          color: var(--color-text-3);
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .ac-input {
          padding: 0.72rem var(--space-4) !important;
          font-size: var(--text-sm) !important;
          background: var(--color-surface-2) !important;
        }
        .ac-mono { font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.04em; }

        /* ── Credit pill selector ── */
        .ac-credit-grid {
          display: grid; grid-template-columns: repeat(6,1fr);
          gap: 3px; padding: 3px;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }
        .ac-credit-btn {
          padding: 7px 0;
          border-radius: calc(var(--radius-md) - 1px);
          font-size: var(--text-sm); font-weight: 700;
          border: none; cursor: pointer;
          background: transparent;
          color: var(--color-text-3);
          transition: all 140ms ease;
          line-height: 1;
        }
        .ac-credit-btn:hover:not(:disabled) {
          background: var(--color-surface-3);
          color: var(--color-text);
        }
        .ac-credit-btn--active {
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)) !important;
          color: #fff !important;
          box-shadow: 0 2px 8px var(--color-primary-glow);
        }
        .ac-credit-hint {
          font-size: 11px; color: var(--color-text-3); margin-top: 5px;
        }

        /* ── Info note ── */
        .ac-info {
          display: flex; align-items: flex-start; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          background: var(--color-info-bg);
          border: 1px solid rgba(6,182,212,0.2);
          color: var(--color-info);
          font-size: var(--text-xs); line-height: 1.6;
          margin-top: var(--space-2);
        }
        .ac-info svg { flex-shrink: 0; margin-top: 1px; }

        /* ── Footer ── */
        .ac-footer {
          display: flex; gap: var(--space-3);
          padding: var(--space-4) var(--space-6);
          /*
           * Mobile: the floating pill nav sits ~72px above the bottom edge
           * (pill ~56px + 16px gap) plus safe-area-inset-bottom.
           * Without this, Cancel/Save buttons are hidden behind the pill nav.
           */
          padding-bottom: calc(88px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
          background: var(--color-surface);
        }
        /* Desktop/tablet: pill nav hidden — restore normal padding */
        @media (min-width: 769px) {
          .ac-footer {
            padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
          }
        }

        /* Save button done state */
        .ac-save--done {
          background: linear-gradient(135deg,#16a34a,#15803d) !important;
          box-shadow: 0 4px 15px rgba(22,163,74,0.35) !important;
        }

        /* Spinner */
        .ac-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 4px;
        }
      `}</style>
    </>
  );
}
