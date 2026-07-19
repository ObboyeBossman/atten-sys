"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { addStudentToGroup, type AddStudentResult } from "./actions";

type Props = {
  groupId: string;
  groupName: string;
};

type OutcomeState =
  | { kind: "idle" }
  | { kind: "success"; result: Extract<AddStudentResult, { outcome: string }> }
  | { kind: "error"; message: string };

const OUTCOME_COPY: Record<string, string> = {
  created: "Student added successfully. They can now log in.",
  reactivated: "Student reactivated and added to this group.",
  membership_added: "Student was already registered and has been added to this group.",
  already_member: "Student is already an active member of this group.",
};

export function AddStudentClient({ groupId, groupName }: Props) {
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<OutcomeState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const serialRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const serialNum = parseInt(serial, 10);
    if (!serial || isNaN(serialNum) || serialNum < 1 || serialNum > 999) {
      setState({ kind: "error", message: "Serial number must be a whole number between 1 and 999." });
      return;
    }

    setState({ kind: "idle" });

    startTransition(async () => {
      const result = await addStudentToGroup(groupId, serialNum, name.trim() || null);
      if ("error" in result) {
        setState({ kind: "error", message: result.error });
      } else {
        setState({ kind: "success", result });
        setSerial("");
        setName("");
        setTimeout(() => serialRef.current?.focus(), 50);
      }
    });
  }

  function handleReset() {
    setState({ kind: "idle" });
    setSerial("");
    setName("");
    setTimeout(() => serialRef.current?.focus(), 50);
  }

  const isSuccess = state.kind === "success";
  const isAlreadyMember = isSuccess && state.result.outcome === "already_member";
  const isNew = isSuccess && (state.result.outcome === "created" || state.result.outcome === "reactivated");

  return (
    <>
      <style>{`
        .add-student-card {
          max-width: 480px;
        }
        .add-student-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-1-5, 6px);
          margin-bottom: var(--space-4);
        }
        .add-student-label {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text-2);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .add-student-hint {
          font-size: var(--text-xs);
          color: var(--color-text-3);
          margin-top: var(--space-1);
        }
        .outcome-card {
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          margin-bottom: var(--space-5);
          border: 1px solid;
          animation: slide-in 0.2s ease;
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: none; }
        }
        .outcome-success {
          background: var(--color-success-bg, rgba(34,197,94,0.08));
          border-color: rgba(34,197,94,0.3);
        }
        .outcome-already {
          background: var(--color-surface-2);
          border-color: var(--color-border);
        }
        .outcome-error {
          background: var(--color-danger-bg, rgba(239,68,68,0.08));
          border-color: rgba(239,68,68,0.3);
        }
        .outcome-title {
          font-size: var(--text-sm);
          font-weight: 700;
          margin-bottom: var(--space-2);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .outcome-success .outcome-title { color: var(--color-success); }
        .outcome-already .outcome-title { color: var(--color-text-2); }
        .outcome-error .outcome-title { color: var(--color-danger); }
        .outcome-index {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--color-text);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 2px 8px;
          display: inline-block;
          margin-bottom: var(--space-2);
        }
        .outcome-email {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--color-text-2);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          margin-top: var(--space-2);
          word-break: break-all;
        }
      `}</style>

      <div className="card add-student-card">
        <h2
          style={{
            fontSize: "var(--text-base)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-1)",
          }}
        >
          Add by Serial Number
        </h2>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            marginBottom: "var(--space-5)",
            lineHeight: 1.55,
          }}
        >
          Enter the student&apos;s serial number to add them to{" "}
          <strong style={{ color: "var(--color-text-2)" }}>{groupName}</strong>.
          The full index number is assembled automatically.
        </p>

        {/* Outcome banner */}
        {state.kind === "success" && (
          <div className={`outcome-card ${isAlreadyMember ? "outcome-already" : "outcome-success"}`}>
            <div className="outcome-title">
              {isAlreadyMember ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" />
                  <path d="M8 5v4M8 10.5v.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 8l4 4 8-8" />
                </svg>
              )}
              {OUTCOME_COPY[state.result.outcome]}
            </div>

            <div className="outcome-index">{state.result.indexNumber}</div>

            {isNew && state.result.email && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-2)" }}>
                  Login email:
                </div>
                <div className="outcome-email">{state.result.email}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-2)" }}>
                  The student will be prompted to change their password on first login.
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: "var(--space-3)" }}
            >
              Add another student
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="outcome-card outcome-error">
            <div className="outcome-title">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v4M8 10.5v.5" />
              </svg>
              {state.message}
            </div>
          </div>
        )}

        {/* Form — always visible unless success */}
        {state.kind !== "success" && (
          <div>
            {/* Serial number */}
            <div className="add-student-field">
              <label htmlFor="serial" className="add-student-label">
                Serial Number <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <input
                ref={serialRef}
                id="serial"
                type="number"
                min={1}
                max={999}
                className="input"
                placeholder="e.g. 197"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={isPending}
                autoFocus
              />
              <span className="add-student-hint">
                Numbers 1–999. The full index number is generated automatically.
              </span>
            </div>

            {/* Optional name */}
            <div className="add-student-field">
              <label htmlFor="studentName" className="add-student-label">
                Name{" "}
                <span style={{ fontWeight: 400, color: "var(--color-text-3)", textTransform: "none", letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                id="studentName"
                type="text"
                className="input"
                placeholder="Full name — defaults to index number if blank"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={isPending}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={isPending || !serial}
              style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-2)" }}
            >
              {isPending ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M7 1a6 6 0 1 1-6 6" />
                  </svg>
                  Adding…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="8" cy="7" r="4" />
                    <path d="M2 18c0-3.31 2.69-6 6-6M14 11v6M11 14h6" />
                  </svg>
                  Add Student
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Link to full roster */}
      <div style={{ marginTop: "var(--space-4)" }}>
        <Link
          href="/rep/students"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M13 5l-5 5 5 5" />
          </svg>
          Back to student roster
        </Link>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
