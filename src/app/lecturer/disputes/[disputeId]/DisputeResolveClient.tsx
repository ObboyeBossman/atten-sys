"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  disputeId: string;
  attendanceId: string;
  lecturerId: string;
}

export function DisputeResolveClient({ disputeId, attendanceId, lecturerId }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(action: "approve" | "reject") {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch("/api/lecturer/disputes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          attendanceId,
          action,
          note: note.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to resolve dispute");
      }

      router.refresh();
      router.push("/lecturer/disputes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div>
      {/* Note field */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <label
          htmlFor="resolution-note"
          style={{
            display: "block",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-text-2)",
            marginBottom: "var(--space-2)",
          }}
        >
          Resolution note <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>(optional)</span>
        </label>
        <textarea
          id="resolution-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Explain your decision to the student…"
          rows={3}
          disabled={!!loading}
          style={{
            width: "100%",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "var(--text-sm)",
            resize: "vertical",
            outline: "none",
            transition: "border-color var(--transition-fast)",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            background: "var(--color-absent-bg)",
            border: "1px solid rgba(239,68,68,0.25)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "var(--color-absent)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="9" />
            <path d="M10 6v4M10 14h.01" />
          </svg>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button
          onClick={() => handleResolve("approve")}
          disabled={!!loading}
          style={{
            flex: 1,
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "none",
            background: loading === "approve" ? "rgba(16,185,129,0.6)" : "var(--color-success)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "opacity var(--transition-fast)",
          }}
        >
          {loading === "approve" ? (
            <>
              <Spinner />
              Approving…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10l4 4 8-8" />
              </svg>
              Approve
            </>
          )}
        </button>

        <button
          onClick={() => handleResolve("reject")}
          disabled={!!loading}
          style={{
            flex: 1,
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid rgba(239,68,68,0.4)",
            background: loading === "reject" ? "var(--color-absent-bg)" : "transparent",
            color: "var(--color-absent)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "all var(--transition-fast)",
          }}
        >
          {loading === "reject" ? (
            <>
              <Spinner color="var(--color-absent)" />
              Rejecting…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
              Reject
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Spinner({ color = "#fff" }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
