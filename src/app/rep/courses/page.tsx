//

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Courses" };
export const revalidate = 60;

/* ── types ──────────────────────────────────────────────── */
type CourseRow = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  lecturer_id: string | null;
  lecturers: { name: string } | null;
  _sessionCount: number;
};

/* ── data ───────────────────────────────────────────────── */
async function getData() {
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

  // Active semester
  const semResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const sem = semResult.data as { id: string; name: string } | null;

  // Group name
  const groupResult = await supabase
    .from("groups")
    .select("group_name")
    .eq("id", groupId)
    .maybeSingle();
  const groupName = (groupResult.data as { group_name: string } | null)?.group_name ?? "Your Group";

  if (!sem) {
    return { courses: [], groupName, semesterName: null };
  }

  // Courses for this group + semester, with lecturer
  type RawCourse = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    lecturer_id: string | null;
    lecturers: { name: string } | null;
  };
  const coursesResult = await supabase
    .from("courses")
    .select("id, name, code, credit_hours, lecturer_id, lecturers(name)")
    .eq("group_id", groupId)
    .eq("semester_id", sem.id)
    .order("code");

  const rawCourses = (coursesResult.data ?? []) as unknown as RawCourse[];

  // Session counts per course
  const courseIds = rawCourses.map((c) => c.id);
  type SessionRow = { course_id: string };
  const sessionsResult = courseIds.length
    ? await supabase
        .from("class_sessions")
        .select("course_id")
        .in("course_id", courseIds)
    : { data: [] };

  const sessionCounts: Record<string, number> = {};
  ((sessionsResult.data ?? []) as SessionRow[]).forEach((s) => {
    sessionCounts[s.course_id] = (sessionCounts[s.course_id] ?? 0) + 1;
  });

  const courses: CourseRow[] = rawCourses.map((c) => ({
    ...c,
    lecturers: c.lecturers ?? null,
    _sessionCount: sessionCounts[c.id] ?? 0,
  }));

  return { courses, groupName, semesterName: sem.name };
}

/* ── page ───────────────────────────────────────────────── */
export default async function RepCoursesPage() {
  const { courses, groupName, semesterName } = await getData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">
            {groupName}{semesterName ? ` · ${semesterName}` : ""}
          </p>
        </div>
      </div>

      {!semesterName && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          <span>No active semester. Contact admin to activate a semester before starting sessions.</span>
        </div>
      )}

      {courses.length === 0 && semesterName && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--color-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-4)", color: "var(--color-text-3)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            No courses yet
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Courses are assigned by the admin for the current semester.
          </p>
        </div>
      )}

      {courses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/rep/courses/${course.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card course-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-4) var(--space-5)",
                  cursor: "pointer",
                  transition: "all var(--transition-base)",
                }}
              >
                {/* Code badge */}
                <div style={{
                  flexShrink: 0,
                  width: 52, height: 52,
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  textAlign: "center",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  padding: "var(--space-1)",
                }}>
                  {course.code.length > 6 ? course.code.slice(0, 6) : course.code}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    color: "var(--color-text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {course.name}
                  </div>
                  <div style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-3)",
                    marginTop: "var(--space-1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {course.lecturers?.name ?? "No lecturer assigned"}
                    {" · "}
                    {course.credit_hours} cr
                  </div>
                </div>

                {/* Stats */}
                <div style={{
                  flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "flex-end",
                  gap: "var(--space-1)",
                }}>
                  <div style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--color-text-2)",
                  }}>
                    {course._sessionCount}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    session{course._sessionCount !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Chevron */}
                <div style={{ flexShrink: 0, color: "var(--color-text-3)" }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 5l5 5-5 5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .course-card:hover {
          border-color: var(--color-border-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
