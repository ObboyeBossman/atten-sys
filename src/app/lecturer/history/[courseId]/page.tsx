import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Archived Course" };
export const revalidate = 300;

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

function fmtDuration(startedAt: string, endedAt: string) {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function getAttColor(pct: number) {
  if (pct >= 75) return "var(--color-success)";
  if (pct >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

async function getData(courseId: string) {
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

  type RawCourse = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    lecturer_id: string | null;
    group_id: string;
    groups: { group_name: string } | null;
    app_semesters: { name: string } | null;
  };

  const courseResult = await supabase
    .from("courses")
    .select(
      "id, name, code, credit_hours, lecturer_id, group_id, groups(group_name), app_semesters(name)"
    )
    .eq("id", courseId)
    .maybeSingle();

  const course = courseResult.data as unknown as RawCourse | null;
  if (!course) notFound();
  if (course.lecturer_id !== user.id) redirect("/lecturer/history");

  // Enrolled count (historical snapshot — current active memberships)
  const enrolledResult = await supabase
    .from("group_memberships")
    .select("student_id", { count: "exact", head: true })
    .eq("group_id", course.group_id);
  const enrolled = enrolledResult.count ?? 0;

  // Completed sessions only (archived = no live)
  type RawSession = {
    id: string;
    started_at: string;
    ended_at: string;
    venue: string | null;
  };

  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue")
    .eq("course_id", courseId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  const sessions = (sessionsResult.data ?? []) as unknown as RawSession[];

  // Attendance per session
  type AttRow = { session_id: string; status: string };
  const sessionIds = sessions.map((s) => s.id);

  let attMap: Record<string, { present: number; late: number; absent: number }> = {};
  if (sessionIds.length > 0) {
    const attResult = await supabase
      .from("attendance")
      .select("session_id, status")
      .in("session_id", sessionIds);

    for (const a of (attResult.data ?? []) as unknown as AttRow[]) {
      if (!attMap[a.session_id])
        attMap[a.session_id] = { present: 0, late: 0, absent: 0 };
      if (a.status === "present") attMap[a.session_id].present++;
      else if (a.status === "late") attMap[a.session_id].late++;
      else if (a.status === "absent") attMap[a.session_id].absent++;
    }
  }

  const allAtt = Object.values(attMap);
  const totalChecked = allAtt.reduce((s, a) => s + a.present + a.late + a.absent, 0);
  const totalPresent = allAtt.reduce((s, a) => s + a.present + a.late, 0);
  const overallRate =
    totalChecked > 0 ? Math.round((totalPresent / totalChecked) * 100) : null;

  return { course, enrolled, sessions, attMap, overallRate };
}

export default async function ArchivedCourseDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { course, enrolled, sessions, attMap, overallRate } = await getData(
    params.courseId
  );

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href="/lecturer/history"
          className="back-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            textDecoration: "none",
            transition: "color var(--transition-fast)",
          }}
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
          Past Courses
        </Link>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-1)",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: "var(--color-text-3)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {course.code}
            </span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "1px 8px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-3)",
                fontWeight: 600,
              }}
            >
              Archived
            </span>
          </div>
          <h1 className="page-title">{course.name}</h1>
          <p className="page-subtitle">
            {course.groups?.group_name ?? "Unknown Group"} ·{" "}
            {course.credit_hours} credit hours
            {course.app_semesters?.name ? ` · ${course.app_semesters.name}` : ""}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Sessions" value={sessions.length} sub="completed" />
        <StatCard label="Enrolled" value={enrolled} sub="students" />
        <StatCard
          label="Attendance Rate"
          value={overallRate !== null ? `${overallRate}%` : "—"}
          sub="overall"
          color={overallRate !== null ? getAttColor(overallRate) : undefined}
        />
      </div>

      {/* Sessions */}
      <h2
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "var(--space-3)",
        }}
      >
        Session History
      </h2>

      {sessions.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}
        >
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-3)",
            }}
          >
            No sessions were recorded for this course.
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {sessions.map((s, i) => {
            const att = attMap[s.id] ?? { present: 0, late: 0, absent: 0 };
            const attended = att.present + att.late;
            const total = att.present + att.late + att.absent;
            const rate = total > 0 ? Math.round((attended / total) * 100) : null;

            return (
              <Link
                key={s.id}
                href={`/lecturer/sessions/${s.id}/attendance`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-4) var(--space-5)",
                  borderBottom:
                    i < sessions.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  textDecoration: "none",
                  transition: "background var(--transition-fast)",
                }}
                className="session-row"
              >
                {/* Date block */}
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
                    {new Date(s.started_at).getDate()}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--color-text-3)",
                      textTransform: "uppercase",
                    }}
                  >
                    {new Date(s.started_at).toLocaleDateString("en-GH", {
                      month: "short",
                    })}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text)",
                    }}
                  >
                    {fmtDate(s.started_at)}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                      marginTop: 2,
                    }}
                  >
                    {fmtTime(s.started_at)} ·{" "}
                    {fmtDuration(s.started_at, s.ended_at)}
                    {s.venue ? ` · ${s.venue}` : ""}
                  </div>
                </div>

                {/* Attendance */}
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
                        rate !== null
                          ? getAttColor(rate)
                          : "var(--color-text-3)",
                    }}
                  >
                    {rate !== null ? `${rate}%` : "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                    }}
                  >
                    {attended}/{total}
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
            );
          })}
        </div>
      )}

      <style>{`
        .back-link:hover { color: var(--color-text-2) !important; }
        .session-row:hover { background: var(--color-surface-2) !important; }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="card"
      style={{ padding: "var(--space-4) var(--space-5)", textAlign: "center" }}
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
      {sub && (
        <div style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
