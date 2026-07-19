import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewSessionClient } from "./NewSessionClient";

export const metadata: Metadata = { title: "Start Session" };
export const revalidate = 0;

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

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

  // Course
  type CourseRow = { id: string; name: string; code: string; group_id: string };
  const courseResult = await supabase
    .from("courses")
    .select("id, name, code, group_id")
    .eq("id", courseId)
    .eq("group_id", groupId)
    .maybeSingle();
  const course = courseResult.data as CourseRow | null;
  if (!course) redirect("/rep/courses");

  // Active semester
  const semResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const semester = semResult.data as { id: string; name: string } | null;

  // System default duration
  const settingResult = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "default_session_duration_minutes")
    .maybeSingle();
  const defaultDuration = Number((settingResult.data as { value: string } | null)?.value ?? "60");

  // Timetable entries (for this course)
  type TimetableRow = { id: string; day_of_week: number; start_time: string; end_time: string; venue: string | null };
  const ttResult = await supabase
    .from("timetables")
    .select("id, day_of_week, start_time, end_time, venue")
    .eq("course_id", courseId)
    .order("day_of_week");
  const timetable = (ttResult.data ?? []) as TimetableRow[];

  // Today's day of week → pre-fill venue from matching timetable slot
  const todayDow = new Date().getDay();
  const todaySlot = timetable.find((t) => t.day_of_week === todayDow) ?? null;

  // Existing live session?
  const liveResult = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", courseId)
    .is("ended_at", null)
    .maybeSingle();
  const liveSessionId = (liveResult.data as { id: string } | null)?.id ?? null;

  return {
    course,
    semester,
    defaultDuration,
    timetable: timetable.map((t) => ({
      ...t,
      label: `${DAYS[t.day_of_week]} ${t.start_time.slice(0,5)}–${t.end_time.slice(0,5)}${t.venue ? ` · ${t.venue}` : ""}`,
    })),
    suggestedVenue: todaySlot?.venue ?? null,
    suggestedTimetableId: todaySlot?.id ?? null,
    liveSessionId,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course, semester, defaultDuration, timetable, suggestedVenue, suggestedTimetableId, liveSessionId } = await getData(courseId);

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <Link
              href={`/rep/courses/${courseId}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--color-text-3)", textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 5l-5 5 5 5" />
              </svg>
              {course.name}
            </Link>
          </div>
          <h1 className="page-title">Start Session</h1>
          <p className="page-subtitle">{course.code}</p>
        </div>
      </div>

      {/* Already live */}
      {liveSessionId && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          <span>
            A session is already live for this course.{" "}
            <Link href={`/rep/sessions/${liveSessionId}`} style={{ fontWeight: 700 }}>
              Manage it →
            </Link>
          </span>
        </div>
      )}

      {/* No semester */}
      {!semester && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
          </svg>
          No active semester. Contact the admin to open a semester before starting sessions.
        </div>
      )}

      {semester && !liveSessionId && (
        <NewSessionClient
          courseId={courseId}
          semesterId={semester.id}
          semesterName={semester.name}
          defaultDuration={defaultDuration}
          timetableOptions={timetable}
          suggestedVenue={suggestedVenue}
          suggestedTimetableId={suggestedTimetableId}
        />
      )}
    </div>
  );
}
