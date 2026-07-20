"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { raiseDispute } from "@/actions/disputes";

interface RaiseDisputeModalProps {
  attendanceId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function RaiseDisputeModal({
  attendanceId,
  onSuccess,
  onClose,
}: RaiseDisputeModalProps) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "loading") onClose();
    },
    [onClose, status]
  );
  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSubmit() {
    if (!reason.trim() || status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);

    const result = await raiseDispute({ attendanceId, reason });

    if ("error" in result) {
      setStatus("error");
      setErrorMsg(result.error);
    } else {
      setStatus("success");
      // Let the success animation play before closing
      setTimeout(onSuccess, 1400);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current && status !== "loading") onClose();
  }

  const charCount = reason.trim().length;
  const canSubmit = charCount > 0 && status === "idle";

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        // Desktop: center
      }}
    >
      <style>{`
        @media (min-width: 640px) {
          .dispute-modal-panel {
            border-radius: var(--radius-xl) !important;
            max-width: 480px !important;
            width: 100% !important;
            align-self: center !important;
            margin: auto !important;
          }
        }
        @keyframes slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes success-bloom {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes check-draw {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dispute-modal-panel,
          .dispute-success-icon,
          .dispute-check { animation: none !important; }
        }
      `}</style>

      <div
        className="dispute-modal-panel"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          padding: "var(--space-6)",
          width: "100%",
          maxWidth: "100%",
          boxShadow: "var(--shadow-xl)",
          animation: "slide-up 220ms cubic-bezier(0.22,1,0.36,1) both",
          border: "1px solid var(--color-border)",
          borderBottom: "none",
        }}
      >
        {status === "success" ? (
          /* ── Success state: message blooms from the modal panel's center ── */
          <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
            <div
              className="dispute-success-icon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                marginBottom: "var(--space-4)",
                animation: "success-bloom 400ms cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline
                  className="dispute-check"
                  points="6 14 11 19 22 8"
                  strokeDasharray="24"
                  strokeDashoffset="24"
                  style={{ animation: "check-draw 350ms 200ms ease forwards" }}
                />
              </svg>
            </div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
              Dispute submitted
            </h2>
            <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
              Your lecturer has been notified and will review your case.
            </p>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
              <div>
                <h2
                  id="dispute-modal-title"
                  style={{ fontSize: "var(--text-lg)", fontWeight: 700, lineHeight: 1.3 }}
                >
                  Raise a dispute
                </h2>
                <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", marginTop: 2 }}>
                  Explain why your attendance should be reconsidered.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={status === "loading"}
                aria-label="Close"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-2)",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all var(--transition-fast)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-4)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}. Please try again or contact support.</span>
              </div>
            )}

            <div style={{ marginBottom: "var(--space-5)" }}>
              <label
                htmlFor="dispute-reason"
                style={{
                  display: "block",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  marginBottom: "var(--space-2)",
                  color: "var(--color-text-2)",
                }}
              >
                Your reason
              </label>
              <textarea
                ref={textareaRef}
                id="dispute-reason"
                rows={4}
                placeholder="e.g. I was present and checked in, but the system did not record it correctly…"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                disabled={status === "loading"}
                style={{
                  width: "100%",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3) var(--space-4)",
                  color: "var(--color-text)",
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-sans)",
                  resize: "vertical",
                  minHeight: 100,
                  outline: "none",
                  transition: "border-color var(--transition-fast)",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                aria-describedby="reason-hint"
              />
              <div
                id="reason-hint"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "var(--space-1)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-3)",
                }}
              >
                <span>Be specific — vague reasons are harder to approve.</span>
                <span style={{ color: charCount > 500 ? "var(--color-warning)" : undefined }}>
                  {charCount} chars
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                onClick={onClose}
                disabled={status === "loading"}
                style={{
                  flex: 1,
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-2)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  minHeight: 44,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-busy={status === "loading"}
                style={{
                  flex: 2,
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: canSubmit
                    ? "linear-gradient(135deg, var(--color-primary), var(--color-secondary))"
                    : "var(--color-surface-3)",
                  color: canSubmit ? "#fff" : "var(--color-text-3)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all var(--transition-fast)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  minHeight: 44,
                  boxShadow: canSubmit ? "0 4px 15px var(--color-primary-glow)" : "none",
                }}
              >
                {status === "loading" ? (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.6s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Submitting…
                  </>
                ) : (
                  "Submit dispute"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
