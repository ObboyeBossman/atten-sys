import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveSessionClient } from "./LiveSessionClient";
import type { AttendanceEntry } from "./LiveSessionClient";

export const metadata: Metadata = { title: "Live Session" };
export const revalidate = 0;

/* ── helpers ─────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    duration_minutes: number;
    course_id: string;
    courses: {
      id: string;
      name: string;
      code: string;
      lecturer_id: string | null;
      group_id: string;
      groups: { group_name: string } | null;
    } | null;
  };

  const sessionResult = await supabase
    .from("class_sessions")
    .select(
      "id, started_at, ended_at, venue, duration_minutes, course_id, courses(id, name, code, lecturer_id, group_id, groups(group_name))"
    )
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionResult.data as unknown as RawSession | null;
  if (!session) notFound();

  // Verify session belongs to this lecturer's course
  if (session.courses?.lecturer_id !== user.id) redirect("/lecturer/sessions");

  // If ended — redirect to post-session attendance view
  if (session.ended_at) {
    redirect(`/lecturer/sessions/${sessionId}/attendance`);
  }

  // All enrolled students
  type MemberRow = {
    student_id: string;
    students: { name: string; index_number: string } | null;
  };

  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id, students(name, index_number)")
    .eq("group_id", session.courses?.group_id ?? "")
    .eq("status", "active")
    .order("student_id");

  const members = (membersResult.data ?? []) as unknown as MemberRow[];

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

  const entries: AttendanceEntry[] = members.map((m) => {
    const a = attMap[m.student_id] ?? null;
    return {
      attendanceId: a?.id ?? null,
      studentId: m.student_id,
      studentName: m.students?.name ?? "Unknown",
      indexNumber: m.students?.index_number ?? "—",
      status: a?.status ?? null,
      checkedInAt: a?.checked_in_at ?? null,
      geoVerified: a?.geo_verified ?? false,
      selfiePath: a?.selfie_path ?? null,
      isManual: a != null && !a.selfie_path,
    };
  });

  const checkins = entries.filter(
    (e) => e.status === "present" || e.status === "late"
  ).length;

  return {
    session: {
      id: session.id,
      startedAt: session.started_at,
      venue: session.venue,
      courseName: session.courses?.name ?? "Unknown Course",
      courseCode: session.courses?.code ?? "",
      courseId: session.course_id,
      groupName: session.courses?.groups?.group_name ?? "",
    },
    entries,
    checkins,
    total: members.length,
    elapsed: elapsed(session.started_at),
    startedAtFmt: fmtTime(session.started_at),
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerLiveSessionPage({
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-1)",
            }}
          >
            <Link
              href={`/lecturer/courses/${data.session.courseId}`}
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
              {data.session.courseCode}
            </Link>
          </div>
          <h1
            className="page-title"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.session.courseName}
          </h1>
          <p className="page-subtitle">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                color: "var(--color-success)",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-success)",
                  display: "inline-block",
                  animation: "pulse 2s infinite",
                }}
              />
              Live
            </span>
            {" · "}
            {data.session.groupName}
            {" · "}
            Started {data.startedAtFmt}
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
