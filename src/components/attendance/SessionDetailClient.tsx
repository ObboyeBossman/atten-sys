"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RaiseDisputeModal } from "./RaiseDisputeModal";

interface DisputeInfo {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  resolution_note: string | null;
  resolved_at: string | null;
}

interface SessionDetailClientProps {
  attendanceId: string;
  canDispute: boolean;
  dispute: DisputeInfo | null;
}

const STATUS_CONFIG = {
  pending: {
    label: "Under review",
    color: "var(--color-warning)",
    bg: "var(--color-warning-bg)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  approved: {
    label: "Approved",
    color: "var(--color-success)",
    bg: "var(--color-success-bg)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  rejected: {
    label: "Rejected",
    color: "var(--color-danger)",
    bg: "var(--color-danger-bg)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
};

export function SessionDetailClient({
  attendanceId,
  canDispute,
  dispute,
}: SessionDetailClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  function handleSuccess() {
    setModalOpen(false);
    router.refresh();
  }

  if (!dispute && !canDispute) return null;

  const cfg = dispute ? STATUS_CONFIG[dispute.status] ?? STATUS_CONFIG.pending : null;

  return (
    <>
      <div
        style={{
          marginTop: "var(--space-6)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-text-3)",
            marginBottom: "var(--space-3)",
          }}
        >
          Dispute
        </h3>

        {dispute && cfg ? (
          <div>
            {/* Status badge — color + icon + text label (never color alone) */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                background: cfg.bg,
                color: cfg.color,
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                marginBottom: "var(--space-3)",
              }}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
            </div>

            {/* Reason */}
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-2)",
                lineHeight: 1.6,
                marginBottom: "var(--space-2)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                Your reason:{" "}
              </span>
              {dispute.reason}
            </p>

            {/* Resolution note (only when resolved) */}
            {(dispute.status === "approved" || dispute.status === "rejected") &&
              dispute.resolution_note && (
                <div
                  style={{
                    marginTop: "var(--space-3)",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    background:
                      dispute.status === "approved"
                        ? "var(--color-success-bg)"
                        : "var(--color-danger-bg)",
                    borderLeft: `3px solid ${dispute.status === "approved" ? "var(--color-success)" : "var(--color-danger)"}`,
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-2)",
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        dispute.status === "approved"
                          ? "var(--color-success)"
                          : "var(--color-danger)",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Lecturer's response:
                  </span>
                  {dispute.resolution_note}
                  {dispute.resolved_at && (
                    <span
                      style={{
                        display: "block",
                        marginTop: "var(--space-1)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-3)",
                      }}
                    >
                      Resolved{" "}
                      {new Date(dispute.resolved_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}

            {dispute.status === "pending" && (
              <p
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-3)",
                }}
              >
                Your dispute is under review. You'll be notified when a decision is made.
              </p>
            )}
          </div>
        ) : (
          /* No dispute yet — show raise button */
          <div>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-2)",
                marginBottom: "var(--space-3)",
                lineHeight: 1.5,
              }}
            >
              Think this record is wrong? Submit a dispute and your lecturer will review it.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="btn btn-secondary"
              style={{ minHeight: 44 }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Raise a dispute
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <RaiseDisputeModal
          attendanceId={attendanceId}
          onSuccess={handleSuccess}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
