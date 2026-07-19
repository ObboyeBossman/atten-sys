import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/app/admin/dashboard/DashboardStats";

export const metadata: Metadata = { title: "Dashboard" };
export const revalidate = 30;

/* ── helpers ─────────────────────────────────────────────── */
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

/* ── explicit result types (avoid Supabase never inference) ── */
type LiveSessionRow = {
  id: string;
  started_at: string;
  venue: string | null;
  courses: { id: string; name: string; code: string } | null;
};

type RecentSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  venue: string | null;
  courses: { name: string; code: string } | null;
  attendance: { id: string; status: string }[];
};

/* ── data fetching ───────────────────────────────────────── */
async function getRepDashboard() {
  const supabase = await createSupabaseServerClient();

  // Resolve rep's identity
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch membership — split from group fetch to avoid never inference
  const membershipResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .maybeSingle();

  // Cast explicitly; TypeScript can't narrow after redirect()
  const membershipData = membershipResult.data as { group_id: string } | null;
  if (!membershipData) redirect("/student/dashboard");

  const groupId = (membershipData as { group_id: string }).group_id;

  // Fetch group name separately
  const groupResult = await supabase
    .from("groups")
    .select("group_name")
    .eq("id", groupId)
    .maybeSingle();
  const groupData = groupResult.data as { group_name: string } | null;

  // Active semester
  const semesterResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const semesterData = semesterResult.data as { id: string; name: string } | null;
  const semesterId = semesterData?.id ?? null;

  // All parallel fetches
  const [
    rosterRes,
    coursesRes,
    liveSessionRes,
    recentSessionsRes,
    disputesRes,
  ] = await Promise.all([
    // Total active students in group
    supabase
      .from("group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("status", "active"),

    // Courses this semester
    semesterId
      ? supabase
          .from("courses")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("semester_id", semesterId)
      : Promise.resolve({ count: 0, data: null, error: null }),

    // Any live session for this group
    supabase
      .from("class_sessions")
      .select("id, started_at, venue, courses!inner(id, name, code, group_id)")
      .eq("courses.group_id", groupId)
      .is("ended_at", null)
      .limit(1)
      .maybeSingle(),

    // Last 5 ended sessions
    supabase
      .from("class_sessions")
      .select("id, started_at, ended_at, venue, courses!inner(name, code, group_id), attendance(id, status)")
      .eq("courses.group_id", groupId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5),

    // Pending disputes
    supabase
      .from("attendance_disputes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // Sessions held this semester (scoped to group)
  const sessionsHeld = semesterId
    ? await supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("courses.group_id", groupId)
        .not("ended_at", "is", null)
    : { count: 0 };

  // Attendance stats for group overall this semester
  let overallRate = "—";
  if (semesterId) {
    const attResult = await supabase
      .from("attendance")
      .select("status, class_sessions!inner(course_id, courses!inner(group_id, semester_id))")
      .eq("class_sessions.courses.group_id", groupId)
      .eq("class_sessions.courses.semester_id", semesterId);

    const attData = (attResult.data ?? []) as { status: string }[];
    if (attData.length > 0) {
      const present = attData.filter(
        (a) => a.status === "present" || a.status === "late"
      ).length;
      overallRate = attendanceRate(present, attData.length);
    }
  }

  // Live session + checkin count
  const liveSession = (liveSessionRes.data as unknown as LiveSessionRow) ?? null;
  let liveCheckins = 0;
  if (liveSession?.id) {
    const { count } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", liveSession.id);
    liveCheckins = count ?? 0;
  }

  const totalStudents = rosterRes.count ?? 0;
  const totalCourses = coursesRes.count ?? 0;
  const totalSessions = sessionsHeld.count ?? 0;
  const pendingDisputes = disputesRes.count ?? 0;

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
      total: totalStudents,
      rate: attendanceRate(checkedIn, totalStudents),
    };
  });

  return {
    groupName: groupData?.group_name ?? "Your Group",
    semesterName: semesterData?.name ?? null,
    totalStudents,
    totalCourses,
    totalSessions,
    overallRate,
    pendingDisputes,
    liveSession,
    liveCheckins,
    recentSessions,
  };
}

/* ── page ────────────────────────────────────────────────── */
export default async function RepDashboard() {
  const d = await getRepDashboard();

  const stats = [
    {
      label: "Students",
      value: String(d.totalStudents),
      accent: "var(--color-success)",
      sub: "Active in group",
    },
    {
      label: "Courses",
      value: String(d.totalCourses),
      accent: "var(--color-secondary)",
      sub: d.semesterName ? `This semester` : "No active semester",
    },
    {
      label: "Sessions Held",
      value: String(d.totalSessions),
      accent: "var(--color-warning)",
      sub: d.semesterName ?? "This semester",
    },
    {
      label: "Attendance Rate",
      value: d.overallRate,
      accent: "var(--color-info)",
      sub: "Group average",
    },
    {
      label: "Pending Disputes",
      value: String(d.pendingDisputes),
      accent: d.pendingDisputes > 0 ? "var(--color-danger)" : "var(--color-text-3)",
      sub: d.pendingDisputes > 0 ? "Needs your attention" : "All clear",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {d.groupName}
            {d.semesterName ? ` · ${d.semesterName}` : ""}
          </p>
        </div>
        {d.pendingDisputes > 0 && (
          <Link href="/rep/disputes" className="btn btn-danger btn-sm dashboard-disputes-btn">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 2v12h8l4-4V2H4zM12 14v4" />
            </svg>
            {d.pendingDisputes} dispute{d.pendingDisputes !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Stats */}
      <DashboardStats stats={stats} />

      {/* Mobile-only disputes banner (header button hidden on ≤640px) */}
      {d.pendingDisputes > 0 && (
        <Link
          href="/rep/disputes"
          className="dashboard-disputes-mobile"
          style={{
            display: "none", // shown via CSS on ≤640px
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
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-danger)", flexShrink: 0 }}>
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-danger)" }}>
            {d.pendingDisputes} pending dispute{d.pendingDisputes !== 1 ? "s" : ""} — tap to review
          </span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ color: "var(--color-danger)", marginLeft: "auto", flexShrink: 0 }}>
            <path d="M7 5l5 5-5 5" />
          </svg>
        </Link>
      )}

      <div className="dashboard-lower-grid">
        {/* ── Active / No session card ── */}
        <div>
          {d.liveSession ? (
            <LiveSessionCard
              session={d.liveSession}
              checkins={d.liveCheckins}
              total={d.totalStudents}
            />
          ) : (
            <NoSessionCard />
          )}

          {/* Recent sessions */}
          <div className="card" style={{ marginTop: "var(--space-6)", minWidth: 0, overflow: "hidden" }}>
            <h2 style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              marginBottom: "var(--space-4)",
              color: "var(--color-text)",
            }}>
              Recent Sessions
            </h2>

            {d.recentSessions.length === 0 ? (
              <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
                No sessions held yet this semester.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {d.recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/rep/sessions/${s.id}/attendance`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) var(--space-3)",
                      borderRadius: "var(--radius-lg)",
                      textDecoration: "none",
                      transition: "background var(--transition-fast)",
                    }}
                    className="recent-session-row"
                  >
                    {/* Date */}
                    <div style={{
                      width: 44,
                      flexShrink: 0,
                      textAlign: "center",
                      background: "var(--color-surface-2)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-2) 0",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase" }}>
                        {new Date(s.started_at).toLocaleDateString("en-GH", { month: "short" })}
                      </div>
                      <div style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--color-text)", lineHeight: 1 }}>
                        {new Date(s.started_at).getDate()}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.courseName}
                        <span style={{ marginLeft: 6, fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 400 }}>
                          {s.courseCode}
                        </span>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                        {fmtTime(s.started_at)}
                      </div>
                    </div>

                    {/* Rate */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 700,
                        color: parseInt(s.rate) >= 75
                          ? "var(--color-success)"
                          : parseInt(s.rate) >= 50
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                      }}>
                        {s.rate}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                        {s.checkedIn}/{s.total}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick actions sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
          {/* Quick actions */}
          <div className="card">
            <h2 style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              marginBottom: "var(--space-4)",
              color: "var(--color-text)",
            }}>
              Quick Actions
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Link href="/rep/courses" className="btn btn-primary" style={{ justifyContent: "flex-start" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" />
                  <path d="M10 6v4l3 3" />
                </svg>
                Open New Session
              </Link>
              <Link href="/rep/students/add" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="8" cy="7" r="4" />
                  <path d="M2 18c0-3.31 2.69-6 6-6M14 11v6M11 14h6" />
                </svg>
                Add Student
              </Link>
              <Link href="/rep/students" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="7" cy="6" r="3" />
                  <circle cx="13" cy="6" r="3" />
                  <path d="M1 18c0-3.31 2.69-6 6-6M13 12c3.31 0 6 2.69 6 6" />
                </svg>
                View Roster
              </Link>
              <Link href="/rep/timetable" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="16" height="15" rx="1.5" />
                  <path d="M2 8h16M7 1v4M13 1v4" />
                </svg>
                Timetable
              </Link>
            </div>
          </div>

          {/* Disputes callout */}
          {d.pendingDisputes > 0 && (
            <Link
              href="/rep/disputes"
              style={{
                display: "block",
                padding: "var(--space-4) var(--space-5)",
                borderRadius: "var(--radius-xl)",
                background: "var(--color-danger-bg)",
                border: "1px solid rgba(239,68,68,0.25)",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(239,68,68,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-danger)",
                  flexShrink: 0,
                }}>
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 3L2 17h16L10 3z" />
                    <path d="M10 10v3M10 15h.01" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-danger)" }}>
                    {d.pendingDisputes} Pending Dispute{d.pendingDisputes !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                    Tap to review and resolve
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Semester info */}
          <div className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
              Active Semester
            </div>
            {d.semesterName ? (
              <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                {d.semesterName}
              </div>
            ) : (
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-warning)" }}>
                No active semester — contact admin
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover style for recent session rows + mobile tweaks */}
      <style>{`
        .recent-session-row:hover { background: var(--color-surface-2); }
        @media (max-width: 640px) {
          /* Hide the header button — the disputes callout card in the grid is the CTA */
          .dashboard-disputes-btn { display: none; }
          /* Show the mobile disputes banner below stats */
          .dashboard-disputes-mobile { display: flex !important; }
          /* Tighter recent session row on small screens */
          .recent-session-row { padding-left: var(--space-2) !important; padding-right: var(--space-2) !important; }
        }
      `}</style>
    </div>
  );
}

/* ── sub-components ──────────────────────────────────────── */
function LiveSessionCard({
  session,
  checkins,
  total,
}: {
  session: { id: string; started_at: string; venue: string | null; courses: { name: string; code: string } | null };
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
      {/* Live pulse header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <span style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--color-success)",
          boxShadow: "0 0 0 3px rgba(34,197,94,.25)",
          animation: "pulse 2s infinite",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Session Live
        </span>
        <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
          {elapsed(session.started_at)} elapsed
        </span>
      </div>

      {/* Course info */}
      <div style={{ marginBottom: "var(--space-4)", minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.courses?.name ?? "Unknown Course"}
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginTop: 2 }}>
          {session.courses?.code}
          {session.venue && ` · ${session.venue}`}
          {` · Started ${fmtTime(session.started_at)}`}
        </div>
      </div>

      {/* Check-in progress */}
      <div style={{ marginBottom: "var(--space-5)", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", fontWeight: 600 }}>
            Check-ins
          </span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
            {checkins} / {total}
            <span style={{ fontWeight: 400, color: "var(--color-text-3)", marginLeft: 4 }}>
              ({pct}%)
            </span>
          </span>
        </div>
        <div style={{
          height: 6,
          background: "var(--color-surface-2)",
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: pct >= 75
              ? "var(--color-success)"
              : pct >= 50
              ? "var(--color-warning)"
              : "var(--color-danger)",
            borderRadius: "var(--radius-full)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      <Link href={`/rep/sessions/${session.id}`} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 10h16M10 4l6 6-6 6" />
        </svg>
        Manage Session
      </Link>
    </div>
  );
}

function NoSessionCard() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "var(--space-10) var(--space-6)" }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--color-surface-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto var(--space-4)",
        color: "var(--color-text-3)",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      </div>
      <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
        No Active Session
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
        Students are waiting. Pick a course to start a session.
      </p>
      <Link href="/rep/courses" className="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="10" cy="10" r="9" />
          <path d="M10 6v8M6 10h8" />
        </svg>
        Start a Session
      </Link>
    </div>
  );
}
