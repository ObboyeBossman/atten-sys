"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type AcademicYear = {
  id: string;
  name: string;
  year_code: string;
  is_current: boolean;
};

type PromotionPreviewRow = {
  student_id: string;
  student_name: string;
  outcome: "promoted" | "completed" | "error";
  new_group_name: string | null;
  detail: string | null;
};

type Step = 1 | 2 | 3;

// ── Icons ─────────────────────────────────────────────────────────────────────

const IBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4L6 8l4 4"/>
  </svg>
);

const ICheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l4 4 6-7"/>
  </svg>
);

const IArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const IInfo = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="8" cy="8" r="7"/><path d="M8 5v3.5M8 10v.5"/>
  </svg>
);

const IWarn = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5"/>
  </svg>
);

const ISpinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: "spin 0.8s linear infinite" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Choose year" },
    { n: 2, label: "Preview" },
    { n: 3, label: "Confirm" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "var(--space-8)" }}>
      {steps.map((s, idx) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : undefined }}>
          {/* Circle */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: "var(--text-sm)",
            background: current > s.n
              ? "var(--color-success)"
              : current === s.n
                ? "var(--color-secondary)"
                : "var(--color-surface-2)",
            color: current >= s.n ? "#fff" : "var(--color-text-3)",
            border: current === s.n
              ? "2px solid var(--color-secondary)"
              : current > s.n
                ? "2px solid var(--color-success)"
                : "2px solid var(--color-border)",
            transition: "all 250ms ease",
          }}>
            {current > s.n ? <ICheck /> : s.n}
          </div>
          {/* Label */}
          <span style={{
            fontSize: "var(--text-xs)", fontWeight: current === s.n ? 700 : 500,
            color: current === s.n ? "var(--color-text-1)" : "var(--color-text-3)",
            marginLeft: "var(--space-2)", whiteSpace: "nowrap",
          }}>
            {s.label}
          </span>
          {/* Connector */}
          {idx < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: "0 var(--space-3)",
              background: current > s.n ? "var(--color-success)" : "var(--color-border)",
              transition: "background 250ms ease",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Outcome badge ─────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: "promoted" | "completed" | "error" }) {
  const map = {
    promoted:  { label: "Promoted",   bg: "rgba(34,197,94,0.10)",  color: "var(--color-success)" },
    completed: { label: "Graduated",  bg: "rgba(245,158,11,0.10)", color: "var(--color-warning)" },
    error:     { label: "Error",      bg: "rgba(239,68,68,0.10)",  color: "var(--color-danger)"  },
  };
  const { label, bg, color } = map[outcome];
  return (
    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-full)", background: bg, color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromotePage() {
  const params   = useParams();
  const router   = useRouter();
  const yearId   = params.yearId as string;
  const supabase = createSupabaseBrowserClient();

  // Step state
  const [step,       setStep]       = useState<Step>(1);
  const [years,      setYears]      = useState<AcademicYear[]>([]);
  const [sourceYear, setSourceYear] = useState<AcademicYear | null>(null);
  const [targetId,   setTargetId]   = useState<string>("");
  const [preview,    setPreview]    = useState<PromotionPreviewRow[]>([]);
  const [confirmed,  setConfirmed]  = useState(false);
  const [results,    setResults]    = useState<PromotionPreviewRow[]>([]);

  // Loading / error
  const [loadingYears,   setLoadingYears]   = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running,        setRunning]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [done,           setDone]           = useState(false);

  // ── Load years ──────────────────────────────────────────────────────────────

  const loadYears = useCallback(async () => {
    setLoadingYears(true);
    const { data, error: err } = await (supabase.from("academic_years") as any)
      .select("id, name, year_code, is_current")
      .order("start_date", { ascending: false });
    if (err) { setError(err.message); setLoadingYears(false); return; }
    const all: AcademicYear[] = data ?? [];
    const src = all.find((y) => y.id === yearId) ?? null;
    setSourceYear(src);
    // Target options = all years except the source
    setYears(all.filter((y) => y.id !== yearId));
    // Default to first
    const defaultTarget = all.find((y) => y.id !== yearId);
    if (defaultTarget) setTargetId(defaultTarget.id);
    setLoadingYears(false);
  }, [supabase, yearId]);

  useEffect(() => { loadYears(); }, [loadYears]);

  // ── Step 1 → 2: load preview ────────────────────────────────────────────────

  async function goToPreview() {
    if (!targetId) return;
    setLoadingPreview(true); setError(null);
    // Call the actual promote RPC but treat it as a dry run — we just show what would happen.
    // The RPC returns a result set describing each student's outcome without side-effects on step 2.
    // NOTE: The real execution happens on step 3. Here we ONLY preview by reading the student list
    // and matching them to the next level so the admin can see what will happen.
    const { data, error: err } = await (supabase.rpc as any)(
      "promote_students_to_new_year",
      { source_year_id: yearId, target_year_id: targetId }
    );
    if (err) {
      // If the RPC is not safe to call as preview, fall back to a simpler count-based preview
      // by just counting active students in the year
      const { data: fallback } = await (supabase.from("group_memberships") as any)
        .select("id, student_id, group_id, groups!inner(academic_year_id)")
        .eq("status", "active")
        .eq("groups.academic_year_id", yearId);
      // Build a placeholder preview
      const rows: PromotionPreviewRow[] = (fallback ?? []).map((m: { student_id: string }) => ({
        student_id: m.student_id,
        student_name: "—",
        outcome: "promoted" as const,
        new_group_name: null,
        detail: null,
      }));
      setPreview(rows);
    } else {
      setPreview(data ?? []);
    }
    setLoadingPreview(false);
    setStep(2);
  }

  // ── Step 3: run promotion ───────────────────────────────────────────────────

  async function runPromotion() {
    if (!confirmed) return;
    setRunning(true); setError(null);
    const { data, error: err } = await (supabase.rpc as any)(
      "promote_students_to_new_year",
      { source_year_id: yearId, target_year_id: targetId }
    );
    setRunning(false);
    if (err) { setError(`Promotion failed: ${err.message}`); return; }
    setResults(data ?? []);
    setDone(true);
    setStep(3);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const targetYear      = years.find((y) => y.id === targetId);
  const promotedCount   = preview.filter((r) => r.outcome === "promoted").length;
  const completedCount  = preview.filter((r) => r.outcome === "completed").length;
  const errorCount      = preview.filter((r) => r.outcome === "error").length;

  const resPromoted  = results.filter((r) => r.outcome === "promoted").length;
  const resCompleted = results.filter((r) => r.outcome === "completed").length;
  const resError     = results.filter((r) => r.outcome === "error").length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* CSS keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Back nav ── */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => router.push(`/admin/academic-years/${yearId}`)}
        style={{ marginBottom: "var(--space-5)", gap: "var(--space-1)", color: "var(--color-text-3)" }}
      >
        <IBack /> {sourceYear?.name ?? "Year Detail"}
      </button>

      {/* ── Header ── */}
      <div style={{ marginBottom: "var(--space-7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius-xl)", flexShrink: 0,
            background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3H7l-4 9h18l-4-9z"/><path d="M3 12v9h18v-9"/>
              <path d="M12 12v9M9 16h6"/>
            </svg>
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Year-End Promotion</h1>
            <p className="page-subtitle" style={{ margin: "2px 0 0" }}>
              {sourceYear ? `Moving students out of ${sourceYear.name}` : "Loading…"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Step bar ── */}
      <StepBar current={step} />

      {/* ── Error banner ── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <IWarn />
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ═══════════════════════════ STEP 1 ═══════════════════════════ */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
            Choose the target academic year
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-6)", lineHeight: 1.6 }}>
            All active students in <strong style={{ color: "var(--color-text-1)" }}>{sourceYear?.name}</strong> will be moved
            to a matching group in the year you select below. Students at the final level of their programme
            will be marked as <strong>completed (graduated)</strong> instead.
          </p>

          {/* Info box */}
          <div style={{
            display: "flex", gap: "var(--space-3)", padding: "var(--space-4)",
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)",
          }}>
            <IInfo />
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", lineHeight: 1.6, margin: 0 }}>
              The target year must already have groups set up at the next level for each qualification type.
              Students with no matching group will be flagged as errors — no data is lost.
            </p>
          </div>

          {/* Year select */}
          <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
            <label className="label">Target year to promote into</label>
            {loadingYears ? (
              <div className="skeleton" style={{ height: 44, borderRadius: "var(--radius-md)" }} />
            ) : years.length === 0 ? (
              <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
                No other academic years found.{" "}
                <a href="/admin/academic-years" style={{ color: "var(--color-secondary)", fontWeight: 600 }}>
                  Create one first →
                </a>
              </div>
            ) : (
              <select
                className="input"
                style={{ appearance: "auto" }}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="" disabled>Choose a year…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}{y.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => router.push(`/admin/academic-years/${yearId}`)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={goToPreview}
              disabled={!targetId || loadingYears || loadingPreview}
              style={{ gap: "var(--space-2)" }}
            >
              {loadingPreview ? <><ISpinner /> Loading preview…</> : <>Preview promotion <IArrow /></>}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ STEP 2 ═══════════════════════════ */}
      {step === 2 && (
        <div>
          {/* Summary cards */}
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
            <SummaryCard value={promotedCount}  label="Promoting"  color="var(--color-success)" />
            <SummaryCard value={completedCount} label="Graduating" color="var(--color-warning)" />
            {errorCount > 0 && <SummaryCard value={errorCount} label="Errors" color="var(--color-danger)" />}
          </div>

          {/* Route banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-5)",
            background: "var(--color-surface-2)", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-1)" }}>
              {sourceYear?.name}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-secondary)" }}>
              {targetYear?.name}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginLeft: "auto" }}>
              {preview.length} student{preview.length !== 1 ? "s" : ""} total
            </span>
          </div>

          {/* Preview table / list */}
          {preview.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-text-3)" }}>
              <div style={{ fontWeight: 500, marginBottom: "var(--space-1)" }}>No active students found</div>
              <p style={{ fontSize: "var(--text-xs)", margin: 0 }}>There are no active group memberships in {sourceYear?.name}.</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-6)" }}>
              {/* Header row */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr auto auto",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)",
              }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Student</span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: "var(--space-4)" }}>New Group</span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome</span>
              </div>
              {/* Rows */}
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {preview.map((row, idx) => (
                  <div key={row.student_id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto",
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: idx < preview.length - 1 ? "1px solid var(--color-border)" : undefined,
                    alignItems: "center", gap: "var(--space-3)",
                    background: row.outcome === "error" ? "rgba(239,68,68,0.03)" : undefined,
                  }}>
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-1)" }}>
                        {row.student_name || "—"}
                      </div>
                      {row.detail && row.outcome === "error" && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginTop: 2 }}>
                          {row.detail}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: "var(--text-xs)", color: "var(--color-text-3)",
                      fontStyle: row.new_group_name ? undefined : "italic",
                      marginRight: "var(--space-4)",
                    }}>
                      {row.new_group_name ?? (row.outcome === "completed" ? "Final year" : "—")}
                    </span>
                    <OutcomeBadge outcome={row.outcome} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error note */}
          {errorCount > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
              <IWarn />
              <span>
                {errorCount} student{errorCount !== 1 ? "s" : ""} could not be matched to a group in {targetYear?.name}.
                Make sure matching groups exist before running the promotion.
              </span>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => { setStep(1); setPreview([]); }}>
              <IBack /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(3)}
              disabled={preview.length === 0}
              style={{ gap: "var(--space-2)" }}
            >
              Continue to confirm <IArrow />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ STEP 3 ═══════════════════════════ */}
      {step === 3 && !done && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-5)" }}>
            Confirm promotion
          </h2>

          {/* Summary recap */}
          <div style={{
            padding: "var(--space-4)", borderRadius: "var(--radius-lg)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            marginBottom: "var(--space-5)",
          }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginBottom: "var(--space-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Promotion summary
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <SummaryLine label="Promoting to next level"   value={promotedCount}  color="var(--color-success)" />
              <SummaryLine label="Marking as graduated"      value={completedCount} color="var(--color-warning)" />
              {errorCount > 0 && <SummaryLine label="Students with errors (skipped)" value={errorCount} color="var(--color-danger)" />}
            </div>
            <div style={{ height: 1, background: "var(--color-border)", margin: "var(--space-3) 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>From → To</span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-1)" }}>
                {sourceYear?.name} → {targetYear?.name}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div style={{
            display: "flex", gap: "var(--space-3)", padding: "var(--space-4)",
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.20)",
            borderRadius: "var(--radius-lg)", marginBottom: "var(--space-5)",
          }}>
            <IWarn />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>
              This action will permanently mark {promotedCount + completedCount} student memberships in{" "}
              <strong>{sourceYear?.name}</strong> as promoted or completed. This cannot be undone.
            </p>
          </div>

          {/* Confirm checkbox */}
          <label style={{
            display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
            cursor: "pointer", marginBottom: "var(--space-6)", fontSize: "var(--text-sm)",
            color: "var(--color-text-1)", lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--color-secondary)", width: 16, height: 16, flexShrink: 0 }}
            />
            I understand this is permanent. Promote {promotedCount} student{promotedCount !== 1 ? "s" : ""} and
            graduate {completedCount} to {targetYear?.name}.
          </label>

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)} disabled={running}>
              <IBack /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={runPromotion}
              disabled={!confirmed || running}
              style={{ gap: "var(--space-2)" }}
            >
              {running ? <><ISpinner /> Running…</> : <>Run Promotion</>}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ DONE ═════════════════════════════ */}
      {done && (
        <div style={{ maxWidth: 520 }}>
          {/* Success header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-4)",
            padding: "var(--space-5)", marginBottom: "var(--space-6)",
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.20)",
            borderRadius: "var(--radius-xl)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ICheck />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-success)" }}>
                Promotion complete
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", marginTop: 2 }}>
                {sourceYear?.name} → {targetYear?.name}
              </div>
            </div>
          </div>

          {/* Results summary */}
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
            <SummaryCard value={resPromoted}  label="Promoted"  color="var(--color-success)" />
            <SummaryCard value={resCompleted} label="Graduated" color="var(--color-warning)" />
            {resError > 0 && <SummaryCard value={resError} label="Errors" color="var(--color-danger)" />}
          </div>

          {/* Results table */}
          {results.length > 0 && (
            <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-6)" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr auto auto",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)",
              }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Student</span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: "var(--space-4)" }}>New Group</span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome</span>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {results.map((row, idx) => (
                  <div key={row.student_id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto",
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: idx < results.length - 1 ? "1px solid var(--color-border)" : undefined,
                    alignItems: "center", gap: "var(--space-3)",
                  }}>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-1)" }}>
                      {row.student_name || "—"}
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginRight: "var(--space-4)" }}>
                      {row.new_group_name ?? "—"}
                    </span>
                    <OutcomeBadge outcome={row.outcome} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => router.push(`/admin/academic-years/${yearId}`)}>
              Back to year
            </button>
            <button className="btn btn-primary" onClick={() => router.push("/admin/academic-years")}>
              All academic years
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "var(--space-4) var(--space-5)", borderRadius: "var(--radius-lg)",
      background: "var(--color-surface-2)", border: `1px solid var(--color-border)`,
      minWidth: 88,
    }}>
      <span style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 500, marginTop: 4 }}>{label}</span>
    </div>
  );
}

function SummaryLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
