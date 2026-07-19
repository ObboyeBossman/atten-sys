import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CourseDetailClient } from "./CourseDetailClient";

export const metadata: Metadata = { title: "Course Detail" };
export const revalidate = 0;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(t: string) {
  // t is "HH:MM:SS" — show as "10:00 AM"
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "—";
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── types ──────────────────────────────────────────────── */
type TimetableRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
};

type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  venue: string | null;
  _checkins: number;
};

/* ── data ───────────────────────────────────────────────── */
async function getData(courseId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
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
  const groupId = membershipData.group_id;

  // Fetch course — must belong to rep's group
  type CourseWithLecturer = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    group_id: string;
    lecturer_id: string | null;
    lecturers: { name: string } | null;
  };
  const courseResult = await supabase
    .from("courses")
    .select("id, name, code, credit_hours, group_id, lecturer_id, lecturers(name)")
    .eq("id", courseId)
    .eq("group_id", groupId)
    .maybeSingle();

  const course = courseResult.data as unknown as CourseWithLecturer | null;
  if (!course) redirect("/rep/courses");

  // Timetable entries
  const ttResult = await supabase
    .from("timetables")
    .select("id, day_of_week, start_time, end_time, venue")
    .eq("course_id", courseId)
    .order("day_of_week")
    .order("start_time");

  const timetable = (ttResult.data ?? []) as TimetableRow[];

  // Sessions for this course (with attendance counts)
  type RawSession = {
    id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
    attendance: { id: string }[];
  };
  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue, attendance(id)")
    .eq("course_id", courseId)
    .order("started_at", { ascending: false })
    .limit(20);

  const sessions: SessionRow[] = ((sessionsResult.data ?? []) as unknown as RawSession[]).map((s) => ({
    id: s.id,
    started_at: s.started_at,
    ended_at: s.ended_at,
    venue: s.venue,
    _checkins: (s.attendance ?? []).filter((_a) => true).length,
  }));

  // Check if there's a live session for this course
  const liveResult = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", courseId)
    .is("ended_at", null)
    .maybeSingle();
  const liveSessionId = (liveResult.data as { id: string } | null)?.id ?? null;

  // Total students in group
  const { count: totalStudents } = await supabase
    .from("group_memberships")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active");

  return {
    course,
    timetable,
    sessions,
    liveSessionId,
    totalStudents: totalStudents ?? 0,
    groupId,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course, timetable, sessions, liveSessionId, totalStudents, groupId } = await getData(courseId);

  const hasLiveSession = !!liveSessionId;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <Link
              href="/rep/courses"
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--color-text-3)", textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 5l-5 5 5 5" />
              </svg>
              Courses
            </Link>
          </div>
          <h1 className="page-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {course.name}
          </h1>
          <p className="page-subtitle">
            {course.code} · {course.credit_hours} credit hour{course.credit_hours !== 1 ? "s" : ""}
            {course.lecturers?.name ? ` · ${course.lecturers.name}` : ""}
          </p>
        </div>

        {hasLiveSession ? (
          <Link href={`/rep/sessions/${liveSessionId}`} className="btn btn-primary" style={{ flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse 2s infinite" }} />
            Manage Live Session
          </Link>
        ) : (
          <Link href={`/rep/courses/${courseId}/sessions/new`} className="btn btn-primary" style={{ flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="9" /><path d="M10 6v8M6 10h8" />
            </svg>
            Start Session
          </Link>
        )}
      </div>

      {/* Live session banner */}
      {hasLiveSession && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-5)",
          borderRadius: "var(--radius-xl)",
          background: "var(--color-success-bg)",
          border: "1px solid rgba(34,197,94,0.3)",
          marginBottom: "var(--space-6)",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--color-success)",
            boxShadow: "0 0 0 3px rgba(34,197,94,.25)",
            animation: "pulse 2s infinite", flexShrink: 0,
          }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-success)", flex: 1 }}>
            A session is currently live for this course
          </span>
          <Link href={`/rep/sessions/${liveSessionId}`} style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-success)", textDecoration: "underline" }}>
            Manage →
          </Link>
        </div>
      )}

      {/* Timetable */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>Timetable</h2>
        </div>

        {timetable.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            No timetable slots added yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {timetable.map((tt) => (
              <div
                key={tt.id}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-4)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-surface-2)",
                }}
              >
                <div style={{
                  flexShrink: 0, width: 88,
                  fontSize: "var(--text-xs)", fontWeight: 700,
                  color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {DAYS[tt.day_of_week]}
                </div>
                <div style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--color-text)", fontWeight: 600 }}>
                  {fmtTime(tt.start_time)} – {fmtTime(tt.end_time)}
                </div>
                {tt.venue && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    {tt.venue}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add timetable entry (client component) */}
        <CourseDetailClient courseId={courseId} groupId={groupId} />
      </div>

      {/* Sessions */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>
            Sessions
            <span style={{
              marginLeft: "var(--space-2)",
              fontSize: "var(--text-xs)", fontWeight: 600,
              color: "var(--color-text-3)", background: "var(--color-surface-2)",
              padding: "2px 8px", borderRadius: "var(--radius-full)",
            }}>
              {sessions.length}
            </span>
          </h2>
          {!hasLiveSession && (
            <Link href={`/rep/courses/${courseId}/sessions/new`} className="btn btn-secondary btn-sm">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="9" /><path d="M10 6v8M6 10h8" />
              </svg>
              New Session
            </Link>
          )}
        </div>

        {sessions.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            No sessions have been held yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {sessions.map((session, i) => {
              const isLive = !session.ended_at;
              const rate = totalStudents > 0
                ? `${Math.round((session._checkins / totalStudents) * 100)}%`
                : "—";
              return (
                <Link
                  key={session.id}
                  href={isLive ? `/rep/sessions/${session.id}` : `/rep/sessions/${session.id}/attendance`}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-4)",
                    padding: "var(--space-3) var(--space-1)",
                    borderBottom: i < sessions.length - 1 ? "1px solid var(--color-border)" : "none",
                    textDecoration: "none",
                    transition: "background var(--transition-fast)",
                    borderRadius: i === sessions.length - 1 ? "0 0 var(--radius-lg) var(--radius-lg)" : undefined,
                  }}
                  className="session-row"
                >
                  {/* Status dot */}
                  {isLive ? (
                    <span style={{
                      flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
                      background: "var(--color-success)",
                      boxShadow: "0 0 0 3px rgba(34,197,94,.25)",
                      animation: "pulse 2s infinite",
                    }} />
                  ) : (
                    <span style={{
                      flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
                      background: "var(--color-surface-3)",
                    }} />
                  )}

                  {/* Date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      {fmtDate(session.started_at)}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 1 }}>
                      {isLive ? (
                        <span style={{ color: "var(--color-success)", fontWeight: 600 }}>Live now</span>
                      ) : (
                        `${fmtDuration(session.started_at, session.ended_at)} · ${session.venue ?? "No venue"}`
                      )}
                    </div>
                  </div>

                  {/* Attendance */}
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
                      {session._checkins}/{totalStudents}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                      {rate}
                    </div>
                  </div>

                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }} aria-hidden="true">
                    <path d="M7 5l5 5-5 5" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .session-row:hover { background: var(--color-surface-2); }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
          50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  );
}
