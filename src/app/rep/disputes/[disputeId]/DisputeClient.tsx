"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveDispute } from "./actions";

type Props = {
  disputeId: string;
  attendanceId: string;
  studentName: string;
  currentStatus: "present" | "late" | "absent" | null;
};

type ModalState = { action: "approved" | "rejected" } | null;

export function DisputeClient({ disputeId, attendanceId, studentName, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState<"present" | "late" | "absent">(
    currentStatus === "present" ? "present" : "present"
  );
  const [error, setError] = useState<string | null>(null);

  function openModal(action: "approved" | "rejected") {
    setNote("");
    setError(null);
    setModal({ action });
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  function handleSubmit() {
    if (!note.trim()) {
      setError("A resolution note is required.");
      return;
    }

    startTransition(async () => {
      const res = await resolveDispute({
        disputeId,
        attendanceId,
        action: modal!.action,
        resolutionNote: note.trim(),
        newStatus: modal!.action === "approved" ? newStatus : null,
      });

      if ("error" in res) {
        setError(res.error);
      } else {
        router.push("/rep/disputes");
      }
    });
  }

  const isApproving = modal?.action === "approved";

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button
          onClick={() => openModal("approved")}
          className="btn btn-primary"
          style={{ flex: "1 1 auto" }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 5L8 13l-4-4" />
          </svg>
          Approve
        </button>
        <button
          onClick={() => openModal("rejected")}
          className="btn btn-danger"
          style={{ flex: "1 1 auto" }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5L5 15M5 5l10 10" />
          </svg>
          Reject
        </button>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: "var(--space-4)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-2xl)",
            padding: "var(--space-6)",
            width: "100%",
            maxWidth: 480,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            boxShadow: "var(--shadow-xl)",
            animation: "slideUp 220ms cubic-bezier(0.22,1,0.36,1)",
          }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <div>
                <div style={{
                  fontSize: "var(--text-base)", fontWeight: 700,
                  color: isApproving ? "var(--color-success)" : "var(--color-danger)",
                  marginBottom: "var(--space-1)",
                }}>
                  {isApproving ? "Approve Dispute" : "Reject Dispute"}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
                  For {studentName}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5L5 15M5 5l10 10" />
                </svg>
              </button>
            </div>

            {/* Status picker — only when approving */}
            {isApproving && (
              <div className="input-group">
                <label className="label">Mark attendance as</label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {(["present", "late", "absent"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewStatus(s)}
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: newStatus === s
                          ? s === "present" ? "var(--color-present-bg)"
                            : s === "late" ? "var(--color-late-bg)"
                            : "var(--color-absent-bg)"
                          : "var(--color-surface-2)",
                        color: newStatus === s
                          ? s === "present" ? "var(--color-present)"
                            : s === "late" ? "var(--color-late)"
                            : "var(--color-absent)"
                          : "var(--color-text-3)",
                        border: newStatus === s
                          ? `1px solid ${s === "present" ? "rgba(34,197,94,0.4)" : s === "late" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`
                          : "1px solid var(--color-border)",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution note */}
            <div className="input-group">
              <label className="label" htmlFor="resolution-note">
                Resolution note <span style={{ color: "var(--color-danger)", marginLeft: 2 }}>*</span>
              </label>
              <textarea
                id="resolution-note"
                className="input"
                rows={3}
                placeholder={isApproving
                  ? "e.g. Student was present but had check-in technical issues."
                  : "e.g. Student's location was outside the classroom boundary."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: "vertical" }}
                autoFocus
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" /><path d="M10 7v3M10 13h.01" />
                </svg>
                {error}
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className={`btn ${isApproving ? "btn-primary" : "btn-danger"}${isPending ? " btn-loading" : ""}`}
            >
              {!isPending && (isApproving ? "Confirm Approval" : "Confirm Rejection")}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
