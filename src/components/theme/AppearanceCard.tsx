"use client";

import { useTheme, ThemePreference } from "./ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System",
    desc: "Follows your device setting automatically",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    desc: "Always use the light theme",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    desc: "Always use the dark theme",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
];

export function AppearanceCard() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "var(--space-5) var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-lg)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-3)",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="4" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              Appearance
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 1 }}>
              Choose how ATTEN-SYS looks for you
            </div>
          </div>
        </div>
      </div>

      {/* Options */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-3)",
          padding: "var(--space-5)",
        }}
      >
        {OPTIONS.map(({ value, label, desc, icon }) => {
          const isActive = preference === value;
          return (
            <button
              key={value}
              onClick={() => setPreference(value)}
              aria-pressed={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-4) var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: isActive
                  ? "2px solid var(--color-primary)"
                  : "2px solid var(--color-border)",
                background: isActive
                  ? "var(--color-primary-glow)"
                  : "var(--color-surface-2)",
                color: isActive ? "var(--color-primary)" : "var(--color-text-3)",
                cursor: "pointer",
                transition: "all var(--transition-base)",
                textAlign: "center",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-hover)";
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-3)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-2)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-3)";
                }
              }}
            >
              {/* Check mark badge */}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 18,
                    height: 18,
                    borderRadius: "var(--radius-full)",
                    background: "var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-hidden="true"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </span>
              )}

              {/* Icon */}
              <span>{icon}</span>

              {/* Label */}
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  color: isActive ? "var(--color-primary)" : "var(--color-text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {label}
              </span>

              {/* Description */}
              <span
                style={{
                  fontSize: "10px",
                  color: isActive ? "var(--color-primary)" : "var(--color-text-3)",
                  lineHeight: 1.4,
                  opacity: isActive ? 0.85 : 1,
                }}
              >
                {desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Responsive: stack to 1 col on very small screens */}
      <style>{`
        @media (max-width: 400px) {
          .appearance-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
