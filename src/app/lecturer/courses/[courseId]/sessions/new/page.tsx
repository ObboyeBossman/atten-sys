import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewSessionClient from "./NewSessionClient";

export const metadata: Metadata = { title: "Open Session" };

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
    lecturer_id: string | null;
    group_id: string;
  };

  const courseResult = await supabase
    .from("courses")
    .select("id, name, code, lecturer_id, group_id")
    .eq("id", courseId)
    .maybeSingle();

  const course = courseResult.data as unknown as RawCourse | null;
  if (!course) notFound();
  if (course.lecturer_id !== user.id) redirect("/lecturer/courses");

  // Block if live session already open
  const liveCheck = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", courseId)
    .is("ended_at", null)
    .maybeSingle();

  if (liveCheck.data) {
    redirect(`/lecturer/sessions/${liveCheck.data.id}`);
  }

  // Active semester
  const semResult = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();

  const semester = semResult.data as { id: string; name: string } | null;

  // Timetable slots for this course
  type RawTimetable = {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    venue: string | null;
  };

  const timetableResult = await supabase
    .from("timetables")
    .select("id, day_of_week, start_time, end_time, venue")
    .eq("course_id", courseId)
    .order("day_of_week");

  const timetables = (timetableResult.data ?? []) as unknown as RawTimetable[];

  return { course, semester, timetables };
}

export default async function NewSessionPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { course, semester, timetables } = await getData(params.courseId);

  if (!semester) {
    return (
      <div>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Link
            href={`/lecturer/courses/${course.id}`}
            className="back-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-3)",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 15l-5-5 5-5" />
            </svg>
            {course.name}
          </Link>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
          <div style={{ fontSize: 32, marginBottom: "var(--space-3)" }}>🗓️</div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            No Active Semester
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            Sessions can only be opened during an active semester. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href={`/lecturer/courses/${course.id}`}
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
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 15l-5-5 5-5" />
          </svg>
          {course.name}
        </Link>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Open Session</h1>
          <p className="page-subtitle">
            {semester.name} · Session will go live immediately
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="card" style={{ padding: "var(--space-6)" }}>
        <NewSessionClient
          courseId={course.id}
          courseName={course.name}
          courseCode={course.code}
          semesterId={semester.id}
          timetables={timetables}
        />
      </div>

      <style>{`
        .back-link:hover { color: var(--color-text-2) !important; }
      `}</style>
    </div>
  );
}
