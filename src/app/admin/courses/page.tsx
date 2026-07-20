"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { assignLecturerToCourse } from "./actions";

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
  semester_id: string;
  semester_name: string;
  academic_year_name: string;
  academic_year_id: string;
  session_count: number;
};

type Lecturer = { id: string; name: string; staff_id: string };
type FilterOpt = { id: string; label: string };

// ── Icons ─────────────────────────────────────────────────────────────────────

const IBook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
    <path d="M8 7h8M8 11h8M8 15h5"/>
  </svg>
);

const ISearch = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3"/>
  </svg>
);

const IClose = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13"/>
  </svg>
);

const IChevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4"/>
  </svg>
);

const IUser = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="6" r="4"/><path d="M2 19c0-4.42 3.58-8 8-8s8 3.58 8 8"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function Initials({ name, size = 28 }: { name: string; size?: number }) {
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
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><IClose /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Assign Lecturer Modal ─────────────────────────────────────────────────────

function AssignModal({
  course,
  lecturers,
  onClose,
  onDone,
}: {
  course: Course;
  lecturers: Lecturer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(course.lecturer_id ?? "");
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
    const res = await assignLecturerToCourse(course.id, selected || null);
    setSaving(false);
    if ("error" in res) { setErr(res.error); return; }
    onDone();
    onClose();
  }

  return (
    <Modal title="Assign Lecturer" onClose={onClose}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>
          {course.name} <span style={{ color: "var(--color-text-3)", fontWeight: 400 }}>({course.code})</span>
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
          {course.group_name} · {course.semester_name} · {course.academic_year_name}
        </p>
      </div>

      <div style={{ position: "relative", marginBottom: "var(--space-3)" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)", pointerEvents: "none" }}><ISearch /></span>
        <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search lecturers…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-5)" }}>
        {/* Unassign */}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [courses, setCourses]     = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);

  // Filter option lists
  const [yearOpts, setYearOpts]         = useState<FilterOpt[]>([]);
  const [semOpts, setSemOpts]           = useState<FilterOpt[]>([]);
  const [groupOpts, setGroupOpts]       = useState<FilterOpt[]>([]);
  const [lectOpts, setLectOpts]         = useState<FilterOpt[]>([]);

  // Active filters
  const [fYear, setFYear]     = useState("");
  const [fSem, setFSem]       = useState("");
  const [fGroup, setFGroup]   = useState("");
  const [fLect, setFLect]     = useState("");
  const [search, setSearch]   = useState("");

  const [assignTarget, setAssignTarget] = useState<Course | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const [cRes, lRes, sRes] = await Promise.all([
      (supabase as any).from("courses").select(`
        id, name, code, credit_hours, lecturer_id,
        group_id,
        groups (
          group_name,
          qualification_types ( code ),
          levels ( name ),
          academic_years ( id, name )
        ),
        app_semesters ( id, name ),
        lecturers ( name, staff_id )
      `).order("name"),
      (supabase as any).from("lecturers").select("id, name, staff_id").eq("is_active", true).order("name"),
      (supabase as any).from("class_sessions").select("course_id"),
    ]);

    if (cRes.error) { setErr("Failed to load courses."); setLoading(false); return; }

    const counts: Record<string, number> = {};
    for (const s of sRes.data ?? []) counts[s.course_id] = (counts[s.course_id] ?? 0) + 1;

    const mapped: Course[] = (cRes.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      credit_hours: c.credit_hours,
      lecturer_id: c.lecturer_id,
      lecturer_name: c.lecturers?.name ?? null,
      lecturer_staff_id: c.lecturers?.staff_id ?? null,
      group_id: c.group_id,
      group_name: c.groups?.group_name ?? "—",
      qual_code: c.groups?.qualification_types?.code ?? "",
      level_name: c.groups?.levels?.name ?? "",
      semester_id: c.app_semesters?.id ?? "",
      semester_name: c.app_semesters?.name ?? "—",
      academic_year_name: c.groups?.academic_years?.name ?? "—",
      academic_year_id: c.groups?.academic_years?.id ?? "",
      session_count: counts[c.id] ?? 0,
    }));

    setCourses(mapped);
    setLecturers(lRes.data ?? []);

    // Build unique filter options
    const years = new Map<string, string>();
    const sems  = new Map<string, string>();
    const grps  = new Map<string, string>();
    const lects = new Map<string, string>();

    for (const c of mapped) {
      if (c.academic_year_id) years.set(c.academic_year_id, c.academic_year_name);
      if (c.semester_id)      sems.set(c.semester_id, c.semester_name);
      if (c.group_id)         grps.set(c.group_id, `${c.qual_code} · ${c.level_name} · ${c.group_name}`);
      if (c.lecturer_id && c.lecturer_name) lects.set(c.lecturer_id, c.lecturer_name);
    }

    setYearOpts([...years.entries()].map(([id, label]) => ({ id, label })));
    setSemOpts([...sems.entries()].map(([id, label]) => ({ id, label })));
    setGroupOpts([...grps.entries()].map(([id, label]) => ({ id, label })));
    setLectOpts([...lects.entries()].map(([id, label]) => ({ id, label })));

    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const visible = courses.filter((c) => {
    if (fYear  && c.academic_year_id !== fYear) return false;
    if (fSem   && c.semester_id !== fSem)       return false;
    if (fGroup && c.group_id !== fGroup)         return false;
    if (fLect) {
      if (fLect === "__none__" && c.lecturer_id)       return false;
      if (fLect !== "__none__" && c.lecturer_id !== fLect) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const hasFilters = fYear || fSem || fGroup || fLect || search;
  const clearFilters = () => { setFYear(""); setFSem(""); setFGroup(""); setFLect(""); setSearch(""); };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${visible.length} of ${courses.length} courses`}
          </p>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)", pointerEvents: "none" }}><ISearch /></span>
          <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select className="input" style={{ flex: "1 1 150px", maxWidth: 190 }} value={fYear} onChange={(e) => setFYear(e.target.value)}>
          <option value="">All years</option>
          {yearOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        <select className="input" style={{ flex: "1 1 150px", maxWidth: 190 }} value={fSem} onChange={(e) => setFSem(e.target.value)}>
          <option value="">All semesters</option>
          {semOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        <select className="input" style={{ flex: "1 1 180px", maxWidth: 260 }} value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
          <option value="">All groups</option>
          {groupOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        <select className="input" style={{ flex: "1 1 150px", maxWidth: 200 }} value={fLect} onChange={(e) => setFLect(e.target.value)}>
          <option value="">All lecturers</option>
          <option value="__none__">Unassigned</option>
          {lectOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--color-text-3)" }}>Loading courses…</div>
      ) : err ? (
        <div className="card" style={{ color: "var(--color-danger)", textAlign: "center" }}>{err}</div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--color-text-3)", padding: "var(--space-12)" }}>
          {hasFilters ? "No courses match your filters." : "No courses yet."}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Group</th>
                <th>Semester / Year</th>
                <th>Lecturer</th>
                <th style={{ textAlign: "center" }}>Sessions</th>
                <th style={{ textAlign: "center" }}>Credits</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/admin/courses/${c.id}`)}
                >
                  {/* Course */}
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
                        background: "var(--color-primary-glow)",
                        border: "1px solid rgba(157,10,18,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--color-primary)",
                      }}>
                        <IBook />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-sm)" }}>{c.name}</p>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontFamily: "var(--font-mono)" }}>{c.code}</p>
                      </div>
                    </div>
                  </td>

                  {/* Group */}
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{c.group_name}</p>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{c.qual_code} · {c.level_name}</p>
                  </td>

                  {/* Semester / Year */}
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{c.semester_name}</p>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{c.academic_year_name}</p>
                  </td>

                  {/* Lecturer */}
                  <td style={{ padding: "var(--space-3) var(--space-4)" }} onClick={(e) => e.stopPropagation()}>
                    {c.lecturer_name ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <Initials name={c.lecturer_name} />
                        <div>
                          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>{c.lecturer_name}</p>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>{c.lecturer_staff_id}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="badge badge-warning">Unassigned</span>
                    )}
                  </td>

                  {/* Sessions */}
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-2)" }}>{c.session_count}</span>
                  </td>

                  {/* Credits */}
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    <span className="badge badge-neutral">{c.credit_hours} cr</span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "var(--space-3) var(--space-4)" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", alignItems: "center" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
                        onClick={() => setAssignTarget(c)}
                      >
                        <IUser />{c.lecturer_id ? "Change" : "Assign"}
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => router.push(`/admin/courses/${c.id}`)}
                        title="View detail"
                      >
                        <IChevron />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignTarget && (
        <AssignModal
          course={assignTarget}
          lecturers={lecturers}
          onClose={() => setAssignTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
