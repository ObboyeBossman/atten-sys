import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Disputes" };
export const revalidate = 0;

/* ── types ──────────────────────────────────────────────── */
type DisputeRow = {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  raisedAt: string;
  studentName: string;
  indexNumber: string;
  courseName: string;
  courseCode: string;
  sessionDate: string;
  currentStatus: "present" | "late" | "absent" | null;
};

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── data ───────────────────────────────────────────────── */
async function getData() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lecturerResult = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  // All courses for this lecturer
  const coursesResult = await supabase
    .from("courses")
    .select("id")
    .eq("lecturer_id", user.id);

  const courseIds = ((coursesResult.data ?? []) as { id: string }[]).map((c) => c.id);
  if (courseIds.length === 0) return { disputes: [], pendingCount: 0 };

  // All sessions for those courses
  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id")
    .in("course_id", courseIds);

  const sessionIds = ((sessionsResult.data ?? []) as { id: string }[]).map((s) => s.id);
  if (sessionIds.length === 0) return { disputes: [], pendingCount: 0 };

  // Attendance records for those sessions
  const attResult = await supabase
    .from("attendance")
    .select("id, student_id, status, session_id")
    .in("session_id", sessionIds);

  const attRows = (attResult.data ?? []) as {
    id: string;
    student_id: string;
    status: "present" | "late" | "absent";
    session_id: string;
  }[];

  if (attRows.length === 0) return { disputes: [], pendingCount: 0 };

  const attIds = attRows.map((a) => a.id);
  const attMap: Record<string, typeof attRows[0]> = {};
  attRows.forEach((a) => { attMap[a.id] = a; });

  // Disputes for those attendance records
  type RawDispute = {
    id: string;
    attendance_id: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    raised_at: string;
  };

  const disputesResult = await supabase
    .from("attendance_disputes")
    .select("id, attendance_id, reason, status, raised_at")
    .in("attendance_id", attIds)
    .order("raised_at", { ascending: false });

  const rawDisputes = (disputesResult.data ?? []) as RawDispute[];
  if (rawDisputes.length === 0) return { disputes: [], pendingCount: 0 };

  // Student names
  const studentIds = [...new Set(rawDisputes.map((d) => attMap[d.attendance_id]?.student_id).filter(Boolean) as string[])];
  const studentsResult = studentIds.length
    ? await supabase.from("students").select("id, name, index_number").in("id", studentIds)
    : { data: [] };
  const studentMap: Record<string, { name: string; index_number: string }> = {};
  ((studentsResult.data ?? []) as { id: string; name: string; index_number: string }[])
    .forEach((s) => { studentMap[s.id] = s; });

  // Session → course info
  const sessionCourseResult = await supabase
    .from("class_sessions")
    .select("id, started_at, courses(name, code)")
    .in("id", sessionIds);

  type SessionCourseRow = {
    id: string;
    started_at: string;
    courses: { name: string; code: string } | null;
  };

  const sessionCourseMap: Record<string, SessionCourseRow> = {};
  ((sessionCourseResult.data ?? []) as unknown as SessionCourseRow[])
    .forEach((s) => { sessionCourseMap[s.id] = s; });

  const disputes: DisputeRow[] = rawDisputes.map((d) => {
    const att = attMap[d.attendance_id];
    const student = studentMap[att?.student_id ?? ""];
    const session = sessionCourseMap[att?.session_id ?? ""];
    return {
      id: d.id,
      reason: d.reason,
      status: d.status,
      raisedAt: d.raised_at,
      studentName: student?.name ?? "Unknown Student",
      indexNumber: student?.index_number ?? "—",
      courseName: session?.courses?.name ?? "Unknown Course",
      courseCode: session?.courses?.code ?? "",
      sessionDate: session?.started_at ?? "",
      currentStatus: att?.status ?? null,
    };
  });

  const pendingCount = disputes.filter((d) => d.status === "pending").length;

  return { disputes, pendingCount };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerDisputesPage() {
  const { disputes, pendingCount } = await getData();

  const pending = disputes.filter((d) => d.status === "pending");
  const resolved = disputes.filter((d) => d.status !== "pending");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Disputes</h1>
          <p className="page-subtitle">
            Attendance disputes raised for your sessions
          </p>
        </div>
        {pendingCount > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-full)",
            background: "var(--color-warning-bg)",
            border: "1px solid rgba(245,158,11,0.3)",
            fontSize: "var(--text-sm)", fontWeight: 700,
            color: "var(--color-warning)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-warning)", display: "inline-block" }} />
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Empty */}
      {disputes.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-6)" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--color-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-4)", color: "var(--color-text-3)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            All clear
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
            No disputes raised for your sessions yet.
          </p>
        </div>
      )}

      {/* Pending disputes */}
      {pending.length > 0 && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-3)",
          }}>
            Pending Review
          </h2>
          <DisputeList disputes={pending} />
        </div>
      )}

      {/* Resolved disputes */}
      {resolved.length > 0 && (
        <div>
          <h2 style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-3)",
          }}>
            Resolved
          </h2>
          <DisputeList disputes={resolved} />
        </div>
      )}

      <style>{`
        .dispute-row:hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  );
}

/* ── dispute list ────────────────────────────────────────── */
function DisputeList({ disputes }: { disputes: DisputeRow[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {disputes.map((d, i) => (
        <Link
          key={d.id}
          href={`/lecturer/disputes/${d.id}`}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: i < disputes.length - 1 ? "1px solid var(--color-border)" : "none",
            textDecoration: "none",
            transition: "background var(--transition-fast)",
          }}
          className="dispute-row"
        >
          <div className="avatar" style={{
            flexShrink: 0,
            background: d.status === "pending" ? "var(--color-warning-bg)" : "var(--color-surface-2)",
            color: d.status === "pending" ? "var(--color-warning)" : "var(--color-text-3)",
          }}>
            {d.studentName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)", flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
                {d.studentName}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                {d.indexNumber}
              </span>
              {d.currentStatus && <AttStatusBadge status={d.currentStatus} />}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginBottom: "var(--space-1)" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-2)" }}>{d.courseCode}</span>
              {d.sessionDate && ` · ${fmtDate(d.sessionDate)} at ${fmtTime(d.sessionDate)}`}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>
              &ldquo;{d.reason}&rdquo;
            </div>
          </div>

          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)" }}>
            <DisputeStatusBadge status={d.status} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
              {timeAgo(d.raisedAt)}
            </span>
          </div>

          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }} aria-hidden="true">
            <path d="M7 5l5 5-5 5" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

function AttStatusBadge({ status }: { status: "present" | "late" | "absent" }) {
  const map = {
    present: { bg: "var(--color-present-bg)", color: "var(--color-present)", label: "Present" },
    late:    { bg: "var(--color-late-bg)",    color: "var(--color-late)",    label: "Late"    },
    absent:  { bg: "var(--color-absent-bg)",  color: "var(--color-absent)",  label: "Absent"  },
  };
  const s = map[status];
  return (
    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, background: s.bg, color: s.color, padding: "1px 6px", borderRadius: "var(--radius-full)" }}>
      {s.label}
    </span>
  );
}

function DisputeStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending:  { bg: "var(--color-warning-bg)", color: "var(--color-warning)", border: "rgba(245,158,11,0.25)", label: "Pending"  },
    approved: { bg: "rgba(16,185,129,0.1)",    color: "var(--color-success)", border: "rgba(16,185,129,0.25)", label: "Approved" },
    rejected: { bg: "var(--color-absent-bg)",  color: "var(--color-absent)",  border: "rgba(239,68,68,0.2)",  label: "Rejected" },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 700,
      background: s.bg, color: s.color,
      padding: "2px 8px", borderRadius: "var(--radius-full)",
      border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}
