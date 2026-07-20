import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sessions" };
export const revalidate = 0;

/* ── types ──────────────────────────────────────────────── */
type SessionRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  venue: string | null;
  durationMinutes: number;
  courseName: string;
  courseCode: string;
  groupName: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalEnrolled: number;
};

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function elapsed(startedAt: string) {
  const diff = Date.now() - new Date(startedAt).getTime();
  return fmtDuration(diff);
}

/* ── data ───────────────────────────────────────────────── */
async function getData() {
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

  // All courses assigned to this lecturer (all time)
  type RawCourse = {
    id: string;
    name: string;
    code: string;
    group_id: string;
    groups: { group_name: string } | null;
  };

  const coursesResult = await supabase
    .from("courses")
    .select("id, name, code, group_id, groups(group_name)")
    .eq("lecturer_id", user.id);

  const courses = (coursesResult.data ?? []) as unknown as RawCourse[];
  if (courses.length === 0) return { sessions: [], liveCount: 0 };

  const courseIds = courses.map((c) => c.id);
  const courseMap: Record<string, RawCourse> = {};
  courses.forEach((c) => { courseMap[c.id] = c; });

  // All sessions for these courses
  type RawSession = {
    id: string;
    course_id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
    duration_minutes: number;
  };

  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id, course_id, started_at, ended_at, venue, duration_minutes")
    .in("course_id", courseIds)
    .order("started_at", { ascending: false });

  const rawSessions = (sessionsResult.data ?? []) as unknown as RawSession[];
  if (rawSessions.length === 0) return { sessions: [], liveCount: 0 };

  const sessionIds = rawSessions.map((s) => s.id);

  // Attendance counts for each session
  type AttRow = { session_id: string; status: string };
  const attResult = await supabase
    .from("attendance")
    .select("session_id, status")
    .in("session_id", sessionIds);
  const attRows = (attResult.data ?? []) as AttRow[];

  const attMap: Record<string, { present: number; late: number; absent: number }> = {};
  attRows.forEach((a) => {
    if (!attMap[a.session_id]) attMap[a.session_id] = { present: 0, late: 0, absent: 0 };
    if (a.status === "present") attMap[a.session_id].present++;
    else if (a.status === "late") attMap[a.session_id].late++;
    else if (a.status === "absent") attMap[a.session_id].absent++;
  });

  // Enrolled students per group (for total column)
  const groupIds = [...new Set(courses.map((c) => c.group_id))];
  type MemberRow = { group_id: string };
  const membersResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "active");
  const memberRows = (membersResult.data ?? []) as MemberRow[];
  const enrolledMap: Record<string, number> = {};
  memberRows.forEach((m) => {
    enrolledMap[m.group_id] = (enrolledMap[m.group_id] ?? 0) + 1;
  });

  const sessions: SessionRow[] = rawSessions.map((s) => {
    const course = courseMap[s.course_id];
    const att = attMap[s.id] ?? { present: 0, late: 0, absent: 0 };
    return {
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      venue: s.venue,
      durationMinutes: s.duration_minutes,
      courseName: course?.name ?? "Unknown Course",
      courseCode: course?.code ?? "",
      groupName: course?.groups?.group_name ?? "Unknown Group",
      presentCount: att.present,
      lateCount: att.late,
      absentCount: att.absent,
      totalEnrolled: enrolledMap[course?.group_id ?? ""] ?? 0,
    };
  });

  const liveCount = sessions.filter((s) => !s.endedAt).length;

  return { sessions, liveCount };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerSessionsPage() {
  const { sessions, liveCount } = await getData();

  const liveSessions = sessions.filter((s) => !s.endedAt);
  const pastSessions = sessions.filter((s) => s.endedAt);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">
            All attendance sessions across your courses
          </p>
        </div>
        {liveCount > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-full)",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--color-success)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-success)",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            {liveCount} Live
          </div>
        )}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-16) var(--space-6)" }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--color-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-4)",
              color: "var(--color-text-3)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "var(--text-base)",
              color: "var(--color-text)",
              marginBottom: "var(--space-1)",
            }}
          >
            No sessions yet
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Start a session from a course to record attendance.
          </p>
          <div style={{ marginTop: "var(--space-5)" }}>
            <Link
              href="/lecturer/courses"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-5)",
                borderRadius: "var(--radius-base)",
                background: "var(--color-primary)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                textDecoration: "none",
                transition: "opacity var(--transition-fast)",
              }}
            >
              Go to Courses
            </Link>
          </div>
        </div>
      )}

      {/* Live sessions */}
      {liveSessions.length > 0 && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h2
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "var(--space-3)",
            }}
          >
            Live Now
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {liveSessions.map((s) => (
              <SessionCard key={s.id} session={s} isLive />
            ))}
          </div>
        </div>
      )}

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "var(--space-3)",
            }}
          >
            Past Sessions
          </h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {pastSessions.map((s, i) => (
              <Link
                key={s.id}
                href={`/lecturer/sessions/${s.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-4) var(--space-5)",
                  borderBottom:
                    i < pastSessions.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  textDecoration: "none",
                  transition: "background var(--transition-fast)",
                }}
                className="session-row"
              >
                {/* Left: date block */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-base)",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "var(--color-text)",
                    }}
                  >
                    {new Date(s.startedAt).getDate()}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--color-text-3)",
                      textTransform: "uppercase",
                    }}
                  >
                    {new Date(s.startedAt).toLocaleDateString("en-GH", {
                      month: "short",
                    })}
                  </span>
                </div>

                {/* Middle: course + time */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.courseCode} — {s.courseName}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                      marginTop: 2,
                    }}
                  >
                    {fmtTime(s.startedAt)}
                    {s.endedAt &&
                      ` · ${fmtDuration(
                        new Date(s.endedAt).getTime() -
                          new Date(s.startedAt).getTime()
                      )}`}
                    {s.venue && ` · ${s.venue}`}
                  </div>
                </div>

                {/* Right: attendance summary */}
                <div
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 700,
                      color:
                        s.totalEnrolled > 0
                          ? getAttColor(
                              ((s.presentCount + s.lateCount) / s.totalEnrolled) *
                                100
                            )
                          : "var(--color-text-3)",
                    }}
                  >
                    {s.totalEnrolled > 0
                      ? `${Math.round(
                          ((s.presentCount + s.lateCount) / s.totalEnrolled) *
                            100
                        )}%`
                      : "—"}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    {s.presentCount + s.lateCount}/{s.totalEnrolled}
                  </div>
                </div>

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, color: "var(--color-text-3)" }}
                  aria-hidden="true"
                >
                  <path d="M7 5l5 5-5 5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .session-row:hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  );
}

/* ── live session card ──────────────────────────────────── */
function SessionCard({
  session: s,
  isLive,
}: {
  session: SessionRow;
  isLive: boolean;
}) {
  return (
    <Link href={`/lecturer/sessions/${s.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card live-card"
        style={{
          padding: "var(--space-5)",
          borderColor: "rgba(16,185,129,0.35)",
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, var(--color-surface) 60%)",
          cursor: "pointer",
          transition: "all var(--transition-base)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-1)",
              }}
            >
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
                  letterSpacing: "0.05em",
                }}
              >
                Live
              </span>
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "var(--text-base)",
                color: "var(--color-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.courseCode} — {s.courseName}
            </div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-3)",
                marginTop: "var(--space-1)",
              }}
            >
              {s.groupName} · Started {new Date(s.startedAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {elapsed(s.startedAt)} elapsed
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 800,
                color: "var(--color-success)",
              }}
            >
              {s.presentCount + s.lateCount}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-3)",
              }}
            >
              checked in
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function getAttColor(pct: number) {
  if (pct >= 75) return "var(--color-success)";
  if (pct >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}
