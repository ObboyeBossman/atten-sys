import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/app/admin/dashboard/DashboardStats";
import s from "./page.module.css";

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

/** Map a numeric rate string → semantic level for data-level CSS attribute */
function rateLevel(rate: string): "good" | "medium" | "low" | "none" {
  if (rate === "—") return "none";
  const n = parseInt(rate, 10);
  if (n >= 75) return "good";
  if (n >= 50) return "medium";
  return "low";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membershipResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .maybeSingle();

  const membershipData = membershipResult.data as { group_id: string } | null;
  if (!membershipData) redirect("/student/dashboard");

  const groupId = (membershipData as { group_id: string }).group_id;

  const groupResult = await supabase
    .from("groups")
    .select("group_name")
    .eq("id", groupId)
    .maybeSingle();
  const groupData = groupResult.data as { group_name: string } | null;

  const semesterResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const semesterData = semesterResult.data as { id: string; name: string } | null;
  const semesterId = semesterData?.id ?? null;

  const [
    rosterRes,
    coursesRes,
    liveSessionRes,
    recentSessionsRes,
    disputesRes,
  ] = await Promise.all([
    supabase
      .from("group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("status", "active"),

    semesterId
      ? supabase
          .from("courses")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("semester_id", semesterId)
      : Promise.resolve({ count: 0, data: null, error: null }),

    supabase
      .from("class_sessions")
      .select("id, started_at, venue, courses!inner(id, name, code, group_id)")
      .eq("courses.group_id", groupId)
      .is("ended_at", null)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("class_sessions")
      .select("id, started_at, ended_at, venue, courses!inner(name, code, group_id), attendance(id, status)")
      .eq("courses.group_id", groupId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5),

    supabase
      .from("attendance_disputes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const sessionsHeld = semesterId
    ? await supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("courses.group_id", groupId)
        .not("ended_at", "is", null)
    : { count: 0 };

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
  ).map((session) => {
    const att = session.attendance ?? [];
    const checkedIn = att.filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;
    return {
      id: session.id,
      started_at: session.started_at,
      courseName: session.courses?.name ?? "Unknown",
      courseCode: session.courses?.code ?? "",
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
      sub: d.semesterName ? "This semester" : "No active semester",
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
    <div className={s.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className={s.header}>
        <div className={s.headerText}>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {d.groupName}
            {d.semesterName ? ` · ${d.semesterName}` : ""}
          </p>
        </div>

        {d.pendingDisputes > 0 && (
          <Link
            href="/rep/disputes"
            className={`btn btn-danger btn-sm ${s.disputesBtn}`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
            </svg>
            {d.pendingDisputes} dispute{d.pendingDisputes !== 1 ? "s" : ""}
          </Link>
        )}
      </header>

      {/* ── Stats ──────────────────────────────────────────── */}
      <DashboardStats stats={stats} />

      {/* ── Mobile disputes banner ─────────────────────────── */}
      {d.pendingDisputes > 0 && (
        <Link href="/rep/disputes" className={s.disputesBanner}>
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
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          <span className={s.disputesBannerText}>
            {d.pendingDisputes} pending dispute{d.pendingDisputes !== 1 ? "s" : ""} — tap to review
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
            className={s.disputesBannerChevron}
          >
            <path d="M7 5l5 5-5 5" />
          </svg>
        </Link>
      )}

      {/* ── Lower grid ─────────────────────────────────────── */}
      <div className={s.lowerGrid}>

        {/* ── Main column ── */}
        <div className={s.mainCol}>
          {d.liveSession ? (
            <LiveSessionCard
              session={d.liveSession}
              checkins={d.liveCheckins}
              total={d.totalStudents}
            />
          ) : (
            <NoSessionCard hasCourses={d.totalCourses > 0} />
          )}

          {/* Recent Sessions */}
          <div className={`card ${s.recentCard}`}>
            <h2 className={s.recentTitle}>Recent Sessions</h2>

            {d.recentSessions.length === 0 ? (
              <div className={s.recentEmptyState}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-text-3)", marginBottom: "var(--space-3)" }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                </svg>
                <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>No sessions yet</p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: "var(--space-1) 0 0" }}>
                  {d.totalCourses > 0 ? "Open a session from a course page to get started." : "Add your courses first, then open sessions."}
                </p>
              </div>
            ) : (
              <div className={s.recentList}>
                {d.recentSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/rep/sessions/${session.id}/attendance`}
                    className={s.recentRow}
                  >
                    {/* Date chip */}
                    <div className={s.recentDateChip} aria-hidden="true">
                      <span className={s.recentDateMonth}>
                        {new Date(session.started_at).toLocaleDateString("en-GH", { month: "short" })}
                      </span>
                      <span className={s.recentDateDay}>
                        {new Date(session.started_at).getDate()}
                      </span>
                    </div>

                    {/* Course info */}
                    <div className={s.recentInfo}>
                      <span className={s.recentCourseName}>
                        {session.courseName}
                        <span className={s.recentCourseCode}>{session.courseCode}</span>
                      </span>
                      <span className={s.recentTime}>{fmtTime(session.started_at)}</span>
                    </div>

                    {/* Attendance rate */}
                    <div className={s.recentRate}>
                      <span
                        className={s.recentRateValue}
                        data-level={rateLevel(session.rate)}
                      >
                        {session.rate}
                      </span>
                      <span className={s.recentRateFraction}>
                        {session.checkedIn}/{session.total}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar column ── */}
        <div className={s.sideCol}>
          {/* Quick Actions */}
          <div className="card">
            <h2 className={s.quickActionsTitle}>Quick Actions</h2>
            <div className={s.quickActionsList}>
              <Link href="/rep/courses" className={`btn btn-primary ${s.quickActionsBtn}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" />
                  <path d="M10 6v4l3 3" />
                </svg>
                Open New Session
              </Link>
              <Link href="/rep/students/add" className={`btn btn-secondary ${s.quickActionsBtn}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="8" cy="7" r="4" />
                  <path d="M2 18c0-3.31 2.69-6 6-6M14 11v6M11 14h6" />
                </svg>
                Add Student
              </Link>
              <Link href="/rep/students" className={`btn btn-secondary ${s.quickActionsBtn}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="7" cy="6" r="3" />
                  <circle cx="13" cy="6" r="3" />
                  <path d="M1 18c0-3.31 2.69-6 6-6M13 12c3.31 0 6 2.69 6 6" />
                </svg>
                View Roster
              </Link>
              <Link href="/rep/timetable" className={`btn btn-secondary ${s.quickActionsBtn}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="16" height="15" rx="1.5" />
                  <path d="M2 8h16M7 1v4M13 1v4" />
                </svg>
                Timetable
              </Link>
            </div>
          </div>

          {/* Disputes callout — sidebar version (desktop + tablet) */}
          {d.pendingDisputes > 0 && (
            <Link href="/rep/disputes" className={s.disputesCallout}>
              <div className={s.disputesCalloutInner}>
                <div className={s.disputesCalloutIcon} aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 3L2 17h16L10 3z" />
                    <path d="M10 10v3M10 15h.01" />
                  </svg>
                </div>
                <div>
                  <div className={s.disputesCalloutTitle}>
                    {d.pendingDisputes} Pending Dispute{d.pendingDisputes !== 1 ? "s" : ""}
                  </div>
                  <div className={s.disputesCalloutSub}>
                    Tap to review and resolve
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Semester info */}
          <div className={`card ${s.semesterCard}`}>
            <span className={s.semesterLabel}>Active Semester</span>
            {d.semesterName ? (
              <div className={s.semesterName}>{d.semesterName}</div>
            ) : (
              <div className={s.semesterNone}>No active semester — contact admin</div>
            )}
          </div>
        </div>
      </div>
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
  const level = pct >= 75 ? "good" : pct >= 50 ? "medium" : "low";

  const metaParts = [
    session.courses?.code,
    session.venue,
    `Started ${fmtTime(session.started_at)}`,
  ].filter(Boolean);

  return (
    <div className={`card ${s.liveCard}`}>
      {/* Live pulse header */}
      <div className={s.liveHeader}>
        <span className={s.livePulse} aria-hidden="true" />
        <span className={s.liveBadge}>Session Live</span>
        <span className={s.liveElapsed}>{elapsed(session.started_at)} elapsed</span>
      </div>

      {/* Course info */}
      <div>
        <div className={s.liveCourseName}>
          {session.courses?.name ?? "Unknown Course"}
        </div>
        <div className={s.liveMeta}>{metaParts.join(" · ")}</div>
      </div>

      {/* Check-in progress */}
      <div>
        <div className={s.liveProgressLabel}>
          <span style={{ color: "var(--color-text-2)", fontWeight: 600 }}>Check-ins</span>
          <span className={s.liveProgressCount}>
            {checkins} / {total}
            <span className={s.liveProgressPct}>({pct}%)</span>
          </span>
        </div>
        <div className={s.liveProgressTrack}>
          <div
            className={s.liveProgressFill}
            data-level={level}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Link href={`/rep/sessions/${session.id}`} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", minHeight: 48 }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 10h16M10 4l6 6-6 6" />
        </svg>
        Manage Session
      </Link>
    </div>
  );
}

function NoSessionCard({ hasCourses }: { hasCourses: boolean }) {
  return (
    <div className={`card ${s.noSessionCard}`}>
      <div className={s.noSessionIcon} aria-hidden="true">
        {hasCourses ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        )}
      </div>
      <div className={s.noSessionTitle}>
        {hasCourses ? "No Active Session" : "Set Up Your Courses"}
      </div>
      <p className={s.noSessionBody}>
        {hasCourses
          ? "Students are waiting. Pick a course to start a session."
          : "Add your semester courses first. You can open attendance sessions from each course page."}
      </p>
      <Link href="/rep/courses" className="btn btn-primary">
        {hasCourses ? (
          <>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="9" />
              <path d="M10 6v8M6 10h8" />
            </svg>
            Start a Session
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 5v10M5 10h10" />
            </svg>
            Add Courses
          </>
        )}
      </Link>
    </div>
  );
}

/* ─── unused after refactor — kept for TypeScript to avoid dead code warnings ── */
void fmtDate;
