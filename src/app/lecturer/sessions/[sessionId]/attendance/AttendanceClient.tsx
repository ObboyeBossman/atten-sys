"use client";

import { useState } from "react";
import { markAttendance } from "../actions";

export type AttendanceRow = {
  attendanceId: string | null;
  studentId: string;
  studentName: string;
  indexNumber: string;
  status: "present" | "late" | "absent" | null;
  checkedInAt: string | null;
  geoVerified: boolean;
  isManual: boolean;
};

type Props = {
  sessionId: string;
  rows: AttendanceRow[];
  totalStudents: number;
  courseName: string;
  courseCode: string;
  sessionDate: string;
  isLive: boolean;
};

type StatusFilter = "all" | "present" | "late" | "absent";

function StatusBadge({
  status,
  isManual,
}: {
  status: "present" | "late" | "absent" | null;
  isManual?: boolean;
}) {
  if (!status) {
    return (
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--color-absent)",
          background: "var(--color-absent-bg)",
          padding: "2px 8px",
          borderRadius: "var(--radius-full)",
        }}
      >
        Absent
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
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {s.label}
      {isManual && <span style={{ opacity: 0.6, fontSize: 9 }}>MANUAL</span>}
    </span>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceClient({
  sessionId,
  rows: initialRows,
  totalStudents,
  courseName,
  courseCode,
  sessionDate,
  isLive,
}: Props) {
  const [rows, setRows] = useState<AttendanceRow[]>(initialRows);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markMsg, setMarkMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = rows
    .filter((r) => {
      if (filter === "all") return true;
      if (filter === "absent") return r.status === "absent" || r.status === null;
      return r.status === filter;
    })
    .filter(
      (r) =>
        !search ||
        r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.indexNumber.toLowerCase().includes(search.toLowerCase())
    );

  const presentCount = rows.filter((r) => r.status === "present").length;
  const lateCount = rows.filter((r) => r.status === "late").length;
  const absentCount = rows.filter(
    (r) => r.status === "absent" || r.status === null
  ).length;

  async function handleMark(
    row: AttendanceRow,
    status: "present" | "late" | "absent"
  ) {
    setMarkingId(row.studentId);
    setMarkMsg(null);

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === row.studentId ? { ...r, status, isManual: true } : r
      )
    );

    const res = await markAttendance({
      sessionId,
      studentId: row.studentId,
      status,
      existingAttendanceId: row.attendanceId,
    });

    if ("error" in res) {
      // Rollback
      setRows((prev) =>
        prev.map((r) =>
          r.studentId === row.studentId
            ? { ...r, status: row.status, isManual: row.isManual }
            : r
        )
      );
      setMarkMsg(`Error: ${res.error}`);
    } else {
      setMarkMsg(`Updated ${row.studentName} to ${status}.`);
      setTimeout(() => setMarkMsg(null), 3000);
    }

    setMarkingId(null);
    setOpenId(null);
  }

  function handleExport() {
    const header = [
      "Index Number",
      "Name",
      "Status",
      "Check-in Time",
      "GPS Verified",
      "Manual",
    ];
    const data = rows.map((r) => [
      r.indexNumber,
      r.studentName,
      r.status ?? "absent",
      fmtTime(r.checkedInAt),
      r.geoVerified ? "Yes" : "No",
      r.isManual ? "Yes" : "No",
    ]);
    const csv = [header, ...data]
      .map((row) =>
        row
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseCode}-${sessionDate}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
        }}
        className="att-stats"
      >
        {[
          { label: "Total", value: totalStudents, color: "var(--color-text)" },
          { label: "Present", value: presentCount, color: "var(--color-present)" },
          { label: "Late", value: lateCount, color: "var(--color-late)" },
          { label: "Absent", value: absentCount, color: "var(--color-absent)" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="card"
            style={{ padding: "var(--space-4)", textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 800,
                color,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-3)",
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          className="input"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 160px", minWidth: 0 }}
          aria-label="Search students"
        />
        <div
          style={{
            display: "flex",
            gap: "var(--space-1)",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {(["all", "present", "late", "absent"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${
                filter === f ? "btn-primary" : "btn-secondary"
              }`}
              style={{
                textTransform: "capitalize",
                padding: "0.375rem 0.625rem",
              }}
            >
              {f === "all"
                ? `All (${totalStudents})`
                : f === "present"
                ? `Present (${presentCount})`
                : f === "late"
                ? `Late (${lateCount})`
                : `Absent (${absentCount})`}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          title={`Export ${courseCode} ${sessionDate} attendance as CSV`}
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
            <path d="M10 2v10M6 8l4 4 4-4M3 16h14" />
          </svg>
          <span className="hide-mobile-xs">Export CSV</span>
        </button>
      </div>

      {/* Mark message */}
      {markMsg && (
        <div
          className={`alert ${markMsg.startsWith("Error") ? "alert-error" : "alert-success"}`}
          style={{ marginBottom: "var(--space-3)" }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {markMsg.startsWith("Error") ? (
              <>
                <circle cx="10" cy="10" r="9" />
                <path d="M10 7v3M10 13h.01" />
              </>
            ) : (
              <path d="M16 5L8 13l-4-4" />
            )}
          </svg>
          {markMsg}
        </div>
      )}

      {/* Attendance list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 && (
          <p
            style={{
              padding: "var(--space-6)",
              textAlign: "center",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-3)",
            }}
          >
            No students match this filter.
          </p>
        )}
        {filtered.map((row, i) => (
          <div
            key={row.studentId}
            style={{
              borderBottom:
                i < filtered.length - 1
                  ? "1px solid var(--color-border)"
                  : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3) var(--space-4)",
              }}
            >
              {/* Avatar */}
              <div className="avatar" style={{ flexShrink: 0 }}>
                {row.studentName.charAt(0).toUpperCase()}
              </div>

              {/* Name + index */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.studentName}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-3)",
                    marginTop: 1,
                    display: "flex",
                    gap: "var(--space-2)",
                  }}
                >
                  <span>{row.indexNumber}</span>
                  {row.checkedInAt && <span>· {fmtTime(row.checkedInAt)}</span>}
                  {row.geoVerified && (
                    <span style={{ color: "var(--color-success)" }}>✓ GPS</span>
                  )}
                </div>
              </div>

              {/* Status + override button */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <StatusBadge status={row.status} isManual={row.isManual} />
                <button
                  onClick={() =>
                    setOpenId(openId === row.studentId ? null : row.studentId)
                  }
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="Override attendance status"
                  disabled={markingId === row.studentId}
                  style={{ padding: "4px 6px" }}
                >
                  {markingId === row.studentId ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="animate-spin"
                      aria-hidden="true"
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
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
                      <path d="M11 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7" />
                      <path d="M9 11l7-7" />
                      <path d="M15 4h3v3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Inline status override */}
            {openId === row.studentId && (
              <div
                style={{
                  padding: "var(--space-2) var(--space-4) var(--space-3)",
                  borderTop: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-3)",
                    fontWeight: 500,
                    marginRight: "var(--space-1)",
                  }}
                >
                  Correct to:
                </span>
                {(["present", "late", "absent"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleMark(row, s)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: "var(--text-xs)",
                      color:
                        s === "present"
                          ? "var(--color-present)"
                          : s === "late"
                          ? "var(--color-late)"
                          : "var(--color-absent)",
                      borderColor:
                        s === "present"
                          ? "rgba(34,197,94,0.4)"
                          : s === "late"
                          ? "rgba(245,158,11,0.4)"
                          : "rgba(239,68,68,0.4)",
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => setOpenId(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isLive && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-3)",
            marginTop: "var(--space-3)",
            textAlign: "center",
          }}
        >
          Session is still live — records will update in real-time.
        </p>
      )}

      <style>{`
        @media (max-width: 600px) {
          .att-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media print {
          .btn, input[type="search"] { display: none !important; }
        }
      `}</style>
    </>
  );
}
