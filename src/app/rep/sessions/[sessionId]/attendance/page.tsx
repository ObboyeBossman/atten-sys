import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AttendanceClient } from "./AttendanceClient";

export const metadata: Metadata = { title: "Session Attendance" };
export const revalidate = 0;

export type AttendanceRow = {
  attendanceId: string | null;
  studentId: string;
  studentName: string;
  indexNumber: string;
  status: "present" | "late" | "absent" | null;
  checkedInAt: string | null;
  geoVerified: boolean;
  isManual: boolean;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "Ongoing";
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

async function getData(sessionId: string) {
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

  type SessionRaw = {
    id: string; started_at: string; ended_at: string | null;
    venue: string | null; course_id: string;
    courses: { name: string; code: string; group_id: string } | null;
  };
  const sessionResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue, course_id, courses(name, code, group_id)")
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionResult.data as unknown as SessionRaw | null;
  if (!session) redirect("/rep/dashboard");
  if (session.courses?.group_id !== groupId) redirect("/rep/dashboard");

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

  type AttRow = {
    id: string; student_id: string; status: "present" | "late" | "absent";
    checked_in_at: string | null; geo_verified: boolean; selfie_path: string | null;
  };
  const attResult = await supabase
    .from("attendance")
    .select("id, student_id, status, checked_in_at, geo_verified, selfie_path")
    .eq("session_id", sessionId);
  const attRows = (attResult.data ?? []) as AttRow[];
  const attMap: Record<string, AttRow> = {};
  attRows.forEach((a) => { attMap[a.student_id] = a; });

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

  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.status === "late").length;
  const absent = rows.filter((r) => r.status === "absent" || r.status === null).length;

  return {
    session: {
      id: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      venue: session.venue,
      courseId: session.course_id,
      courseName: session.courses?.name ?? "Unknown Course",
      courseCode: session.courses?.code ?? "",
      isLive: !session.ended_at,
    },
    rows,
    stats: { present, late, absent, total: students.length },
  };
}

export default async function SessionAttendancePage({
  params,
}: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { session, rows, stats } = await getData(sessionId);

  return (
    <div>
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <Link
              href={`/rep/courses/${session.courseId}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--color-text-3)", textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 5l-5 5 5 5" />
              </svg>
              {session.courseCode}
            </Link>
          </div>
          <h1 className="page-title">Attendance Sheet</h1>
          <p className="page-subtitle">
            {session.courseName} · {fmtDate(session.startedAt)}
            {session.endedAt && ` · ${fmtDuration(session.startedAt, session.endedAt)}`}
            {session.venue && ` · ${session.venue}`}
          </p>
        </div>

        {session.isLive && (
          <Link href={`/rep/sessions/${sessionId}`} className="btn btn-primary" style={{ flexShrink: 0 }}>
            Back to Live
          </Link>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "var(--space-3)",
        marginBottom: "var(--space-6)",
      }}>
        {[
          { label: "Total", value: stats.total, color: "var(--color-text)" },
          { label: "Present", value: stats.present, color: "var(--color-present)" },
          { label: "Late", value: stats.late, color: "var(--color-late)" },
          { label: "Absent", value: stats.absent, color: "var(--color-absent)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <AttendanceClient
        sessionId={sessionId}
        rows={rows}
        totalStudents={stats.total}
        startedAt={session.startedAt}
        courseName={session.courseName}
        courseCode={session.courseCode}
        sessionDate={fmtDate(session.startedAt)}
      />
    </div>
  );
}
