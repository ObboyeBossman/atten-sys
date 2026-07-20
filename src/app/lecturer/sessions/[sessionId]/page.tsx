import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Session Detail" };
export const revalidate = 0;

/* ── types ──────────────────────────────────────────────── */
type AttendanceEntry = {
  studentId: string;
  studentName: string;
  indexNumber: string;
  status: "present" | "late" | "absent";
  checkedInAt: string | null;
  geoVerified: boolean;
};

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(startedAt: string, endedAt: string) {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function elapsed(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/* ── data ───────────────────────────────────────────────── */
async function getData(sessionId: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lecturerResult = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  // Session
  type RawSession = {
    id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
    duration_minutes: number;
    course_id: string;
    courses: {
      id: string;
      name: string;
      code: string;
      lecturer_id: string | null;
      group_id: string;
      groups: { group_name: string } | null;
    } | null;
  };

  const sessionResult = await supabase
    .from("class_sessions")
    .select(
      "id, started_at, ended_at, venue, duration_minutes, course_id, courses(id, name, code, lecturer_id, group_id, groups(group_name))"
    )
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionResult.data as unknown as RawSession | null;
  if (!session) notFound();

  // Verify this session belongs to this lecturer's course
  if (session.courses?.lecturer_id !== user.id) redirect("/lecturer/sessions");

  // All enrolled students
  type MemberRow = {
    student_id: string;
    students: { name: string; index_number: string } | null;
  };

  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id, students(name, index_number)")
    .eq("group_id", session.courses?.group_id ?? "")
    .eq("status", "active")
    .order("student_id");

  const members = (membersResult.data ?? []) as unknown as MemberRow[];

  // Attendance records for this session
  type AttRow = {
    student_id: string;
    status: "present" | "late" | "absent";
    checked_in_at: string | null;
    geo_verified: boolean;
  };

  const attResult = await supabase
    .from("attendance")
    .select("student_id, status, checked_in_at, geo_verified")
    .eq("session_id", sessionId);

  const attRows = (attResult.data ?? []) as AttRow[];
  const attMap: Record<string, AttRow> = {};
  attRows.forEach((a) => { attMap[a.student_id] = a; });

  // Build roster: all enrolled students (mark absent if no record)
  const roster: AttendanceEntry[] = members.map((m) => {
    const att = attMap[m.student_id];
    return {
      studentId: m.student_id,
      studentName: m.students?.name ?? "Unknown",
      indexNumber: m.students?.index_number ?? "—",
      status: att?.status ?? "absent",
      checkedInAt: att?.checked_in_at ?? null,
      geoVerified: att?.geo_verified ?? false,
    };
  });

  // Sort: present/late first, then absent
  roster.sort((a, b) => {
    const order = { present: 0, late: 1, absent: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.studentName.localeCompare(b.studentName);
  });

  const presentCount = roster.filter((r) => r.status === "present").length;
  const lateCount = roster.filter((r) => r.status === "late").length;
  const absentCount = roster.filter((r) => r.status === "absent").length;

  return {
    session,
    roster,
    presentCount,
    lateCount,
    absentCount,
    enrolled: members.length,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function SessionDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const { session, roster, presentCount, lateCount, absentCount, enrolled } =
    await getData(params.sessionId);

  const isLive = !session.ended_at;
  const course = session.courses;
  const attendanceRate =
    enrolled > 0
      ? Math.round(((presentCount + lateCount) / enrolled) * 100)
      : null;

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href="/lecturer/sessions"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            textDecoration: "none",
          }}
          className="back-link"
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
            <path d="M13 15l-5-5 5-5" />
          </svg>
          Sessions
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-2)",
          }}
        >
          {isLive && (
            <>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--color-success)",
                  animation: "pulse 2s infinite",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--color-success)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Live · {elapsed(session.started_at)} elapsed
              </span>
            </>
          )}
        </div>
        <h1 className="page-title">
          {course?.code} — {course?.name}
        </h1>
        <p className="page-subtitle">
          {course?.groups?.group_name} ·{" "}
          {isLive
            ? `Started ${fmtTime(session.started_at)}`
            : `${fmtDate(session.started_at)} · ${fmtTime(session.started_at)}`}
          {!isLive && session.ended_at && (
            <> · {fmtDuration(session.started_at, session.ended_at)}</>
          )}
          {session.venue && ` · ${session.venue}`}
        </p>
      </div>

      {/* Stats */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Rate" value={attendanceRate !== null ? `${attendanceRate}%` : "—"} color={attendanceRate !== null ? rateColor(attendanceRate) : undefined} />
        <StatCard label="Present" value={presentCount} color="var(--color-present)" />
        <StatCard label="Late" value={lateCount} color="var(--color-late)" />
        <StatCard label="Absent" value={absentCount} color="var(--color-absent)" />
      </div>

      {/* Roster */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            Attendance Roster
          </h2>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-3)",
            }}
          >
            {enrolled} enrolled
          </span>
        </div>

        {roster.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "var(--space-12) var(--space-6)",
            }}
          >
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
              No students enrolled in this group.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "var(--space-2) var(--space-5)",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
              }}
            >
              <div style={{ flex: 1, fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Student</div>
              <div style={{ width: 80, textAlign: "right", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Time</div>
              <div style={{ width: 80, textAlign: "right", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
            </div>

            {roster.map((entry, i) => (
              <div
                key={entry.studentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "var(--space-3) var(--space-5)",
                  borderBottom:
                    i < roster.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  gap: "var(--space-3)",
                  opacity: entry.status === "absent" ? 0.65 : 1,
                }}
              >
                {/* Avatar */}
                <div
                  className="avatar"
                  style={{
                    flexShrink: 0,
                    background: statusBg(entry.status),
                    color: statusColor(entry.status),
                    fontSize: "var(--text-xs)",
                    fontWeight: 800,
                  }}
                >
                  {entry.studentName.charAt(0).toUpperCase()}
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
                    {entry.studentName}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                      marginTop: 1,
                    }}
                  >
                    {entry.indexNumber}
                    {entry.geoVerified && (
                      <span
                        style={{
                          marginLeft: "var(--space-2)",
                          color: "var(--color-success)",
                        }}
                        title="GPS verified"
                        aria-label="GPS verified"
                      >
                        ✓ GPS
                      </span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-3)",
                  }}
                >
                  {entry.checkedInAt ? fmtTime(entry.checkedInAt) : "—"}
                </div>

                {/* Status badge */}
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                  }}
                >
                  <StatusBadge status={entry.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .back-link:hover { color: var(--color-text-2) !important; }
        @media (max-width: 480px) {
          .stats-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────── */
function rateColor(pct: number) {
  if (pct >= 75) return "var(--color-success)";
  if (pct >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

function statusBg(status: string) {
  if (status === "present") return "var(--color-present-bg)";
  if (status === "late") return "var(--color-late-bg)";
  return "var(--color-absent-bg)";
}

function statusColor(status: string) {
  if (status === "present") return "var(--color-present)";
  if (status === "late") return "var(--color-late)";
  return "var(--color-absent)";
}

function StatusBadge({ status }: { status: "present" | "late" | "absent" }) {
  const map = {
    present: { bg: "var(--color-present-bg)", color: "var(--color-present)", label: "Present" },
    late: { bg: "var(--color-late-bg)", color: "var(--color-late)", label: "Late" },
    absent: { bg: "var(--color-absent-bg)", color: "var(--color-absent)", label: "Absent" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
      }}
    >
      {s.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      className="card"
      style={{ padding: "var(--space-4) var(--space-4)", textAlign: "center" }}
    >
      <div
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          color: color ?? "var(--color-text)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--color-text-3)",
          marginTop: "var(--space-1)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
