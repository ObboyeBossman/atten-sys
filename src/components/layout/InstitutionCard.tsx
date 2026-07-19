// Shared card + detail panel components for all institution pages
// Card: inspired by the job-listing / referral card designs
// Detail: right drawer on desktop, bottom sheet on mobile

"use client";

import { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardAccent = "blue" | "red" | "green" | "amber" | "purple";

const ACCENT_TOKENS: Record<CardAccent, { bg: string; border: string; text: string; glow: string }> = {
  blue:   { bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.25)",  text: "#3b82f6", glow: "rgba(59,130,246,0.15)"  },
  red:    { bg: "rgba(157,10,18,0.10)",   border: "rgba(157,10,18,0.25)",   text: "#9d0a12", glow: "rgba(157,10,18,0.15)"   },
  green:  { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)",   text: "#22c55e", glow: "rgba(34,197,94,0.15)"   },
  amber:  { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)",  text: "#f59e0b", glow: "rgba(245,158,11,0.15)"  },
  purple: { bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.25)",  text: "#a855f7", glow: "rgba(168,85,247,0.15)"  },
};

// ── Institution Card ──────────────────────────────────────────────────────────

export function InstitutionCard({
  accent = "blue",
  icon,
  title,
  meta,
  badge,
  badgeVariant = "neutral",
  tags,
  footer,
  onClick,
  actions,
}: {
  accent?: CardAccent;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  badge?: string;
  badgeVariant?: "neutral" | "success" | "info" | "warning" | "danger";
  tags?: { label: string; mono?: boolean }[];
  footer?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
}) {
  const tok = ACCENT_TOKENS[accent];
  const badgeColors: Record<string, { bg: string; color: string }> = {
    neutral: { bg: "var(--color-surface-3)",  color: "var(--color-text-2)"  },
    success: { bg: "rgba(34,197,94,0.12)",    color: "var(--color-success)" },
    info:    { bg: "rgba(6,182,212,0.12)",    color: "var(--color-info)"    },
    warning: { bg: "rgba(245,158,11,0.12)",   color: "var(--color-warning)" },
    danger:  { bg: "rgba(239,68,68,0.12)",    color: "var(--color-danger)"  },
  };
  const bc = badgeColors[badgeVariant];

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 200ms ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        (e.currentTarget as HTMLElement).style.borderColor = tok.border;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${tok.glow}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Top accent stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${tok.text}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        {/* Icon bubble */}
        <div style={{
          width: 44, height: 44, borderRadius: "var(--radius-lg)", flexShrink: 0,
          background: tok.bg, border: `1px solid ${tok.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: tok.text,
        }}>
          {icon}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            fontWeight: 700, fontSize: "var(--text-sm)", lineHeight: 1.3,
            color: "var(--color-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title}
          </div>
          {meta && (
            <div style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 3, lineHeight: 1.4 }}>
              {meta}
            </div>
          )}
        </div>

        {/* Badge top-right */}
        {badge && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: bc.bg,
            border: `1px solid ${bc.color}30`,
            fontSize: 11, fontWeight: 600, color: bc.color,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {badge}
          </div>
        )}
      </div>

      {/* Tags row */}
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              fontSize: 11, fontWeight: 500,
              color: "var(--color-text-2)",
              fontFamily: t.mono ? "var(--font-mono)" : undefined,
              letterSpacing: t.mono ? "0.04em" : undefined,
            }}>
              {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      {(footer || actions) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--color-border)",
          marginTop: "auto",
        }}>
          {footer && (
            <span style={{ fontSize: 10, color: "var(--color-text-3)" }}>{footer}</span>
          )}
          {actions && (
            <div
              style={{ display: "flex", gap: 4, marginLeft: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Drawer / Bottom Sheet ──────────────────────────────────────────────

export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  accent = "blue",
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: CardAccent;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tok = ACCENT_TOKENS[accent];
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(3px)",
          zIndex: 1100,
          animation: "fadeIn 200ms ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          zIndex: 1101,
          top: 0, right: 0, bottom: 0,
          width: "min(480px, 92vw)",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 250ms cubic-bezier(0.32,0.72,0,1)",
          overflowY: "auto",
        }}
        className="inst-detail-panel"
      >
        {/* Accent stripe */}
        <div style={{
          height: 4, flexShrink: 0,
          background: `linear-gradient(90deg, ${tok.text}, transparent)`,
        }} />

        {/* Panel header */}
        <div style={{
          padding: "var(--space-6) var(--space-6) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
            {icon && (
              <div style={{
                width: 48, height: 48, borderRadius: "var(--radius-lg)", flexShrink: 0,
                background: tok.bg, border: `1px solid ${tok.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: tok.text,
              }}>
                {icon}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>{title}</h2>
              {subtitle && <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>{subtitle}</p>}
            </div>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onClose}
              aria-label="Close"
              style={{ flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, padding: "var(--space-6)", overflowY: "auto" }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @media (max-width: 640px) {
          .inst-detail-panel {
            top: auto !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-height: 85dvh !important;
            border-left: none !important;
            border-top: 1px solid var(--color-border) !important;
            border-radius: var(--radius-2xl) var(--radius-2xl) 0 0 !important;
            box-shadow: 0 -8px 32px rgba(0,0,0,0.4) !important;
            animation: slideInUp 280ms cubic-bezier(0.32,0.72,0,1) !important;
          }
        }

        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Detail Row ────────────────────────────────────────────────────────────────

export function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      gap: "var(--space-4)",
      padding: "var(--space-3) 0",
      borderBottom: "1px solid var(--color-border)",
    }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: "var(--text-sm)", color: "var(--color-text-2)", textAlign: "right",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        fontWeight: mono ? 600 : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Detail Section ────────────────────────────────────────────────────────────

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "var(--color-text-3)",
        textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: "var(--space-2)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}
