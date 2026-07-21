"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { assignLecturerToCourse, deleteCourse } from "../actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  lecturer_id: string | null;
  lecturer_name: string | null;
  lecturer_staff_id: string | null;
  group_id: string;
  group_name: string;
  qual_code: string;
  level_name: string;
  semester_name: string;
  academic_year_name: string;
  created_at: string;
};

type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  venue: string | null;
  notes: string | null;
  total: number;
  present: number;
  late: number;
  absent: number;
};

type Lecturer = { id: string; name: string; staff_id: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function pct(n: number, total: number) {
  if (!total) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const letters = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #3b82f6, #6366f1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.36, fontWeight: 700,
    }}>{letters}</div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4L6 8l4 4"/>
  </svg>
);

const IClose = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13"/>
  </svg>
);

const ISearch = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3"/>
  </svg>
);

const IBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
    <path d="M8 7h8M8 11h8M8 15h5"/>
  </svg>
);

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><IClose /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Assign Lecturer Modal ─────────────────────────────────────────────────────

function AssignModal({
  courseId,
  currentLecturerId,
  lecturers,
  onClose,
  onDone,
}: {
  courseId: string;
  currentLecturerId: string | null;
  lecturers: Lecturer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(currentLecturerId ?? "");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = lecturers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.staff_id.toLowerCase().includes(search.toLowerCase()),
  );

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await assignLecturerToCourse(courseId, selected || null);
    setSaving(false);
    if ("error" in res) { setErr(res.error); return; }
    onDone();
    onClose();
  }

  return (
    <Modal title="Assign Lecturer" onClose={onClose}>
      <div style={{ position: "relative", marginBottom: "var(--space-3)" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)", pointerEvents: "none" }}><ISearch /></span>
        <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search lecturers…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-5)" }}>
        <label style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", cursor: "pointer",
          border: `1px solid ${selected === "" ? "var(--color-primary)" : "var(--color-border)"}`,
          background: selected === "" ? "var(--color-primary-glow)" : "var(--color-surface-2)",
          transition: "all var(--transition-fast)",
        }}>
          <input type="radio" name="lect" value="" checked={selected === ""} onChange={() => setSelected("")} style={{ accentColor: "var(--color-primary)" }} />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", fontStyle: "italic" }}>— Unassigned</span>
        </label>

        {list.map((l) => (
          <label key={l.id} style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", cursor: "pointer",
            border: `1px solid ${selected === l.id ? "var(--color-primary)" : "var(--color-border)"}`,
            background: selected === l.id ? "var(--color-primary-glow)" : "var(--color-surface-2)",
            transition: "all var(--transition-fast)",
          }}>
            <input type="radio" name="lect" value={l.id} checked={selected === l.id} onChange={() => setSelected(l.id)} style={{ accentColor: "var(--color-primary)" }} />
            <Initials name={l.name} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>{l.name}</p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{l.staff_id}</p>
            </div>
          </label>
        ))}

        {list.length === 0 && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", textAlign: "center", padding: "var(--space-6)" }}>No lecturers found.</p>
        )}
      </div>

      {err && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", background: "var(--color-danger-bg)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)" }}>{err}</p>}

      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className={`btn btn-primary ${saving ? "btn-loading" : ""}`} onClick={save} disabled={saving}>
          {!saving && "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ── Delete Course Modal ───────────────────────────────────────────────────────

function DeleteCourseModal({
  course,
  sessionCount,
  attendanceCount,
  onClose,
  onDeleted,
}: {
  course: Course;
  sessionCount: number;
  attendanceCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canDelete = confirm.trim().toLowerCase() === course.code.trim().toLowerCase();

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setErr(null);
    const res = await deleteCourse(course.id);
    setDeleting(false);
    if ("error" in res) { setErr(res.error); return; }
    onDeleted();
  }

  return (
    <Modal title="Delete Course" onClose={onClose}>
      {/* Danger banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
        padding: "var(--space-4)", borderRadius: "var(--radius-lg)",
        background: "var(--color-danger-bg)", border: "1px solid rgba(157,10,18,0.2)",
        marginBottom: "var(--space-5)",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-danger)", marginBottom: 4 }}>
            This action cannot be undone
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.5 }}>
            Deleting <strong>{course.name}</strong> will permanently remove:
          </p>
          <ul style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: "var(--space-2) 0 0 var(--space-4)", lineHeight: 1.8 }}>
            <li>The course record</li>
            <li><strong>{sessionCount}</strong> class session{sessionCount !== 1 ? "s" : ""}</li>
            <li><strong>{attendanceCount}</strong> attendance record{attendanceCount !== 1 ? "s" : ""}</li>
          </ul>
        </div>
      </div>

      {/* Confirmation input */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-2)", marginBottom: "var(--space-2)" }}>
          Type the course code <span style={{ fontFamily: "var(--font-mono)", background: "var(--color-surface-3)", padding: "1px 6px", borderRadius: 4, color: "var(--color-danger)" }}>{course.code}</span> to confirm
        </label>
        <input
          className="input"
          placeholder={course.code}
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setErr(null); }}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {err && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", background: "var(--color-danger-bg)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)" }}>
          {err}
        </p>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
        <button
          className={`btn btn-danger ${deleting ? "btn-loading" : ""}`}
          onClick={handleDelete}
          disabled={!canDelete || deleting}
          style={{ opacity: canDelete ? 1 : 0.45 }}
        >
          {!deleting && (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete Course
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

// ── Info row helper ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-3)" }}>{label}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{children}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [course, setCourse]       = useState<Course | null>(null);
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const [cRes, sRes, lRes, attRes] = await Promise.all([
      (supabase as any).from("courses").select(`
        id, name, code, credit_hours, lecturer_id, created_at,
        group_id,
        groups (
          group_name,
          qualification_types ( code ),
          levels ( name ),
          academic_years ( name )
        ),
        app_semesters ( name ),
        lecturers ( name, staff_id )
      `).eq("id", courseId).single(),

      (supabase as any).from("class_sessions")
        .select("id, started_at, ended_at, duration_minutes, venue, notes")
        .eq("course_id", courseId)
        .order("started_at", { ascending: false }),

      (supabase as any).from("lecturers").select("id, name, staff_id").eq("is_active", true).order("name"),

      (supabase as any).from("attendance").select("session_id, status"),
    ]);

    if (cRes.error || !cRes.data) { setErr("Course not found."); setLoading(false); return; }

    const raw = cRes.data as any;
    setCourse({
      id: raw.id,
      name: raw.name,
      code: raw.code,
      credit_hours: raw.credit_hours,
      lecturer_id: raw.lecturer_id,
      lecturer_name: raw.lecturers?.name ?? null,
      lecturer_staff_id: raw.lecturers?.staff_id ?? null,
      group_id: raw.group_id,
      group_name: raw.groups?.group_name ?? "—",
      qual_code: raw.groups?.qualification_types?.code ?? "",
      level_name: raw.groups?.levels?.name ?? "",
      semester_name: raw.app_semesters?.name ?? "—",
      academic_year_name: raw.groups?.academic_years?.name ?? "—",
      created_at: raw.created_at,
    });

    // Build session-level attendance summary
    const bySess: Record<string, { present: number; late: number; absent: number; total: number }> = {};
    for (const a of attRes.data ?? []) {
      if (!bySess[a.session_id]) bySess[a.session_id] = { present: 0, late: 0, absent: 0, total: 0 };
      bySess[a.session_id].total++;
      if (a.status === "present") bySess[a.session_id].present++;
      else if (a.status === "late") bySess[a.session_id].late++;
      else bySess[a.session_id].absent++;
    }

    const mapped: Session[] = (sRes.data ?? []).map((s: any) => ({
      id: s.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_minutes: s.duration_minutes,
      venue: s.venue,
      notes: s.notes,
      total: bySess[s.id]?.total ?? 0,
      present: bySess[s.id]?.present ?? 0,
      late: bySess[s.id]?.late ?? 0,
      absent: bySess[s.id]?.absent ?? 0,
    }));

    setSessions(mapped);
    setLecturers(lRes.data ?? []);
    setLoading(false);
  }, [courseId, supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Overall attendance rate across all sessions
  const totalPresent    = sessions.reduce((a, s) => a + s.present + s.late, 0);
  const totalRecords    = sessions.reduce((a, s) => a + s.total, 0);
  const overallRate     = totalRecords ? Math.round((totalPresent / totalRecords) * 100) : null;
  const totalAttendance = totalRecords; // alias used by delete modal

  if (loading) return (
    <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--color-text-3)" }}>Loading…</div>
  );

  if (err || !course) return (
    <div className="card" style={{ color: "var(--color-danger)", textAlign: "center" }}>{err ?? "Something went wrong."}</div>
  );

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }} onClick={() => router.push("/admin/courses")}>
          <IBack /> Back to Courses
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => setShowDelete(true)}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Delete Course
        </button>
      </div>

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "var(--radius-lg)", flexShrink: 0,
            background: "var(--color-primary-glow)", border: "1px solid rgba(157,10,18,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)",
          }}>
            <IBook />
          </div>
          <div>
            <h1 className="page-title">{course.name}</h1>
            <p className="page-subtitle" style={{ fontFamily: "var(--font-mono)" }}>{course.code}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        {[
          { label: "Sessions", value: sessions.length },
          { label: "Total Check-ins", value: totalRecords },
          { label: "Attendance Rate", value: overallRate !== null ? `${overallRate}%` : "—" },
          { label: "Credit Hours", value: course.credit_hours },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-text)" }}>{stat.value}</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: "var(--space-6)", padding: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text)" }}>Course Info</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-5)", marginBottom: "var(--space-6)" }}>
          <InfoRow label="Group">{course.group_name}</InfoRow>
          <InfoRow label="Programme">{course.qual_code} · {course.level_name}</InfoRow>
          <InfoRow label="Semester">{course.semester_name}</InfoRow>
          <InfoRow label="Academic Year">{course.academic_year_name}</InfoRow>
          <InfoRow label="Credit Hours">{course.credit_hours}</InfoRow>
          <InfoRow label="Created">{fmtDate(course.created_at)}</InfoRow>
        </div>

        {/* Lecturer panel */}
        <div style={{
          borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-5)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)",
        }}>
          <div>
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-3)", marginBottom: "var(--space-2)" }}>Assigned Lecturer</p>
            {course.lecturer_name ? (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <Initials name={course.lecturer_name} size={40} />
                <div>
                  <p style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-sm)" }}>{course.lecturer_name}</p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{course.lecturer_staff_id}</p>
                </div>
              </div>
            ) : (
              <span className="badge badge-warning">No lecturer assigned</span>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAssign(true)}>
            {course.lecturer_id ? "Change Lecturer" : "Assign Lecturer"}
          </button>
        </div>
      </div>

      {/* Sessions table */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text)" }}>
          Sessions ({sessions.length})
        </h2>
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--color-text-3)", padding: "var(--space-10)" }}>
          No sessions recorded for this course yet.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Venue</th>
                <th style={{ textAlign: "center" }}>Total</th>
                <th style={{ textAlign: "center" }}>Present</th>
                <th style={{ textAlign: "center" }}>Late</th>
                <th style={{ textAlign: "center" }}>Absent</th>
                <th style={{ textAlign: "center" }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const rate = s.total ? Math.round(((s.present + s.late) / s.total) * 100) : null;
                const isOpen = !s.ended_at;
                return (
                  <tr key={s.id}>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", fontWeight: 500 }}>{fmtDatetime(s.started_at)}</p>
                      {s.ended_at && (
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>Ended {fmtDatetime(s.ended_at)}</p>
                      )}
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                      <span className={`badge ${isOpen ? "badge-success" : "badge-neutral"}`}>
                        {isOpen ? "Open" : "Ended"}
                      </span>
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>
                      {s.duration_minutes} min
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>
                      {s.venue ?? <span style={{ color: "var(--color-text-3)" }}>—</span>}
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-2)" }}>
                      {s.total || "—"}
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-success)" }}>{s.present || "—"}</span>
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-warning)" }}>{s.late || "—"}</span>
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-danger)" }}>{s.absent || "—"}</span>
                    </td>

                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      {rate !== null ? (
                        <span style={{
                          fontSize: "var(--text-sm)", fontWeight: 700,
                          color: rate >= 75 ? "var(--color-success)" : rate >= 50 ? "var(--color-warning)" : "var(--color-danger)",
                        }}>
                          {rate}%
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAssign && (
        <AssignModal
          courseId={course.id}
          currentLecturerId={course.lecturer_id}
          lecturers={lecturers}
          onClose={() => setShowAssign(false)}
          onDone={load}
        />
      )}

      {showDelete && (
        <DeleteCourseModal
          course={course}
          sessionCount={sessions.length}
          attendanceCount={totalAttendance}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.replace("/admin/courses")}
        />
      )}
    </div>
  );
}
