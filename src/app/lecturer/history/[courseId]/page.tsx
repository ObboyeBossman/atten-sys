import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Archived Course" };
export const revalidate = 600;

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(startedAt: string, endedAt: string) {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function attendanceRate(present: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((present / total) * 100)}%`;
}
function getAttColor(rate: string) {
  if (rate === "—") return "var(--color-text-3)";
  const n = parseInt(rate);
  if (n >= 75) return "var(--color-success)";
  if (n >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

/* ── data ───────────────────────────────────────────────── */
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
    app_semesters: { name: string; status: string } | null;
  };

  const courseResult = await supabase
    .from("courses")
    .select("id, name, code, credit_hours, lecturer_id, group_id, groups(group_name), app_semesters(name, status)")
    .eq("id", courseId)
    .maybeSingle();

  const course = courseResult.data as unknown as RawCourse | null;
  if (!course) notFound();
  if (course.lecturer_id !== user.id) redirect("/lecturer/history");

  // Students enrolled
  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id", { count: "exact", head: true })
    .eq("group_id", course.group_id)
    .eq("status", "active");
  const totalEnrolled = membersResult.count ?? 0;

  // Sessions
  type RawSession = {
    id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
  };

  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue")
    .eq("course_id", courseId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  const rawSessions = (sessionsResult.data ?? []) as RawSession[];
  const sessionIds = rawSessions.map((s) => s.id);

  // Attendance per session
  type AttRow = { session_id: string; status: string };
  const attRes =
    sessionIds.length > 0
      ? await supabase
          .from("attendance")
          .select("session_id, status")
          .in("session_id", sessionIds)
      : { data: [] };

  const attRows = (attRes.data ?? []) as AttRow[];
  const attMap: Record<string, { present: number; total: number }> = {};
  attRows.forEach((a) => {
    if (!attMap[a.session_id]) attMap[a.session_id] = { present: 0, total: 0 };
    attMap[a.session_id].total++;
    if (a.status === "present" || a.status === "late") attMap[a.session_id].present++;
  });

  // Overall rate
  const totalPresent = Object.values(attMap).reduce((s, v) => s + v.present, 0);
  const totalRecords = Object.values(attMap).reduce((s, v) => s + v.total, 0);

  const sessions = rawSessions.map((s) => {
    const att = attMap[s.id] ?? { present: 0, total: 0 };
    return {
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at!,
      venue: s.venue,
      rate: attendanceRate(att.present, att.total),
      presentCount: att.present,
    };
  });

  return {
    course: {
      name: course.name,
      code: course.code,
      creditHours: course.credit_hours,
      groupName: course.groups?.group_name ?? "Unknown Group",
      semesterName: course.app_semesters?.name ?? "—",
      semesterStatus: course.app_semesters?.status ?? "—",
    },
    totalEnrolled,
    totalSessions: sessions.length,
    overallRate: attendanceRate(totalPresent, totalRecords),
    sessions,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function HistoryCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const d = await getData(courseId);

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href="/lecturer/history"
          style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
            fontSize: "var(--text-sm)", color: "var(--color-text-3)",
            textDecoration: "none", fontWeight: 500,
          }}
          className="back-link"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 5l-5 5 5 5" />
          </svg>
          Past Courses
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-1)" }}>
            <h1 className="page-title" style={{ margin: 0 }}>{d.course.code} — {d.course.name}</h1>
            <span
              style={{
                fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-3)",
                textTransform: "capitalize",
              }}
            >
              Archived
            </span>
          </div>
          <p className="page-subtitle">
            {d.course.semesterName} · {d.course.groupName} · {d.course.creditHours} credit hours
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
        }}
      >
        {[
          { label: "Sessions", value: String(d.totalSessions), accent: "var(--color-secondary)" },
          { label: "Students", value: String(d.totalEnrolled), accent: "var(--color-info)" },
          { label: "Overall Rate", value: d.overallRate, accent: getAttColor(d.overallRate) },
        ].map((s) => (
          <div
            key={s.label}
            className="card"
            style={{
              padding: "var(--space-4) var(--space-5)",
              borderTop: `3px solid ${s.accent}`,
            }}
          >
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-1)" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: s.accent }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sessions list */}
      <h2
        style={{
          fontSize: "var(--text-xs)", fontWeight: 700,
          color: "var(--color-text-3)", textTransform: "uppercase",
          letterSpacing: "0.07em", marginBottom: "var(--space-3)",
        }}
      >
        All Sessions
      </h2>

      {d.sessions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-10) var(--space-6)", color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
          No sessions were held for this course.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {d.sessions.map((s, i) => (
            <Link
              key={s.id}
              href={`/lecturer/sessions/${s.id}`}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-4)",
                padding: "var(--space-4) var(--space-5)",
                borderBottom: i < d.sessions.length - 1 ? "1px solid var(--color-border)" : "none",
                textDecoration: "none",
                transition: "background var(--transition-fast)",
              }}
              className="session-row"
            >
              {/* Date block */}
              <div
                style={{
                  flexShrink: 0, width: 44, height: 44,
                  borderRadius: "var(--radius-base)",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text-3)" }}>
                  {new Date(s.startedAt).getDate()}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase" }}>
                  {new Date(s.startedAt).toLocaleDateString("en-GH", { month: "short" })}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                  {fmtDate(s.startedAt)}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                  {fmtTime(s.startedAt)} · {fmtDuration(s.startedAt, s.endedAt)}
                  {s.venue ? ` · ${s.venue}` : ""}
                </div>
              </div>

              {/* Rate */}
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: getAttColor(s.rate) }}>
                  {s.rate}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                  {s.presentCount} present
                </div>
              </div>

              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }} aria-hidden="true">
                <path d="M7 5l5 5-5 5" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .session-row:hover { background: var(--color-surface-2); }
        .back-link:hover { color: var(--color-text); }
      `}</style>
    </div>
  );
}
