import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DisputeResolveClient } from "./DisputeResolveClient";

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

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/* ── data ───────────────────────────────────────────────── */
async function getData(disputeId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lecturerResult = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  // Dispute
  type RawDispute = {
    id: string;
    attendance_id: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    raised_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
  };

  const disputeResult = await supabase
    .from("attendance_disputes")
    .select("id, attendance_id, reason, status, raised_at, resolved_at, resolution_note")
    .eq("id", disputeId)
    .maybeSingle();

  const dispute = disputeResult.data as unknown as RawDispute | null;
  if (!dispute) notFound();

  // Attendance record
  type RawAtt = {
    id: string;
    student_id: string;
    session_id: string;
    status: "present" | "late" | "absent";
    checked_in_at: string | null;
    geo_verified: boolean;
  };

  const attResult = await supabase
    .from("attendance")
    .select("id, student_id, session_id, status, checked_in_at, geo_verified")
    .eq("id", dispute.attendance_id)
    .maybeSingle();

  const att = attResult.data as unknown as RawAtt | null;
  if (!att) notFound();

  // Session + course
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
    } | null;
  };

  const sessionResult = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, venue, course_id, courses(name, code, lecturer_id)")
    .eq("id", att.session_id)
    .maybeSingle();

  const session = sessionResult.data as unknown as RawSession | null;
  if (!session) notFound();

  // Verify this session belongs to this lecturer
  if (session.courses?.lecturer_id !== user.id) redirect("/lecturer/disputes");

  // Student
  const studentResult = await supabase
    .from("students")
    .select("name, index_number")
    .eq("id", att.student_id)
    .maybeSingle();

  const student = studentResult.data as { name: string; index_number: string } | null;

  // Who resolved it?
  let resolverName: string | null = null;
  if (dispute.resolved_at) {
    // Could be lecturer or admin — try lecturers first
    const resolverResult = await supabase
      .from("lecturers")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    resolverName = (resolverResult.data as { name: string } | null)?.name ?? null;
  }

  return {
    dispute,
    att,
    session,
    student,
    resolverName,
    lecturerId: user.id,
    attendanceId: att.id,
    currentAttStatus: att.status,
  };
}

/* ── page ───────────────────────────────────────────────── */
export default async function DisputeDetailPage({
  params,
}: {
  params: { disputeId: string };
}) {
  const {
    dispute,
    att,
    session,
    student,
    resolverName,
    lecturerId,
    attendanceId,
    currentAttStatus,
  } = await getData(params.disputeId);

  const isPending = dispute.status === "pending";

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href="/lecturer/disputes"
          style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
            fontSize: "var(--text-sm)", color: "var(--color-text-3)", textDecoration: "none",
          }}
          className="back-link"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 15l-5-5 5-5" />
          </svg>
          Disputes
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <h1 className="page-title" style={{ margin: 0 }}>Dispute</h1>
          <DisputeStatusBadge status={dispute.status} />
        </div>
        <p className="page-subtitle">
          Raised {fmtDateShort(dispute.raised_at)} · {session.courses?.code} — {session.courses?.name}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-4)" }} className="detail-grid">

        {/* Student + session info */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-4)" }}>
            Student
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="avatar" style={{
              width: 48, height: 48, fontSize: "var(--text-lg)", fontWeight: 800,
              background: "var(--color-surface-2)", color: "var(--color-text-2)",
              flexShrink: 0,
            }}>
              {(student?.name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)" }}>
                {student?.name ?? "Unknown Student"}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", fontFamily: "var(--font-mono)" }}>
                {student?.index_number ?? "—"}
              </div>
            </div>
          </div>

          <Divider />

          <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "var(--space-4) 0" }}>
            Session
          </h2>
          <InfoRow label="Course" value={`${session.courses?.code} — ${session.courses?.name}`} />
          <InfoRow label="Date" value={fmtDate(session.started_at)} />
          <InfoRow label="Time" value={fmtTime(session.started_at)} />
          {session.venue && <InfoRow label="Venue" value={session.venue} />}

          <Divider />

          <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "var(--space-4) 0" }}>
            Recorded Attendance
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <AttStatusBadge status={currentAttStatus} />
            {att.checked_in_at && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
                Checked in at {fmtTime(att.checked_in_at)}
              </span>
            )}
            {att.geo_verified && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 600 }}>
                ✓ GPS verified
              </span>
            )}
          </div>
        </div>

        {/* Dispute reason */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-3)" }}>
            Student&apos;s Reason
          </h2>
          <blockquote style={{
            margin: 0,
            padding: "var(--space-4)",
            borderLeft: "3px solid var(--color-warning)",
            background: "var(--color-warning-bg)",
            borderRadius: "0 var(--radius-base) var(--radius-base) 0",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}>
            &ldquo;{dispute.reason}&rdquo;
          </blockquote>
        </div>

        {/* Resolve section or resolution info */}
        {isPending ? (
          <div className="card" style={{ padding: "var(--space-5)" }}>
            <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-4)" }}>
              Resolve Dispute
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-4)" }}>
              Approving will update the student&apos;s attendance to <strong>Present</strong>. Rejecting will keep the current status.
            </p>
            <DisputeResolveClient
              disputeId={dispute.id}
              attendanceId={attendanceId}
              lecturerId={lecturerId}
            />
          </div>
        ) : (
          <div className="card" style={{ padding: "var(--space-5)" }}>
            <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-4)" }}>
              Resolution
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <DisputeStatusBadge status={dispute.status} />
              {dispute.resolved_at && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
                  {fmtDateShort(dispute.resolved_at)}
                </span>
              )}
            </div>
            {dispute.resolution_note && (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.6 }}>
                {dispute.resolution_note}
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        .back-link:hover { color: var(--color-text-2) !important; }
        @media (min-width: 768px) {
          .detail-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ── small components ────────────────────────────────────── */
function Divider() {
  return <div style={{ height: 1, background: "var(--color-border)", margin: "0 calc(var(--space-5) * -1)" }} />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", minWidth: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", fontWeight: 500 }}>{value}</span>
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
    <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: s.bg, color: s.color, padding: "3px 10px", borderRadius: "var(--radius-full)" }}>
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
    <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: s.bg, color: s.color, padding: "3px 10px", borderRadius: "var(--radius-full)", border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}
