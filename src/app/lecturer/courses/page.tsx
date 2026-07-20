import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Courses" };
export const revalidate = 60;

/* ── types ──────────────────────────────────────────────── */
type CourseRow = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  group_id: string;
  groups: { group_name: string } | null;
  _sessionCount: number;
  _attendanceRate: string;
};

/* ── data ───────────────────────────────────────────────── */
async function getData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lecturerResult = await supabase
    .from("lecturers")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  const semResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const sem = semResult.data as { id: string; name: string } | null;

  if (!sem) {
    return { courses: [], semesterName: null };
  }

  type RawCourse = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    group_id: string;
    groups: { group_name: string } | null;
  };

  const coursesResult = await supabase
    .from("courses")
    .select("id, name, code, credit_hours, group_id, groups(group_name)")
    .eq("lecturer_id", user.id)
    .eq("semester_id", sem.id)
    .order("code");

  const rawCourses = (coursesResult.data ?? []) as unknown as RawCourse[];

  // Session counts + attendance rates per course
  const enriched = await Promise.all(
    rawCourses.map(async (course) => {
      const [sessionsRes, attRes] = await Promise.all([
        supabase
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
          .eq("course_id", course.id)
          .not("ended_at", "is", null),
        supabase
          .from("attendance")
          .select("status, class_sessions!inner(course_id)")
          .eq("class_sessions.course_id", course.id),
      ]);

      const sessionCount = sessionsRes.count ?? 0;
      const attData = (attRes.data ?? []) as { status: string }[];
      let rate = "—";
      if (attData.length > 0) {
        const present = attData.filter(
          (a) => a.status === "present" || a.status === "late"
        ).length;
        rate = `${Math.round((present / attData.length) * 100)}%`;
      }

      return {
        ...course,
        _sessionCount: sessionCount,
        _attendanceRate: rate,
      } as CourseRow;
    })
  );

  return { courses: enriched, semesterName: sem.name };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerCoursesPage() {
  const { courses, semesterName } = await getData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">
            {semesterName
              ? `Courses assigned to you · ${semesterName}`
              : "Courses assigned to you"}
          </p>
        </div>
      </div>

      {!semesterName && (
        <div
          className="alert alert-warning"
          style={{ marginBottom: "var(--space-6)" }}
        >
          <svg
            width="18"
            height="18"
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
          <span>
            No active semester. Contact admin to activate a semester.
          </span>
        </div>
      )}

      {courses.length === 0 && semesterName && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}
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
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
            No courses assigned
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Contact your admin to get courses assigned to you for{" "}
            {semesterName}.
          </p>
        </div>
      )}

      {courses.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/lecturer/courses/${course.id}`}
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
                <div
                  style={{
                    flexShrink: 0,
                    width: 52,
                    height: 52,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--color-primary)",
                    textAlign: "center",
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                    padding: "var(--space-1)",
                  }}
                >
                  {course.code.length > 6
                    ? course.code.slice(0, 6)
                    : course.code}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {course.name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-3)",
                      marginTop: "var(--space-1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {course.groups?.group_name ?? "Unknown group"}
                    {" · "}
                    {course.credit_hours} cr
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "var(--space-1)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 700,
                      color:
                        course._attendanceRate === "—"
                          ? "var(--color-text-3)"
                          : parseInt(course._attendanceRate) >= 75
                          ? "var(--color-success)"
                          : parseInt(course._attendanceRate) >= 50
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                    }}
                  >
                    {course._attendanceRate}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                    }}
                  >
                    {course._sessionCount} session
                    {course._sessionCount !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Chevron */}
                <div style={{ flexShrink: 0, color: "var(--color-text-3)" }}>
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
