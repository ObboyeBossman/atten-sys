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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

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

  // Fetch all pending disputes for sessions belonging to the rep's group
  type RawDispute = {
    id: string;
    reason: string;
    raised_at: string;
    attendance: {
      status: "present" | "late" | "absent" | null;
      student_id: string;
      class_sessions: {
        started_at: string;
        courses: {
          name: string;
          code: string;
          group_id: string;
        } | null;
      } | null;
    } | null;
  };

  const disputesResult = await supabase
    .from("attendance_disputes")
    .select(`
      id,
      reason,
      raised_at,
      attendance (
        status,
        student_id,
        class_sessions (
          started_at,
          courses ( name, code, group_id )
        )
      )
    `)
    .eq("status", "pending")
    .order("raised_at", { ascending: false });

  const rawDisputes = (disputesResult.data ?? []) as unknown as RawDispute[];

  // Filter to only disputes belonging to the rep's group
  const groupDisputes = rawDisputes.filter(
    (d) => d.attendance?.class_sessions?.courses?.group_id === groupId
  );

  if (groupDisputes.length === 0) {
    return { disputes: [], groupId };
  }

  // Collect student IDs to look up names
  const studentIds = [...new Set(groupDisputes.map((d) => d.attendance?.student_id).filter(Boolean) as string[])];

  type StudentRow = { id: string; name: string; index_number: string };
  const studentsResult = studentIds.length
    ? await supabase
        .from("students")
        .select("id, name, index_number")
        .in("id", studentIds)
    : { data: [] };

  const studentMap: Record<string, StudentRow> = {};
  ((studentsResult.data ?? []) as StudentRow[]).forEach((s) => {
    studentMap[s.id] = s;
  });

  const disputes: DisputeRow[] = groupDisputes.map((d) => {
    const sid = d.attendance?.student_id ?? "";
    const student = studentMap[sid];
    const session = d.attendance?.class_sessions;
    const course = session?.courses;
    return {
      id: d.id,
      reason: d.reason,
      raisedAt: d.raised_at,
      studentName: student?.name ?? "Unknown Student",
      indexNumber: student?.index_number ?? "—",
      courseName: course?.name ?? "Unknown Course",
      courseCode: course?.code ?? "",
      sessionDate: session?.started_at ?? "",
      currentStatus: d.attendance?.status ?? null,
    };
  });

  return { disputes, groupId };
}

/* ── page ───────────────────────────────────────────────── */
export default async function RepDisputesPage() {
  const { disputes } = await getData();

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Disputes</h1>
          <p className="page-subtitle">
            Pending attendance disputes from your group
          </p>
        </div>
        {disputes.length > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-full)",
            background: "var(--color-warning-bg)",
            border: "1px solid rgba(245,158,11,0.3)",
            fontSize: "var(--text-sm)", fontWeight: 700,
            color: "var(--color-warning)",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--color-warning)",
              display: "inline-block",
            }} />
            {disputes.length} pending
          </div>
        )}
      </div>

      {/* Empty state */}
      {disputes.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-6)" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--color-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-4)",
            color: "var(--color-text-3)",
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
            No pending disputes from your group right now.
          </p>
        </div>
      )}

      {/* Disputes list */}
      {disputes.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {disputes.map((dispute, i) => (
            <Link
              key={dispute.id}
              href={`/rep/disputes/${dispute.id}`}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-4)",
                padding: "var(--space-4) var(--space-5)",
                borderBottom: i < disputes.length - 1 ? "1px solid var(--color-border)" : "none",
                textDecoration: "none",
                transition: "background var(--transition-fast)",
              }}
              className="dispute-row"
            >
              {/* Avatar */}
              <div className="avatar" style={{ flexShrink: 0, background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
                {dispute.studentName.charAt(0).toUpperCase()}
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
                    {dispute.studentName}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                    {dispute.indexNumber}
                  </span>
                  {dispute.currentStatus && (
                    <StatusBadge status={dispute.currentStatus} />
                  )}
                </div>

                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginBottom: "var(--space-1)" }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-2)" }}>{dispute.courseCode}</span>
                  {dispute.sessionDate && ` · ${fmtDate(dispute.sessionDate)} at ${fmtTime(dispute.sessionDate)}`}
                </div>

                <div style={{
                  fontSize: "var(--text-xs)", color: "var(--color-text-2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  "{dispute.reason}"
                </div>
                {/* Time-ago — shown inline on mobile instead of right column */}
                <div className="dispute-timeago-mobile" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 3 }}>
                  {timeAgo(dispute.raisedAt)}
                </div>
              </div>

              {/* Right side — hidden on small screens, shown on md+ */}
              <div className="dispute-right-col" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)" }}>
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: 600,
                  color: "var(--color-warning)", background: "var(--color-warning-bg)",
                  padding: "2px 8px", borderRadius: "var(--radius-full)",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}>
                  Pending
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                  {timeAgo(dispute.raisedAt)}
                </span>
              </div>

              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--color-text-3)" }} aria-hidden="true">
                <path d="M7 5l5 5-5 5" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .dispute-row:hover { background: var(--color-surface-2); }
        /* On mobile, hide the right column and inline-timeago shows instead */
        @media (max-width: 600px) {
          .dispute-right-col { display: none; }
          .dispute-timeago-mobile { display: block; }
        }
        @media (min-width: 601px) {
          .dispute-timeago-mobile { display: none; }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: "present" | "late" | "absent" }) {
  const map = {
    present: { bg: "var(--color-present-bg)", color: "var(--color-present)", label: "Present" },
    late:    { bg: "var(--color-late-bg)",    color: "var(--color-late)",    label: "Late"    },
    absent:  { bg: "var(--color-absent-bg)",  color: "var(--color-absent)",  label: "Absent"  },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 600,
      background: s.bg, color: s.color,
      padding: "1px 6px", borderRadius: "var(--radius-full)",
    }}>
      {s.label}
    </span>
  );
}
