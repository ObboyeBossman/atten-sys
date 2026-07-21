"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  assignRep, unassignRep, removeStudent,
  resetStudentPassword, resetGroupDefaultPassword,
  archiveGroup, assignLecturer, createCourse,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Group = {
  id: string;
  group_name: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  qual_code: string;
  qual_name: string;
  level_name: string;
  year_name: string;
  is_current_year: boolean;
};

type Student = {
  id: string;
  name: string;
  index_number: string;
  is_course_rep: boolean;
  membership_status: string;
  joined_at: string;
};

type Course = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  lecturer_id: string | null;
  lecturer_name: string | null;
  semester_id: string;
  semester_name: string;
  session_count: number;
};

type Semester = { id: string; name: string; status: string };
type Lecturer = { id: string; name: string; staff_id: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const letters = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--color-primary), #6366f1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.36, fontWeight: 700,
    }}>
      {letters}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
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
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, danger, confirmLabel, onConfirm, onClose, busy }: {
  title: string; body: string; danger?: boolean; confirmLabel: string;
  onConfirm: () => void; onClose: () => void; busy: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      {danger ? (
        <div style={{
          padding: "var(--space-4)", background: "var(--color-danger-bg)",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-5)", display: "flex", gap: "var(--space-3)",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
          </svg>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>{body}</p>
        </div>
      ) : (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-6)", lineHeight: 1.6 }}>{body}</p>
      )}
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-sm)", fontWeight: 600, border: "none", cursor: "pointer",
        background: active ? "rgba(59,130,246,0.12)" : "transparent",
        color: active ? "var(--color-secondary)" : "var(--color-text-3)",
        transition: "all var(--transition-fast)",
      }}
    >
      {children}
    </button>
  );
}

// ── Eye icon ──────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const groupId  = params.groupId as string;
   
  const supabase = createSupabaseBrowserClient() as any;

  const [group,    setGroup]    = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [tab,      setTab]      = useState<"students" | "courses">("students");

  // student modals
  const [repTarget,       setRepTarget]       = useState<Student | null>(null);
  const [removeTarget,    setRemoveTarget]    = useState<Student | null>(null);
  const [resetPwdTarget,  setResetPwdTarget]  = useState<Student | null>(null);
  const [newPwd,          setNewPwd]          = useState("");
  const [showPwd,         setShowPwd]         = useState(false);

  // group modals
  const [showArchive,     setShowArchive]     = useState(false);
  const [showResetGrpPwd, setShowResetGrpPwd] = useState(false);
  const [grpPwd,          setGrpPwd]          = useState("");
  const [showGrpPwd,      setShowGrpPwd]      = useState(false);

  // course modals
  const [assignLecturerTarget, setAssignLecturerTarget] = useState<Course | null>(null);
  const [newLecturerId,        setNewLecturerId]        = useState("");
  const [showAddCourse,        setShowAddCourse]        = useState(false);
  const [cName,   setCName]   = useState("");
  const [cCode,   setCCode]   = useState("");
  const [cCreds,  setCCreds]  = useState("3");
  const [cSemId,  setCSemId]  = useState("");
  const [cLecId,  setCLecId]  = useState("");
  const [cError,  setCError]  = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const [grpRes, memRes, crsRes, semRes, lecRes] = await Promise.all([
      supabase.from("groups").select(`
        id, group_name, is_archived, archived_at, created_at,
        qualification_types ( name, code ),
        levels ( name ),
        academic_years ( name, is_current )
      `).eq("id", groupId).single(),

      supabase.from("group_memberships").select(`
        student_id, is_course_rep, status, joined_at,
        students ( name, index_number )
      `).eq("group_id", groupId).in("status", ["active", "removed"]).order("joined_at"),

      supabase.from("courses").select(`
        id, name, code, credit_hours, lecturer_id, semester_id,
        lecturers ( name ),
        app_semesters ( name, status ),
        class_sessions ( id )
      `).eq("group_id", groupId).order("created_at", { ascending: false }),

      supabase.from("app_semesters").select("id, name, status").order("start_date", { ascending: false }),
      supabase.from("lecturers").select("id, name, staff_id").order("name"),
    ]);

    if (grpRes.error || !grpRes.data) {
      setError(grpRes.error?.message ?? "Group not found.");
      setLoading(false); return;
    }

     
    const g = grpRes.data as any;
    setGroup({
      id: g.id,
      group_name: g.group_name,
      is_archived: g.is_archived,
      archived_at: g.archived_at,
      created_at: g.created_at,
      qual_code: g.qualification_types?.code ?? "",
      qual_name: g.qualification_types?.name ?? "",
      level_name: g.levels?.name ?? "",
      year_name: g.academic_years?.name ?? "",
      is_current_year: !!g.academic_years?.is_current,
    });

     
    const mems: Student[] = (memRes.data ?? []).map((m: any) => ({
      id: m.student_id,
      name: m.students?.name ?? "Unknown",
      index_number: m.students?.index_number ?? "",
      is_course_rep: m.is_course_rep,
      membership_status: m.status,
      joined_at: m.joined_at,
    }));
    setStudents(mems);

     
    const crs: Course[] = (crsRes.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      credit_hours: c.credit_hours,
      lecturer_id: c.lecturer_id,
      lecturer_name: c.lecturers?.name ?? null,
      semester_id: c.semester_id,
      semester_name: c.app_semesters?.name ?? "",
      session_count: Array.isArray(c.class_sessions) ? c.class_sessions.length : 0,
    }));
    setCourses(crs);

     
    setSemesters((semRes.data ?? []).map((s: any) => ({ id: s.id, name: s.name, status: s.status })));
    setLecturers(lecRes.data ?? []);

     
    const activeSem = (semRes.data ?? []).find((s: any) => s.status === "active");
    if (activeSem && !cSemId) setCSemId(activeSem.id);

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const activeStudents = students.filter(s => s.membership_status === "active");
  const currentReps    = activeStudents.filter(s => s.is_course_rep);
  const repCount       = currentReps.length;
  const atRepCapacity  = repCount >= 2;

  function actionGuard() {
    if (group?.is_archived) {
      setError("This group is archived and cannot be modified.");
      return false;
    }
    return true;
  }

  // ── Generic action runner ────────────────────────────────────────────────────

  async function run(
    fn: () => Promise<{ success: true } | { error: string }>,
    onSuccess?: () => void,
  ) {
    setBusy(true); setError(null);
    const result = await fn();
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      onSuccess?.();
      await load();
    }
  }

  // ── Student actions ──────────────────────────────────────────────────────────

  async function confirmAssignRep() {
    if (!repTarget) return;
    await run(
      () => assignRep(groupId, repTarget.id),
      () => setRepTarget(null),
    );
  }

  async function confirmUnassignRep(student: Student) {
    if (!actionGuard()) return;
    await run(() => unassignRep(groupId, student.id));
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    await run(() => removeStudent(groupId, removeTarget.id), () => setRemoveTarget(null));
  }

  async function confirmResetPwd() {
    if (!resetPwdTarget || newPwd.length < 8) return;
    await run(
      () => resetStudentPassword(resetPwdTarget.id, newPwd),
      () => { setResetPwdTarget(null); setNewPwd(""); setShowPwd(false); },
    );
  }

  // ── Group actions ────────────────────────────────────────────────────────────

  async function confirmArchive() {
    await run(() => archiveGroup(groupId), () => {
      setShowArchive(false);
      router.push("/admin/groups");
    });
  }

  async function confirmResetGrpPwd() {
    if (grpPwd.length < 6) { setError("Password must be at least 6 characters."); return; }
    await run(
      () => resetGroupDefaultPassword(groupId, grpPwd),
      () => { setShowResetGrpPwd(false); setGrpPwd(""); setShowGrpPwd(false); },
    );
  }

  // ── Course actions ───────────────────────────────────────────────────────────

  async function handleAssignLecturerSave() {
    if (!assignLecturerTarget) return;
    await run(
      () => assignLecturer(assignLecturerTarget.id, newLecturerId || null, groupId),
      () => { setAssignLecturerTarget(null); setNewLecturerId(""); },
    );
  }

  async function handleAddCourse() {
    if (!cName.trim()) { setCError("Course name is required."); return; }
    if (!cCode.trim()) { setCError("Course code is required."); return; }
    const credits = parseInt(cCreds);
    if (!credits || credits < 1) { setCError("Credit hours must be at least 1."); return; }
    if (!cSemId)                  { setCError("Select a semester."); return; }

    setBusy(true); setCError(null);
    const result = await createCourse(groupId, {
      semester_id: cSemId,
      name: cName.trim(),
      code: cCode.trim(),
      credit_hours: credits,
      lecturer_id: cLecId || null,
    });
    setBusy(false);
    if ("error" in result) { setCError(result.error); return; }
    setShowAddCourse(false);
    setCName(""); setCCode(""); setCCreds("3"); setCLecId("");
    await load();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-8)" }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "var(--radius-md)" }} />
          <div className="skeleton" style={{ height: 24, width: 200, borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)" }} />
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="card" style={{ padding: "var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div className="skeleton" style={{ height: 13, width: "45%", borderRadius: "var(--radius-sm)" }} />
                <div className="skeleton" style={{ height: 10, width: "30%", borderRadius: "var(--radius-sm)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "var(--space-16)" }}>
        <h2 style={{ marginBottom: "var(--space-4)" }}>Group not found</h2>
        <Link href="/admin/groups" className="btn btn-secondary">Back to Groups</Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <Link href="/admin/groups" className="btn btn-ghost btn-icon" title="Back to groups" style={{ marginTop: 4, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M10 3L4 8l6 5" />
            </svg>
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <h1 className="page-title">{group.group_name}</h1>
              {group.is_archived && (
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 10px",
                  borderRadius: "var(--radius-full)", background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)", color: "var(--color-warning)",
                }}>
                  Archived
                </span>
              )}
              {group.is_current_year && !group.is_archived && (
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 10px",
                  borderRadius: "var(--radius-full)", background: "var(--color-success-bg)",
                  border: "1px solid rgba(34,197,94,0.3)", color: "var(--color-success)",
                }}>
                  Current Year
                </span>
              )}
            </div>
            <p className="page-subtitle">{group.qual_code} · {group.level_name} · {group.year_name}</p>
          </div>
        </div>

        {!group.is_archived && (
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowResetGrpPwd(true)}>
              Reset Group Password
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowArchive(true)}>
              Archive Group
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Info strip */}
      <div className="card" style={{ marginBottom: "var(--space-6)", padding: "var(--space-4) var(--space-6)" }}>
        <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
          {[
            { label: "Students", value: activeStudents.length },
            { label: "Courses",  value: courses.length },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-text)" }}>{value}</div>
            </div>
          ))}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Course Reps</div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px",
                borderRadius: "var(--radius-full)",
                background: atRepCapacity ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                color: atRepCapacity ? "var(--color-success)" : "var(--color-warning)",
                border: `1px solid ${atRepCapacity ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
              }}>
                {repCount}/2
              </span>
            </div>
            {repCount === 0 ? (
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 4, color: "var(--color-text-3)" }}>None assigned</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                {currentReps.map(r => (
                  <div key={r.id} style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-success)" }}>
                    {r.name.split(" ")[0]}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Created</div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-2)", marginTop: 4 }}>{fmtDate(group.created_at)}</div>
          </div>
          {group.archived_at && (
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Archived</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-warning)", marginTop: 4 }}>{fmtDate(group.archived_at)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-2)" }}>
        <Tab active={tab === "students"} onClick={() => setTab("students")}>
          Students ({activeStudents.length})
        </Tab>
        <Tab active={tab === "courses"} onClick={() => setTab("courses")}>
          Courses ({courses.length})
        </Tab>
      </div>

      {/* ── Students tab ── */}
      {tab === "students" && (
        activeStudents.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "var(--space-12)" }}>
            <p style={{ color: "var(--color-text-3)" }}>No active students in this group yet.</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-2)" }}>
              Students are added via the rep portal&apos;s &ldquo;Add Student&rdquo; flow.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Index No.</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <Initials name={s.name} size={32} />
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{s.name}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-2)" }}>
                        {s.index_number}
                      </span>
                    </td>
                    <td>
                      {s.is_course_rep
                        ? <span className="badge badge-success">Course Rep</span>
                        : <span className="badge badge-neutral">Student</span>}
                    </td>
                    <td style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{fmtDate(s.joined_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        {s.is_course_rep ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => confirmUnassignRep(s)} disabled={busy || group.is_archived}>
                            Remove Rep
                          </button>
                        ) : !atRepCapacity ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => { if (actionGuard()) setRepTarget(s); }} disabled={busy || group.is_archived}>
                            Make Rep
                          </button>
                        ) : null}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setResetPwdTarget(s); setNewPwd(""); setShowPwd(false); }} disabled={busy}>
                          Reset Pwd
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { if (actionGuard()) setRemoveTarget(s); }}
                          disabled={busy || group.is_archived}
                          style={{ color: "var(--color-danger)" }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Courses tab ── */}
      {tab === "courses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
            <button className="btn btn-primary btn-sm" onClick={() => { if (actionGuard()) setShowAddCourse(true); }} disabled={group.is_archived}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              Add Course
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "var(--space-12)" }}>
              <p style={{ color: "var(--color-text-3)" }}>No courses yet for this group.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Code</th>
                    <th>Credits</th>
                    <th>Semester</th>
                    <th>Lecturer</th>
                    <th>Sessions</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{c.name}</td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-2)" }}>
                          {c.code}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>{c.credit_hours} cr</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{c.semester_name}</span>
                      </td>
                      <td style={{ fontSize: "var(--text-sm)", color: c.lecturer_name ? "var(--color-text-2)" : "var(--color-text-3)" }}>
                        {c.lecturer_name ?? "Unassigned"}
                      </td>
                      <td style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>{c.session_count}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setAssignLecturerTarget(c); setNewLecturerId(c.lecturer_id ?? ""); }}
                            disabled={group.is_archived}
                          >
                            {c.lecturer_id ? "Change Lecturer" : "Assign Lecturer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Assign rep */}
      {repTarget && (
        <Modal title="Assign Course Rep" onClose={() => setRepTarget(null)}>
          {repCount === 1 && (
            <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
              </svg>
              <span>
                This group already has one rep (<strong>{currentReps[0].name}</strong>).{" "}
                Assigning <strong>{repTarget.name}</strong> will fill the second rep slot — the group will then be at capacity.
              </span>
            </div>
          )}
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-6)", lineHeight: 1.6 }}>
            Assign <strong style={{ color: "var(--color-text)" }}>{repTarget.name}</strong> as a course rep for this group?
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => setRepTarget(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmAssignRep} disabled={busy}>
              {busy ? "Saving…" : "Assign as Rep"}
            </button>
          </div>
        </Modal>
      )}

      {/* Remove student */}
      {removeTarget && (
        <ConfirmModal
          title="Remove Student"
          body={`Remove ${removeTarget.name} (${removeTarget.index_number}) from this group? Their record is kept but marked as removed — they will lose access to this group's courses.`}
          danger
          confirmLabel="Remove Student"
          onConfirm={confirmRemove}
          onClose={() => setRemoveTarget(null)}
          busy={busy}
        />
      )}

      {/* Reset student password */}
      {resetPwdTarget && (
        <Modal title={`Reset Password — ${resetPwdTarget.name}`} onClose={() => { setResetPwdTarget(null); setNewPwd(""); }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Set a new temporary password. The student will be prompted to change it on next login.
          </p>
          <div className="input-group" style={{ marginBottom: "var(--space-5)" }}>
            <label className="label">New Password</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showPwd ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-3)", padding: 2 }}>
                <EyeIcon open={showPwd} />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setResetPwdTarget(null); setNewPwd(""); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmResetPwd} disabled={busy || newPwd.length < 8}>
              {busy ? "Saving…" : "Reset Password"}
            </button>
          </div>
        </Modal>
      )}

      {/* Archive group */}
      {showArchive && (
        <ConfirmModal
          title="Archive Group"
          body="This will make the group read-only. If any active students remain, the operation will be rejected — remove or promote all students first."
          danger
          confirmLabel="Archive Group"
          onConfirm={confirmArchive}
          onClose={() => setShowArchive(false)}
          busy={busy}
        />
      )}

      {/* Reset group default password */}
      {showResetGrpPwd && (
        <Modal title="Reset Default Password" onClose={() => { setShowResetGrpPwd(false); setGrpPwd(""); }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Changes the default password for new students added to this group. Existing student accounts are not affected.
          </p>
          <div className="input-group" style={{ marginBottom: "var(--space-5)" }}>
            <label className="label">New Default Password</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showGrpPwd ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={grpPwd}
                onChange={(e) => setGrpPwd(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowGrpPwd(!showGrpPwd)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-3)", padding: 2 }}>
                <EyeIcon open={showGrpPwd} />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setShowResetGrpPwd(false); setGrpPwd(""); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmResetGrpPwd} disabled={busy || grpPwd.length < 6}>
              {busy ? "Saving…" : "Save New Password"}
            </button>
          </div>
        </Modal>
      )}

      {/* Assign lecturer */}
      {assignLecturerTarget && (
        <Modal
          title={`${assignLecturerTarget.lecturer_id ? "Change" : "Assign"} Lecturer — ${assignLecturerTarget.name}`}
          onClose={() => { setAssignLecturerTarget(null); setNewLecturerId(""); }}
        >
          <div className="input-group" style={{ marginBottom: "var(--space-5)" }}>
            <label className="label">Lecturer</label>
            <select className="input" value={newLecturerId} onChange={(e) => setNewLecturerId(e.target.value)}>
              <option value="">Unassigned</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.staff_id})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setAssignLecturerTarget(null); setNewLecturerId(""); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAssignLecturerSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* Add course */}
      {showAddCourse && (
        <Modal title="Add Course" onClose={() => { setShowAddCourse(false); setCError(null); }}>
          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Semester</label>
            <select className="input" value={cSemId} onChange={(e) => { setCSemId(e.target.value); setCError(null); }}>
              <option value="">Select semester…</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.status === "active" ? " (Active)" : s.status === "archived" ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="input-group">
              <label className="label">Course Name</label>
              <input className="input" placeholder="e.g. Data Structures" value={cName} onChange={(e) => { setCName(e.target.value); setCError(null); }} />
            </div>
            <div className="input-group">
              <label className="label">Course Code</label>
              <input className="input" placeholder="e.g. CS201" value={cCode} onChange={(e) => { setCCode(e.target.value); setCError(null); }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="input-group">
              <label className="label">Credits</label>
              <input className="input" type="number" min="1" max="9" value={cCreds} onChange={(e) => { setCCreds(e.target.value); setCError(null); }} />
            </div>
            <div className="input-group">
              <label className="label">Lecturer (optional)</label>
              <select className="input" value={cLecId} onChange={(e) => setCLecId(e.target.value)}>
                <option value="">Unassigned</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.staff_id})</option>
                ))}
              </select>
            </div>
          </div>

          {cError && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
              </svg>
              {cError}
            </p>
          )}

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setShowAddCourse(false); setCError(null); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddCourse} disabled={busy}>
              {busy ? "Adding…" : "Add Course"}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
