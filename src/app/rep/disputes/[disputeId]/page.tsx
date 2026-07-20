import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DisputeClient } from "./DisputeClient";

export const metadata: Metadata = { title: "Dispute Detail" };
export const revalidate = 0;

/* ── helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── data ───────────────────────────────────────────────── */
async function getData(disputeId: string) {
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

  // Fetch dispute with full context
  type RawDispute = {
    id: string;
    reason: string;
    raised_at: string;
    status: "pending" | "approved" | "rejected";
    resolution_note: string | null;
    attendance: {
      id: string;
      status: "present" | "late" | "absent" | null;
      checked_in_at: string | null;
      geo_verified: boolean;
      selfie_path: string | null;
      student_id: string;
      class_sessions: {
        id: string;
        started_at: string;
        ended_at: string | null;
        venue: string | null;
        course_id: string;
        courses: {
          name: string;
          code: string;
          group_id: string;
        } | null;
      } | null;
    } | null;
  };

  const disputeResult = await supabase
    .from("attendance_disputes")
    .select(`
      id,
      reason,
      raised_at,
      status,
      resolution_note,
      attendance (
        id,
        status,
        checked_in_at,
        geo_verified,
        selfie_path,
        student_id,
        class_sessions (
          id,
          started_at,
          ended_at,
          venue,
          course_id,
          courses ( name, code, group_id )
        )
      )
    `)
    .eq("id", disputeId)
    .maybeSingle();

  const dispute = disputeResult.data as unknown as RawDispute | null;
  if (!dispute) redirect("/rep/disputes");

  // Verify belongs to rep's group
  const course = dispute.attendance?.class_sessions?.courses;
  if (course?.group_id !== groupId) redirect("/rep/disputes");

  // Student info
  const studentId = dispute.attendance?.student_id ?? "";
  type StudentRow = { id: string; name: string; index_number: string };
  const studentResult = studentId
    ? await supabase.from("students").select("id, name, index_number").eq("id", studentId).maybeSingle()
    : { data: null };
  const student = studentResult.data as StudentRow | null;

  return {
    dispute: {
      id: dispute.id,
      reason: dispute.reason,
      raisedAt: dispute.raised_at,
      status: dispute.status,
      resolutionNote: dispute.resolution_note,
    },
    attendance: {
      id: dispute.attendance?.id ?? "",
      status: dispute.attendance?.status ?? null,
      checkedInAt: dispute.attendance?.checked_in_at ?? null,
      geoVerified: dispute.attendance?.geo_verified ?? false,
      selfiePath: dispute.attendance?.selfie_path ?? null,
    },
    session: {
      id: dispute.attendance?.class_sessions?.id ?? "",
      startedAt: dispute.attendance?.class_sessions?.started_at ?? "",
      endedAt: dispute.attendance?.class_sessions?.ended_at ?? null,
      venue: dispute.attendance?.class_sessions?.venue ?? null,
      courseId: dispute.attendance?.class_sessions?.course_id ?? "",
    },
    course: {
      name: course?.name ?? "Unknown Course",
      code: course?.code ?? "",
    },
    student: {
      id: studentId,
      name: student?.name ?? "Unknown Student",
      indexNumber: student?.index_number ?? "—",
    },
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;
  const { dispute, attendance, session, course, student } = await getData(disputeId);

  const isPending = dispute.status === "pending";
  const isAlreadyResolved = !isPending;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <Link
              href="/rep/disputes"
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--color-text-3)", textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 5l-5 5 5 5" />
              </svg>
              Disputes
            </Link>
          </div>
          <h1 className="page-title">Dispute Detail</h1>
          <p className="page-subtitle">{course.name} · {fmtDate(session.startedAt)}</p>
        </div>
        <DisputeStatusBadge status={dispute.status} />
      </div>

      {/* Already resolved banner */}
      {isAlreadyResolved && (
        <div className="alert" style={{
          marginBottom: "var(--space-6)",
          background: dispute.status === "approved" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
          borderColor: dispute.status === "approved" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
          color: dispute.status === "approved" ? "var(--color-success)" : "var(--color-danger)",
        }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {dispute.status === "approved"
              ? <path d="M16 5L8 13l-4-4" />
              : <><circle cx="10" cy="10" r="9" /><path d="M10 7v3M10 13h.01" /></>
            }
          </svg>
          <span>
            This dispute was <strong>{dispute.status}</strong>.
            {dispute.resolutionNote && (
              <> Resolution note: "{dispute.resolutionNote}"</>
            )}
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Student + session context */}
        <div className="card">
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-5)" }}>
            Context
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Student */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div className="avatar" style={{ flexShrink: 0 }}>
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
                  {student.name}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                  {student.indexNumber}
                </div>
              </div>
              {attendance.status && (
                <div style={{ marginLeft: "auto" }}>
                  <AttendanceStatusBadge status={attendance.status} />
                </div>
              )}
            </div>

            <div style={{ height: 1, background: "var(--color-border)" }} />

            {/* Session info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <InfoItem label="Course" value={`${course.code} — ${course.name}`} />
              <InfoItem label="Session date" value={fmtDate(session.startedAt)} />
              <InfoItem label="Started at" value={fmtTime(session.startedAt)} />
              {session.venue && <InfoItem label="Venue" value={session.venue} />}
              {attendance.checkedInAt && (
                <InfoItem label="Checked in at" value={fmtTime(attendance.checkedInAt)} />
              )}
              <InfoItem label="GPS verified" value={attendance.geoVerified ? "Yes ✓" : "No"} />
            </div>
          </div>
        </div>

        {/* Dispute reason */}
        <div className="card">
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
            Student's reason
          </h2>
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-lg)",
            borderLeft: "3px solid var(--color-warning)",
            fontSize: "var(--text-sm)", color: "var(--color-text-2)",
            lineHeight: 1.6,
          }}>
            "{dispute.reason}"
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-3)" }}>
            Raised {fmtDate(dispute.raisedAt)} at {fmtTime(dispute.raisedAt)}
          </div>
        </div>

        {/* Selfie (if available) */}
        {attendance.selfiePath && (
          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
              Check-in selfie
            </h2>
            <Image
              src={attendance.selfiePath}
              alt={`${student.name}'s check-in selfie`}
              width={120}
              height={120}
              style={{
                borderRadius: "var(--radius-xl)",
                objectFit: "cover",
                border: "2px solid var(--color-border)",
              }}
            />
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
              Resolution
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)" }}>
              Approving will let you update the student's attendance status. Rejecting keeps their current record unchanged.
            </p>
            <DisputeClient
              disputeId={dispute.id}
              attendanceId={attendance.id}
              studentName={student.name}
              currentStatus={attendance.status}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────── */
function DisputeStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending:  { bg: "var(--color-warning-bg)",  color: "var(--color-warning)",  label: "Pending"  },
    approved: { bg: "var(--color-success-bg)",  color: "var(--color-success)",  label: "Approved" },
    rejected: { bg: "var(--color-danger-bg)",   color: "var(--color-danger)",   label: "Rejected" },
  };
  const s = map[status];
  return (
    <span style={{
      flexShrink: 0,
      fontSize: "var(--text-xs)", fontWeight: 700,
      background: s.bg, color: s.color,
      padding: "var(--space-2) var(--space-3)",
      borderRadius: "var(--radius-full)",
    }}>
      {s.label}
    </span>
  );
}

function AttendanceStatusBadge({ status }: { status: "present" | "late" | "absent" }) {
  const map = {
    present: { bg: "var(--color-present-bg)", color: "var(--color-present)", label: "Present" },
    late:    { bg: "var(--color-late-bg)",    color: "var(--color-late)",    label: "Late"    },
    absent:  { bg: "var(--color-absent-bg)",  color: "var(--color-absent)",  label: "Absent"  },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 700,
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: "var(--radius-full)",
    }}>
      {s.label}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}
