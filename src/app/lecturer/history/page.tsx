import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Past Courses" };
export const revalidate = 300;

/* ── types ──────────────────────────────────────────────── */
type SemesterGroup = {
  semesterId: string;
  semesterName: string;
  semesterStatus: string;
  courses: {
    id: string;
    name: string;
    code: string;
    creditHours: number;
    groupName: string;
    sessionCount: number;
    attendanceRate: string;
  }[];
};

/* ── helpers ─────────────────────────────────────────────── */
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

  // Active semester (so we exclude it from history)
  const activeSemResult = await supabase
    .from("app_semesters")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  const activeSemId = (activeSemResult.data as { id: string } | null)?.id ?? null;

  // All courses for this lecturer
  type RawCourse = {
    id: string;
    name: string;
    code: string;
    credit_hours: number;
    semester_id: string;
    group_id: string;
    groups: { group_name: string } | null;
    app_semesters: { id: string; name: string; status: string } | null;
  };

  const coursesResult = await supabase
    .from("courses")
    .select("id, name, code, credit_hours, semester_id, group_id, groups(group_name), app_semesters(id, name, status)")
    .eq("lecturer_id", user.id)
    .order("code");

  const allCourses = (coursesResult.data ?? []) as unknown as RawCourse[];

  // Filter out active semester courses
  const pastCourses = allCourses.filter(
    (c) => c.semester_id !== activeSemId
  );

  if (pastCourses.length === 0) return { semesters: [] };

  const courseIds = pastCourses.map((c) => c.id);

  // Session counts per course
  const sessionsRes = await supabase
    .from("class_sessions")
    .select("id, course_id")
    .in("course_id", courseIds)
    .not("ended_at", "is", null);

  type SessRow = { id: string; course_id: string };
  const sessRows = (sessionsRes.data ?? []) as SessRow[];
  const sessionIds = sessRows.map((s) => s.id);
  const sessionCountMap: Record<string, number> = {};
  sessRows.forEach((s) => {
    sessionCountMap[s.course_id] = (sessionCountMap[s.course_id] ?? 0) + 1;
  });

  // Attendance per course
  type AttRow = { session_id: string; status: string };
  const attRes =
    sessionIds.length > 0
      ? await supabase
          .from("attendance")
          .select("session_id, status")
          .in("session_id", sessionIds)
      : { data: [] };

  const attRows = (attRes.data ?? []) as AttRow[];

  // Map session → course
  const sessionCourseMap: Record<string, string> = {};
  sessRows.forEach((s) => { sessionCourseMap[s.id] = s.course_id; });

  // Attendance counts per course
  const attMap: Record<string, { present: number; total: number }> = {};
  attRows.forEach((a) => {
    const cid = sessionCourseMap[a.session_id];
    if (!cid) return;
    if (!attMap[cid]) attMap[cid] = { present: 0, total: 0 };
    attMap[cid].total++;
    if (a.status === "present" || a.status === "late") attMap[cid].present++;
  });

  // Group by semester
  const semMap: Record<string, SemesterGroup> = {};
  pastCourses.forEach((c) => {
    const sem = c.app_semesters;
    if (!sem) return;
    if (!semMap[sem.id]) {
      semMap[sem.id] = {
        semesterId: sem.id,
        semesterName: sem.name,
        semesterStatus: sem.status,
        courses: [],
      };
    }
    const att = attMap[c.id] ?? { present: 0, total: 0 };
    semMap[sem.id].courses.push({
      id: c.id,
      name: c.name,
      code: c.code,
      creditHours: c.credit_hours,
      groupName: c.groups?.group_name ?? "Unknown Group",
      sessionCount: sessionCountMap[c.id] ?? 0,
      attendanceRate: attendanceRate(att.present, att.total),
    });
  });

  return { semesters: Object.values(semMap) };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerHistoryPage() {
  const { semesters } = await getData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Past Courses</h1>
          <p className="page-subtitle">
            Courses you have previously taught — archived by semester
          </p>
        </div>
      </div>

      {semesters.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-16) var(--space-6)" }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--color-surface-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto var(--space-4)", color: "var(--color-text-3)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div
            style={{
              fontWeight: 700, fontSize: "var(--text-base)",
              color: "var(--color-text)", marginBottom: "var(--space-1)",
            }}
          >
            No past courses yet
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Completed semesters will appear here once they close.
          </p>
        </div>
      )}

      {semesters.map((sem) => (
        <div key={sem.semesterId} style={{ marginBottom: "var(--space-8)" }}>
          {/* Semester heading */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-xs)", fontWeight: 700,
                color: "var(--color-text-3)", textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {sem.semesterName}
            </h2>
            <span
              style={{
                fontSize: "var(--text-xs)", fontWeight: 600,
                padding: "2px 8px", borderRadius: "var(--radius-full)",
                background:
                  sem.semesterStatus === "completed"
                    ? "rgba(34,197,94,0.1)"
                    : "var(--color-surface-2)",
                color:
                  sem.semesterStatus === "completed"
                    ? "var(--color-success)"
                    : "var(--color-text-3)",
                border:
                  sem.semesterStatus === "completed"
                    ? "1px solid rgba(34,197,94,0.25)"
                    : "1px solid var(--color-border)",
              }}
            >
              {sem.semesterStatus === "completed" ? "Completed" : sem.semesterStatus}
            </span>
            <div
              style={{
                flex: 1, height: 1,
                background: "var(--color-border)",
              }}
            />
          </div>

          {/* Courses list */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {sem.courses.map((course, i) => (
              <Link
                key={course.id}
                href={`/lecturer/history/${course.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-4)",
                  padding: "var(--space-4) var(--space-5)",
                  borderBottom:
                    i < sem.courses.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  textDecoration: "none",
                  transition: "background var(--transition-fast)",
                }}
                className="history-row"
              >
                {/* Code badge */}
                <div
                  style={{
                    flexShrink: 0, width: 48, height: 48,
                    borderRadius: "var(--radius-base)",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                    fontWeight: 700, color: "var(--color-text-3)",
                    textAlign: "center", lineHeight: 1.2, padding: "var(--space-1)",
                  }}
                >
                  {course.code.length > 6 ? course.code.slice(0, 6) : course.code}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700, fontSize: "var(--text-sm)",
                      color: "var(--color-text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {course.name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)", color: "var(--color-text-3)",
                      marginTop: "var(--space-1)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {course.groupName} · {course.creditHours} cr · {course.sessionCount} session{course.sessionCount !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Rate */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)", fontWeight: 700,
                      color: getAttColor(course.attendanceRate),
                    }}
                  >
                    {course.attendanceRate}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    attendance
                  </div>
                </div>

                {/* Chevron */}
                <svg
                  width="14" height="14" viewBox="0 0 20 20" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  style={{ flexShrink: 0, color: "var(--color-text-3)" }}
                  aria-hidden="true"
                >
                  <path d="M7 5l5 5-5 5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <style>{`
        .history-row:hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  );
}
