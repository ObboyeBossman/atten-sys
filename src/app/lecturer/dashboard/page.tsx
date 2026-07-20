import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/app/admin/dashboard/DashboardStats";

export const metadata: Metadata = { title: "Dashboard" };
export const revalidate = 30;

/* ── helpers ────────────────────────────────────────────── */
function elapsed(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return `Today · ${fmtTime(iso)}`;
  return d.toLocaleDateString("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function attendanceRate(present: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((present / total) * 100)}%`;
}

/* ── types ──────────────────────────────────────────────── */
type LiveSessionRow = {
  id: string;
  started_at: string;
  venue: string | null;
  courses: { id: string; name: string; code: string; group_id: string } | null;
};

type RecentSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  venue: string | null;
  courses: { name: string; code: string } | null;
  attendance: { id: string; status: string }[];
};

type CourseRow = {
  id: string;
  name: string;
  code: string;
  group_id: string;
};

/* ── data fetching ──────────────────────────────────────── */
async function getLecturerDashboard() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify lecturer identity
  const lecturerResult = await supabase
    .from("lecturers")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();
  const lecturer = lecturerResult.data as { id: string; name: string } | null;
  if (!lecturer) redirect("/login");

  // Active semester
  const semResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const sem = semResult.data as { id: string; name: string } | null;

  // Courses assigned to this lecturer this semester
  const coursesResult = sem
    ? await supabase
        .from("courses")
        .select("id, name, code, group_id")
        .eq("lecturer_id", user.id)
        .eq("semester_id", sem.id)
    : { data: [] };
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const courseIds = courses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      lecturerName: lecturer.name,
      semesterName: sem?.name ?? null,
      totalCourses: 0,
      totalSessions: 0,
      totalStudents: 0,
      overallRate: "—",
      pendingDisputes: 0,
      liveSession: null,
      liveCheckins: 0,
      liveTotal: 0,
      recentSessions: [],
    };
  }

  // Parallel: sessions count, student count, disputes, live session, recent sessions
  const [sessionsRes, disputesRes, liveSessionRes, recentSessionsRes] =
    await Promise.all([
      // Sessions held across all courses
      supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .in("course_id", courseIds)
        .not("ended_at", "is", null),

      // Pending disputes
      supabase
        .from("attendance_disputes")
        .select("id, attendance!inner(class_sessions!inner(course_id))", {
          count: "exact",
          head: true,
        })
        .eq("status", "pending")
        .in("attendance.class_sessions.course_id", courseIds),

      // Any live session for this lecturer's courses
      supabase
        .from("class_sessions")
        .select("id, started_at, venue, courses(id, name, code, group_id)")
        .in("course_id", courseIds)
        .is("ended_at", null)
        .limit(1)
        .maybeSingle(),

      // Last 5 ended sessions
      supabase
        .from("class_sessions")
        .select(
          "id, started_at, ended_at, venue, courses(name, code), attendance(id, status)"
        )
        .in("course_id", courseIds)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

  const totalSessions = sessionsRes.count ?? 0;
  const pendingDisputes = disputesRes.count ?? 0;
  const liveSession =
    (liveSessionRes.data as unknown as LiveSessionRow) ?? null;

  // Student count — unique students across all groups for these courses
  const groupIds = [...new Set(courses.map((c) => c.group_id))];
  const studentsRes = groupIds.length
    ? await supabase
        .from("group_memberships")
        .select("student_id", { count: "exact", head: true })
        .in("group_id", groupIds)
        .eq("status", "active")
    : { count: 0 };
  const totalStudents = studentsRes.count ?? 0;

  // Live session checkin count
  let liveCheckins = 0;
  let liveTotal = 0;
  if (liveSession?.id) {
    const [checkinsRes, liveCourseStudentsRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", liveSession.id)
        .in("status", ["present", "late"]),
      liveSession.courses?.group_id
        ? supabase
            .from("group_memberships")
            .select("student_id", { count: "exact", head: true })
            .eq("group_id", liveSession.courses.group_id)
            .eq("status", "active")
        : Promise.resolve({ count: 0 }),
    ]);
    liveCheckins = checkinsRes.count ?? 0;
    liveTotal = liveCourseStudentsRes.count ?? 0;
  }

  // Overall attendance rate
  let overallRate = "—";
  const attResult = await supabase
    .from("attendance")
    .select("status, class_sessions!inner(course_id)")
    .in("class_sessions.course_id", courseIds);
  const attData = (attResult.data ?? []) as { status: string }[];
  if (attData.length > 0) {
    const present = attData.filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;
    overallRate = attendanceRate(present, attData.length);
  }

  // Shape recent sessions
  const recentSessions = (
    (recentSessionsRes.data ?? []) as unknown as RecentSessionRow[]
  ).map((s) => {
    const att = s.attendance ?? [];
    const checkedIn = att.filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;
    return {
      id: s.id,
      started_at: s.started_at,
      courseName: s.courses?.name ?? "Unknown",
      courseCode: s.courses?.code ?? "",
      checkedIn,
      rate: attendanceRate(checkedIn, checkedIn + att.filter(a => a.status === "absent").length),
    };
  });

  return {
    lecturerName: lecturer.name,
    semesterName: sem?.name ?? null,
    totalCourses: courses.length,
    totalSessions,
    totalStudents,
    overallRate,
    pendingDisputes,
    liveSession,
    liveCheckins,
    liveTotal,
    recentSessions,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerDashboard() {
  const d = await getLecturerDashboard();

  const stats = [
    {
      label: "My Courses",
      value: String(d.totalCourses),
      accent: "var(--color-secondary)",
      sub: d.semesterName ? `This semester` : "No active semester",
    },
    {
      label: "Sessions Run",
      value: String(d.totalSessions),
      accent: "var(--color-warning)",
      sub: d.semesterName ?? "This semester",
    },
    {
      label: "Students",
      value: String(d.totalStudents),
      accent: "var(--color-success)",
      sub: "Across my groups",
    },
    {
      label: "Attendance Rate",
      value: d.overallRate,
      accent: "var(--color-info)",
      sub: "Overall average",
    },
    {
      label: "Disputes",
      value: String(d.pendingDisputes),
      accent:
        d.pendingDisputes > 0
          ? "var(--color-danger)"
          : "var(--color-text-3)",
      sub:
        d.pendingDisputes > 0
          ? "Needs your attention"
          : "All clear",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {d.lecturerName}
            {d.semesterName ? ` · ${d.semesterName}` : ""}
          </p>
        </div>
        {d.pendingDisputes > 0 && (
          <Link
            href="/lecturer/disputes"
            className="btn btn-danger btn-sm dashboard-disputes-btn"
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
              <path d="M10 3L2 17h16L10 3z" />
              <path d="M10 10v3M10 15h.01" />
            </svg>
            {d.pendingDisputes} dispute{d.pendingDisputes !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Stats */}
      <DashboardStats stats={stats} />

      {/* Mobile disputes banner */}
      {d.pendingDisputes > 0 && (
        <Link
          href="/lecturer/disputes"
          className="dashboard-disputes-mobile"
          style={{
            display: "none",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-danger-bg)",
            border: "1px solid rgba(239,68,68,0.25)",
            textDecoration: "none",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: "var(--color-danger)", flexShrink: 0 }}
          >
            <path d="M10 3L2 17h16L10 3z" />
            <path d="M10 10v3M10 15h.01" />
          </svg>
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--color-danger)",
            }}
          >
            {d.pendingDisputes} pending dispute
            {d.pendingDisputes !== 1 ? "s" : ""} — tap to review
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            style={{
              color: "var(--color-danger)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            <path d="M7 5l5 5-5 5" />
          </svg>
        </Link>
      )}

      <div className="dashboard-lower-grid">
        {/* ── Main column ── */}
        <div>
          {d.liveSession ? (
            <LiveSessionCard
              session={d.liveSession}
              checkins={d.liveCheckins}
              total={d.liveTotal}
            />
          ) : (
            <NoSessionCard hasCourses={d.totalCourses > 0} />
          )}

          {/* Recent sessions */}
          <div
            className="card"
            style={{ marginTop: "var(--space-6)", minWidth: 0, overflow: "hidden" }}
          >
            <h2
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 700,
                marginBottom: "var(--space-4)",
                color: "var(--color-text)",
              }}
            >
              Recent Sessions
            </h2>

            {d.recentSessions.length === 0 ? (
              <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
                No sessions held yet
                {d.semesterName ? ` in ${d.semesterName}` : ""}.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1)",
                }}
              >
                {d.recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/lecturer/sessions/${s.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-lg)",
                      textDecoration: "none",
                      transition: "background var(--transition-fast)",
                    }}
                    className="recent-session-row"
                  >
                    {/* Date chip */}
                    <div
                      style={{
                        width: 44,
                        flexShrink: 0,
                        textAlign: "center",
                        background: "var(--color-surface-2)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-2) 0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--color-text-3)",
                          textTransform: "uppercase",
                        }}
                      >
                        {new Date(s.started_at).toLocaleDateString("en-GH", {
                          month: "short",
                        })}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-lg)",
                          fontWeight: 800,
                          color: "var(--color-text)",
                          lineHeight: 1,
                        }}
                      >
                        {new Date(s.started_at).getDate()}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.courseName}
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-3)",
                            fontWeight: 400,
                          }}
                        >
                          {s.courseCode}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-3)",
                          marginTop: 2,
                        }}
                      >
                        {fmtDate(s.started_at)}
                      </div>
                    </div>

                    {/* Rate */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: 700,
                          color:
                            parseInt(s.rate) >= 75
                              ? "var(--color-success)"
                              : parseInt(s.rate) >= 50
                              ? "var(--color-warning)"
                              : s.rate === "—"
                              ? "var(--color-text-3)"
                              : "var(--color-danger)",
                        }}
                      >
                        {s.rate}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-3)",
                        }}
                      >
                        {s.checkedIn} present
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            minWidth: 0,
          }}
        >
          {/* Quick actions */}
          <div className="card">
            <h2
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 700,
                marginBottom: "var(--space-4)",
                color: "var(--color-text)",
              }}
            >
              Quick Actions
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <Link
                href="/lecturer/courses"
                className="btn btn-primary"
                style={{ justifyContent: "flex-start" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="9" />
                  <path d="M10 6v8M6 10h8" />
                </svg>
                Start a Session
              </Link>
              <Link
                href="/lecturer/sessions"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="5" width="12" height="10" rx="1.5" />
                  <path d="M14 8l5-3v9l-5-3" />
                </svg>
                All Sessions
              </Link>
              <Link
                href="/lecturer/groups"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="6" r="3" />
                  <circle cx="13" cy="6" r="3" />
                  <path d="M1 18c0-3.31 2.69-6 6-6M13 12c3.31 0 6 2.69 6 6" />
                </svg>
                My Groups
              </Link>
              <Link
                href="/lecturer/disputes"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 3L2 17h16L10 3z" />
                  <path d="M10 10v3M10 15h.01" />
                </svg>
                Disputes
              </Link>
            </div>
          </div>

          {/* Disputes callout */}
          {d.pendingDisputes > 0 && (
            <Link
              href="/lecturer/disputes"
              style={{
                display: "block",
                padding: "var(--space-4) var(--space-5)",
                borderRadius: "var(--radius-xl)",
                background: "var(--color-danger-bg)",
                border: "1px solid rgba(239,68,68,0.25)",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(239,68,68,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-danger)",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10 3L2 17h16L10 3z" />
                    <path d="M10 10v3M10 15h.01" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-sm)",
                      color: "var(--color-danger)",
                    }}
                  >
                    {d.pendingDisputes} Pending Dispute
                    {d.pendingDisputes !== 1 ? "s" : ""}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                      marginTop: 2,
                    }}
                  >
                    Review and resolve
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Semester badge */}
          <div className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
            <div
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                color: "var(--color-text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "var(--space-2)",
              }}
            >
              Active Semester
            </div>
            {d.semesterName ? (
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text)",
                }}
              >
                {d.semesterName}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-warning)",
                }}
              >
                No active semester — contact admin
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .recent-session-row:hover { background: var(--color-surface-2); }
        @media (max-width: 640px) {
          .dashboard-disputes-btn { display: none; }
          .dashboard-disputes-mobile { display: flex !important; }
          .recent-session-row { padding-left: var(--space-2) !important; padding-right: var(--space-2) !important; }
        }
      `}</style>
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────── */
function LiveSessionCard({
  session,
  checkins,
  total,
}: {
  session: {
    id: string;
    started_at: string;
    venue: string | null;
    courses: { name: string; code: string } | null;
  };
  checkins: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((checkins / total) * 100) : 0;

  return (
    <div
      className="card"
      style={{
        border: "1px solid rgba(34,197,94,0.35)",
        background: "linear-gradient(135deg, rgba(34,197,94,0.06), transparent)",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--color-success)",
            boxShadow: "0 0 0 3px rgba(34,197,94,.25)",
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
          Session Live
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-3)",
          }}
        >
          {elapsed(session.started_at)} elapsed
        </span>
      </div>

      <div style={{ marginBottom: "var(--space-4)", minWidth: 0 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: "var(--text-xl)",
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {session.courses?.name ?? "Unknown Course"}
        </div>
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            marginTop: 2,
          }}
        >
          {session.courses?.code}
          {session.venue && ` · ${session.venue}`}
          {` · Started ${fmtTime(session.started_at)}`}
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-5)", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "var(--space-2)",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-2)",
              fontWeight: 600,
            }}
          >
            Check-ins
          </span>
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            {checkins} / {total}
            <span
              style={{
                fontWeight: 400,
                color: "var(--color-text-3)",
                marginLeft: 4,
              }}
            >
              ({pct}%)
            </span>
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background:
                pct >= 75
                  ? "var(--color-success)"
                  : pct >= 50
                  ? "var(--color-warning)"
                  : "var(--color-danger)",
              borderRadius: "var(--radius-full)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      <Link
        href={`/lecturer/sessions/${session.id}`}
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 10h16M10 4l6 6-6 6" />
        </svg>
        Manage Session
      </Link>
    </div>
  );
}

function NoSessionCard({ hasCourses }: { hasCourses: boolean }) {
  return (
    <div
      className="card"
      style={{ textAlign: "center", padding: "var(--space-10) var(--space-6)" }}
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
          <path d="M12 8v4l3 3" />
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
        No Active Session
      </div>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-5)",
          lineHeight: 1.6,
        }}
      >
        {hasCourses
          ? "Pick a course and start taking attendance."
          : "You have no courses assigned this semester."}
      </p>
      {hasCourses && (
        <Link href="/lecturer/courses" className="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="9" />
            <path d="M10 6v8M6 10h8" />
          </svg>
          Start a Session
        </Link>
      )}
    </div>
  );
}
