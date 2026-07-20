import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Past Courses" };
export const revalidate = 300;

type CourseRow = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  groups: { group_name: string } | null;
  app_semesters: { name: string } | null;
  _sessionCount: number;
  _attendanceRate: number | null;
};

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

  // Active semester(s) — exclude these from history
  const activeSemsResult = await supabase
    .from("app_semesters")
    .select("id")
    .eq("status", "active");
  const activeSemIds = (activeSemsResult.data ?? []).map((s: { id: string }) => s.id);

  // Past courses: assigned to this lecturer, not in an active semester
  type RawCourse = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    semester_id: string;
    groups: { group_name: string } | null;
    app_semesters: { name: string } | null;
  };

  let query = supabase
    .from("courses")
    .select("id, name, code, credit_hours, semester_id, groups(group_name), app_semesters(name)")
    .eq("lecturer_id", user.id)
    .order("created_at", { ascending: false });

  if (activeSemIds.length > 0) {
    query = query.not("semester_id", "in", `(${activeSemIds.join(",")})`);
  }

  const coursesResult = await query;
  const rawCourses = (coursesResult.data ?? []) as unknown as RawCourse[];

  if (rawCourses.length === 0) {
    return { courses: [] as CourseRow[] };
  }

  // Session counts per course
  const courseIds = rawCourses.map((c) => c.id);
  const sessionsResult = await supabase
    .from("class_sessions")
    .select("course_id, ended_at")
    .in("course_id", courseIds)
    .not("ended_at", "is", null);

  type SessionRow = { course_id: string; ended_at: string };
  const sessionRows = (sessionsResult.data ?? []) as unknown as SessionRow[];

  const sessionCountMap: Record<string, number> = {};
  for (const s of sessionRows) {
    sessionCountMap[s.course_id] = (sessionCountMap[s.course_id] ?? 0) + 1;
  }

  // Attendance rates
  const sessionIds = sessionRows.map((_, i) => i); // placeholder; we need real ids
  // Re-query with IDs
  const sessionIdsResult = await supabase
    .from("class_sessions")
    .select("id, course_id")
    .in("course_id", courseIds)
    .not("ended_at", "is", null);

  type SessionIdRow = { id: string; course_id: string };
  const sessionIdsRows = (sessionIdsResult.data ?? []) as unknown as SessionIdRow[];
  const allSessionIds = sessionIdsRows.map((r) => r.id);
  const sessionCourseMap: Record<string, string> = {};
  for (const r of sessionIdsRows) {
    sessionCourseMap[r.id] = r.course_id;
  }

  type AttRow = { session_id: string; status: string };
  let attMap: Record<string, { present: number; total: number }> = {};

  if (allSessionIds.length > 0) {
    const attResult = await supabase
      .from("attendance")
      .select("session_id, status")
      .in("session_id", allSessionIds);

    for (const a of (attResult.data ?? []) as unknown as AttRow[]) {
      const courseId = sessionCourseMap[a.session_id];
      if (!courseId) continue;
      if (!attMap[courseId]) attMap[courseId] = { present: 0, total: 0 };
      attMap[courseId].total++;
      if (a.status === "present" || a.status === "late") attMap[courseId].present++;
    }
  }

  void sessionIds; // suppress unused warning

  const courses: CourseRow[] = rawCourses.map((c) => {
    const att = attMap[c.id];
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      credit_hours: c.credit_hours,
      groups: c.groups,
      app_semesters: c.app_semesters,
      _sessionCount: sessionCountMap[c.id] ?? 0,
      _attendanceRate:
        att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
    };
  });

  return { courses };
}

function getAttColor(pct: number) {
  if (pct >= 75) return "var(--color-success)";
  if (pct >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

export default async function HistoryPage() {
  const { courses } = await getData();

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Past Courses</h1>
          <p className="page-subtitle">
            {courses.length > 0
              ? `${courses.length} course${courses.length === 1 ? "" : "s"} from previous semesters`
              : "Courses you have previously taught"}
          </p>
        </div>
      </div>

      {courses.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--color-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-3)",
              color: "var(--color-text-3)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
            No past courses yet
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Courses from previous semesters will appear here once a semester closes.
          </p>
        </div>
      )}

      {courses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/lecturer/history/${course.id}`}
              style={{ textDecoration: "none" }}
              className="history-card"
            >
              <div
                className="card"
                style={{
                  padding: "var(--space-4) var(--space-5)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  transition: "background var(--transition-fast)",
                }}
              >
                {/* Code block */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: "var(--space-1) var(--space-3)",
                    borderRadius: "var(--radius-base)",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 800,
                    color: "var(--color-text-2)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {course.code}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {course.name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                      marginTop: 2,
                    }}
                  >
                    {course.groups?.group_name ?? "—"}
                    {course.app_semesters?.name
                      ? ` · ${course.app_semesters.name}`
                      : ""}
                  </div>
                </div>

                {/* Stats */}
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
                        course._attendanceRate !== null
                          ? getAttColor(course._attendanceRate)
                          : "var(--color-text-3)",
                    }}
                  >
                    {course._attendanceRate !== null
                      ? `${course._attendanceRate}%`
                      : "—"}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    {course._sessionCount} session{course._sessionCount !== 1 ? "s" : ""}
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
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .history-card .card:hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  );
}
