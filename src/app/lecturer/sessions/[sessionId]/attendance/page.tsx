import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AttendanceClient } from "./AttendanceClient";
import type { AttendanceRow } from "./AttendanceClient";

export const metadata: Metadata = { title: "Session Attendance" };
export const revalidate = 0;

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "Ongoing";
  const mins = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
  );
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── data ───────────────────────────────────────────────── */
async function getData(sessionId: string) {
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

  type RawSession = {
    id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
    course_id: string;
    courses: {
      name: string;
      code: string;
      lecturer_id: string | null;
      group_id: string;
    } | null;
  };

  const sessionResult = await supabase
    .from("class_sessions")
    .select(
      "id, started_at, ended_at, venue, course_id, courses(name, code, lecturer_id, group_id)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionResult.data as unknown as RawSession | null;
  if (!session) notFound();

  // Verify belongs to this lecturer
  if (session.courses?.lecturer_id !== user.id) redirect("/lecturer/sessions");

  const groupId = session.courses?.group_id ?? "";

  // Enrolled students
  type MemberRow = { student_id: string };
  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("status", "active");
  const members = (membersResult.data ?? []) as MemberRow[];
  const studentIds = members.map((m) => m.student_id);

  type StudentRow = { id: string; name: string; index_number: string };
  const studentsResult = studentIds.length
    ? await supabase
        .from("students")
        .select("id, name, index_number")
        .in("id", studentIds)
        .order("name")
    : { data: [] };
  const students = (studentsResult.data ?? []) as StudentRow[];

  // Attendance records
  type AttRow = {
    id: string;
    student_id: string;
    status: "present" | "late" | "absent";
    checked_in_at: string | null;
    geo_verified: boolean;
    selfie_path: string | null;
  };
  const attResult = await supabase
    .from("attendance")
    .select("id, student_id, status, checked_in_at, geo_verified, selfie_path")
    .eq("session_id", sessionId);
  const attRows = (attResult.data ?? []) as AttRow[];
  const attMap: Record<string, AttRow> = {};
  attRows.forEach((a) => {
    attMap[a.student_id] = a;
  });

  const rows: AttendanceRow[] = students.map((s) => {
    const a = attMap[s.id] ?? null;
    return {
      attendanceId: a?.id ?? null,
      studentId: s.id,
      studentName: s.name,
      indexNumber: s.index_number,
      status: a?.status ?? null,
      checkedInAt: a?.checked_in_at ?? null,
      geoVerified: a?.geo_verified ?? false,
      isManual: a != null && !a.selfie_path,
    };
  });

  const isLive = !session.ended_at;

  return {
    session: {
      id: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      venue: session.venue,
      courseId: session.course_id,
      courseName: session.courses?.name ?? "Unknown Course",
      courseCode: session.courses?.code ?? "",
      isLive,
    },
    rows,
    total: students.length,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerSessionAttendancePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, rows, total } = await getData(sessionId);

  const sessionDateLabel = fmtDate(session.startedAt);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-1)",
            }}
          >
            <Link
              href={`/lecturer/courses/${session.courseId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                color: "var(--color-text-3)",
                textDecoration: "none",
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
                <path d="M13 5l-5 5 5 5" />
              </svg>
              {session.courseCode}
            </Link>
          </div>
          <h1 className="page-title">Attendance Sheet</h1>
          <p className="page-subtitle">
            {session.courseName} · {sessionDateLabel}
            {session.endedAt &&
              ` · ${fmtDuration(session.startedAt, session.endedAt)}`}
            {session.venue && ` · ${session.venue}`}
          </p>
        </div>

        {session.isLive && (
          <Link
            href={`/lecturer/sessions/${sessionId}`}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            Back to Live
          </Link>
        )}
      </div>

      <AttendanceClient
        sessionId={sessionId}
        rows={rows}
        totalStudents={total}
        courseName={session.courseName}
        courseCode={session.courseCode}
        sessionDate={sessionDateLabel}
        isLive={session.isLive}
      />
    </div>
  );
}
