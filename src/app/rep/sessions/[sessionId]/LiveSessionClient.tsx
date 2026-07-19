"use client";

import { useState, useEffect, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { markAttendance, closeSession } from "./actions";
import type { AttendanceEntry } from "./page";

type Props = {
  sessionId: string;
  entries: AttendanceEntry[];
  checkins: number;
  total: number;
  elapsedInitial: string;
  startedAt: string;
};

type StatusBadgeProps = { status: "present" | "late" | "absent" | null; isManual?: boolean };

function StatusBadge({ status, isManual }: StatusBadgeProps) {
  if (!status) {
    return (
      <span style={{
        fontSize: "var(--text-xs)", fontWeight: 600,
        color: "var(--color-text-3)",
        background: "var(--color-surface-2)",
        padding: "2px 8px", borderRadius: "var(--radius-full)",
      }}>
        Pending
      </span>
    );
  }
  const map = {
    present: { bg: "var(--color-present-bg)", color: "var(--color-present)", label: "Present" },
    late: { bg: "var(--color-late-bg)", color: "var(--color-late)", label: "Late" },
    absent: { bg: "var(--color-absent-bg)", color: "var(--color-absent)", label: "Absent" },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 700,
      background: s.bg, color: s.color,
      padding: "2px 8px", borderRadius: "var(--radius-full)",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {s.label}
      {isManual && <span style={{ opacity: 0.7, fontSize: 9 }}>MANUAL</span>}
    </span>
  );
}

function elapsedStr(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function LiveSessionClient({ sessionId, entries: initialEntries, checkins: initialCheckins, total, elapsedInitial, startedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<AttendanceEntry[]>(initialEntries);
  const [elapsed, setElapsed] = useState(elapsedInitial);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markMsg, setMarkMsg] = useState<{ id: string; msg: string } | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endStep, setEndStep] = useState(1);
  const [endError, setEndError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reconnecting, setReconnecting] = useState(false);

  const checkins = entries.filter((e) => e.status === "present" || e.status === "late").length;
  const pct = total > 0 ? Math.round((checkins / total) * 100) : 0;

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(elapsedStr(startedAt)), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel = supabase
      .channel(`session-attendance-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as {
              id: string; student_id: string; status: "present" | "late" | "absent";
              checked_in_at: string | null; geo_verified: boolean; selfie_path: string | null;
            };
            setEntries((prev) =>
              prev.map((e) =>
                e.studentId === row.student_id
                  ? {
                      ...e,
                      attendanceId: row.id,
                      status: row.status,
                      checkedInAt: row.checked_in_at,
                      geoVerified: row.geo_verified,
                      selfiePath: row.selfie_path,
                      isManual: !row.selfie_path,
                    }
                  : e
              )
            );
          }
        }
      )
      .subscribe((status) => {
        setReconnecting(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  async function handleMark(entry: AttendanceEntry, status: "present" | "late" | "absent") {
    setMarkingId(entry.studentId);
    setMarkMsg(null);

    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.studentId === entry.studentId
          ? { ...e, status, isManual: true, attendanceId: e.attendanceId }
          : e
      )
    );

    const res = await markAttendance({
      sessionId,
      studentId: entry.studentId,
      status,
      existingAttendanceId: entry.attendanceId,
    });

    if ("error" in res) {
      // Rollback
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === entry.studentId
            ? { ...e, status: entry.status, isManual: entry.isManual }
            : e
        )
      );
      setMarkMsg({ id: entry.studentId, msg: `Error: ${res.error}` });
    } else {
      setMarkMsg({ id: entry.studentId, msg: `Marked ${entry.studentName} as ${status}.` });
      setTimeout(() => setMarkMsg(null), 3000);
    }
    setMarkingId(null);
  }

  function handleEndConfirm() {
    if (endStep === 1) { setEndStep(2); return; }
    setEndError(null);
    startTransition(async () => {
      const res = await closeSession(sessionId);
      if ("error" in res) {
        setEndError(res.error);
        setEndStep(1);
      } else {
        router.push(`/rep/sessions/${sessionId}/attendance`);
      }
    });
  }

  const filtered = search
    ? entries.filter(
        (e) =>
          e.studentName.toLowerCase().includes(search.toLowerCase()) ||
          e.indexNumber.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  // Sort: checked-in first, then pending, then absent
  const sorted = [...filtered].sort((a, b) => {
    const rank = (e: AttendanceEntry) =>
      e.status === "present" ? 0 : e.status === "late" ? 1 : e.status === null ? 2 : 3;
    return rank(a) - rank(b);
  });

  return (
    <>
      {reconnecting && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-4)" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          Reconnecting to live feed…
        </div>
      )}

      {/* Stats strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-3)",
        marginBottom: "var(--space-5)",
      }}>
        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-success)" }}>{checkins}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>Checked in</div>
        </div>
        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-text)" }}>{total - checkins}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>Pending</div>
        </div>
        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-secondary)" }}>{elapsed}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>Elapsed</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ padding: "var(--space-4) var(--space-5)", marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-2)" }}>Attendance</span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
            {checkins}/{total} <span style={{ fontWeight: 400, color: "var(--color-text-3)" }}>({pct}%)</span>
          </span>
        </div>
        <div style={{ height: 6, background: "var(--color-surface-2)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pct >= 75 ? "var(--color-success)" : pct >= 50 ? "var(--color-warning)" : "var(--color-danger)",
            borderRadius: "var(--radius-full)", transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Search + end session */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)", alignItems: "center" }}>
        <input
          type="search"
          className="input"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          onClick={() => { setShowEndConfirm(true); setEndStep(1); setEndError(null); }}
          className="btn btn-danger"
          style={{ flexShrink: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1.5" />
          </svg>
          End Session
        </button>
      </div>

      {/* Mark message */}
      {markMsg && (
        <div className="alert alert-success" style={{ marginBottom: "var(--space-3)" }}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 5L8 13l-4-4" />
          </svg>
          {markMsg.msg}
        </div>
      )}

      {/* Attendance list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {sorted.length === 0 && (
          <p style={{ padding: "var(--space-6)", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            No students found.
          </p>
        )}
        {sorted.map((entry, i) => (
          <AttendanceRow
            key={entry.studentId}
            entry={entry}
            isLast={i === sorted.length - 1}
            isMarking={markingId === entry.studentId}
            onMark={handleMark}
          />
        ))}
      </div>

      {/* End session confirmation modal */}
      {showEndConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--color-danger-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto var(--space-4)",
                color: "var(--color-danger)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" />
                </svg>
              </div>
              <h2 style={{ fontWeight: 800, marginBottom: "var(--space-2)" }}>
                {endStep === 1 ? "End this session?" : "Are you absolutely sure?"}
              </h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
                {endStep === 1
                  ? "This will close check-in for all students. Students who haven't checked in will be marked absent."
                  : "This action cannot be undone. Tap \"End Session Now\" to confirm."}
              </p>
            </div>

            {endError && (
              <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
                {endError}
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                onClick={() => { setShowEndConfirm(false); setEndStep(1); }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleEndConfirm}
                className={`btn btn-danger${isPending ? " btn-loading" : ""}`}
                style={{ flex: 1 }}
                disabled={isPending}
              >
                {!isPending && (endStep === 1 ? "Continue" : "End Session Now")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Row component ────────────────────────────────────────── */
function AttendanceRow({
  entry,
  isLast,
  isMarking,
  onMark,
}: {
  entry: AttendanceEntry;
  isLast: boolean;
  isMarking: boolean;
  onMark: (e: AttendanceEntry, s: "present" | "late" | "absent") => void;
}) {
  const [open, setOpen] = useState(false);

  function fmtTime(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{
      borderBottom: isLast ? "none" : "1px solid var(--color-border)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
      }}>
        {/* Avatar */}
        <div className="avatar" style={{ flexShrink: 0 }}>
          {entry.studentName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {entry.studentName}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 1, display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <span>{entry.indexNumber}</span>
            {entry.checkedInAt && (
              <span>· {fmtTime(entry.checkedInAt)}</span>
            )}
            {entry.geoVerified && (
              <span style={{ color: "var(--color-success)" }}>✓ GPS</span>
            )}
          </div>
        </div>

        {/* Status + action */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <StatusBadge status={entry.status} isManual={entry.isManual} />
          <button
            onClick={() => setOpen(!open)}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Mark attendance"
            disabled={isMarking}
            style={{ padding: "4px 6px" }}
          >
            {isMarking ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="1" /><circle cx="16" cy="10" r="1" /><circle cx="4" cy="10" r="1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Inline mark dropdown */}
      {open && (
        <div style={{
          padding: "var(--space-2) var(--space-4) var(--space-3)",
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
          display: "flex", gap: "var(--space-2)", flexWrap: "wrap",
        }}>
          {(["present", "late", "absent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { onMark(entry, s); setOpen(false); }}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: "var(--text-xs)",
                borderColor: s === "present" ? "rgba(34,197,94,0.4)" : s === "late" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)",
                color: s === "present" ? "var(--color-present)" : s === "late" ? "var(--color-late)" : "var(--color-absent)",
              }}
            >
              Mark {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm" style={{ fontSize: "var(--text-xs)" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

