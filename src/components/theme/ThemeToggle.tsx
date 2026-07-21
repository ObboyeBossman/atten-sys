"use client";

import { useTheme, ThemePreference } from "./ThemeProvider";

const LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const CYCLE: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.5 12A7.5 7.5 0 018 2.5a7.5 7.5 0 100 15 7.5 7.5 0 009.5-5.5z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="16" height="11" rx="2" />
      <path d="M7 17h6M10 14v3" />
    </svg>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") return <SunIcon />;
  if (preference === "dark") return <MoonIcon />;
  return <SystemIcon />;
}

interface ThemeToggleProps {
  /** "full" shows icon + label; "icon" shows only icon */
  variant?: "full" | "icon";
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeToggle({
  variant = "full",
  className,
  style,
}: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  function handleClick() {
    setPreference(CYCLE[preference]);
  }

  return (
    <button
      onClick={handleClick}
      title={`Theme: ${LABELS[preference]}. Click to switch.`}
      aria-label={`Current theme: ${LABELS[preference]}. Click to switch.`}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: variant === "icon" ? "6px" : "6px 10px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-2)",
        color: "var(--color-text-2)",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        cursor: "pointer",
        transition:
          "background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)",
        whiteSpace: "nowrap",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--color-surface-3)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--color-text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--color-surface-2)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--color-text-2)";
      }}
    >
      <ThemeIcon preference={preference} />
      {variant === "full" && <span>{LABELS[preference]}</span>}
    </button>
  );
}
