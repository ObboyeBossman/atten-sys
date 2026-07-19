import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveSessionClient } from "./LiveSessionClient";

export const metadata: Metadata = { title: "Live Session" };
export const revalidate = 0;

/* ── types ──────────────────────────────────────────────── */
export type AttendanceEntry = {
  attendanceId: string | null;
  studentId: string;
  studentName: string;
  indexNumber: string;
  status: "present" | "late" | "absent" | null;
  checkedInAt: string | null;
  geoVerified: boolean;
  selfiePath: string | null;
  isManual: boolean;
};

/* ── helpers ─────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}

function elapsed(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/* ── data ───────────────────────────────────────────────── */
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

  // Session info
  type SessionRaw = {
    id: string;
    started_at: string;
    ended_at: string | null;
    venue: string | null;
    course_id: string;
    courses: { name: string; code: string; group_id: string } | null;
  };
  const sessionResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue, course_id, courses(name, code, group_id)")
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionResult.data as unknown as SessionRaw | null;
  if (!session) redirect("/rep/dashboard");

  // Verify session belongs to rep's group
  if (session.courses?.group_id !== groupId) redirect("/rep/dashboard");

  // If session is already ended, redirect to attendance view
  if (session.ended_at) {
    redirect(`/rep/sessions/${sessionId}/attendance`);
  }

  // All students in the group
  type MemberRow = { student_id: string };
  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("status", "active");
  const members = (membersResult.data ?? []) as MemberRow[];
  const studentIds = members.map((m) => m.student_id);

  // Student names
  type StudentRow = { id: string; name: string; index_number: string };
  const studentsResult = studentIds.length
    ? await supabase
        .from("students")
        .select("id, name, index_number")
        .in("id", studentIds)
        .order("name")
    : { data: [] };
  const students = (studentsResult.data ?? []) as StudentRow[];

  // Attendance rows for this session
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
  attRows.forEach((a) => { attMap[a.student_id] = a; });

  const entries: AttendanceEntry[] = students.map((s) => {
    const a = attMap[s.id] ?? null;
    return {
      attendanceId: a?.id ?? null,
      studentId: s.id,
      studentName: s.name,
      indexNumber: s.index_number,
      status: a?.status ?? null,
      checkedInAt: a?.checked_in_at ?? null,
      geoVerified: a?.geo_verified ?? false,
      selfiePath: a?.selfie_path ?? null,
      isManual: a != null && !a.selfie_path,
    };
  });

  const checkins = entries.filter((e) => e.status === "present" || e.status === "late").length;

  return {
    session: {
      id: session.id,
      startedAt: session.started_at,
      venue: session.venue,
      courseName: session.courses?.name ?? "Unknown Course",
      courseCode: session.courses?.code ?? "",
      courseId: session.course_id,
    },
    entries,
    checkins,
    total: students.length,
    elapsed: elapsed(session.started_at),
    startedAtFmt: fmtTime(session.started_at),
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getData(sessionId);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <Link
              href={`/rep/courses/${data.session.courseId}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--color-text-3)", textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 5l-5 5 5 5" />
              </svg>
              {data.session.courseCode}
            </Link>
          </div>
          <h1 className="page-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.session.courseName}
          </h1>
          <p className="page-subtitle">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
              color: "var(--color-success)", fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)", display: "inline-block", animation: "pulse 2s infinite" }} />
              Live
            </span>
            {" · "}Started {data.startedAtFmt}
            {data.session.venue ? ` · ${data.session.venue}` : ""}
          </p>
        </div>
      </div>

      <LiveSessionClient
        sessionId={sessionId}
        entries={data.entries}
        checkins={data.checkins}
        total={data.total}
        elapsedInitial={data.elapsed}
        startedAt={data.session.startedAt}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,.2); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  );
}
