"use client";

interface Stat {
  label: string;
  value: string;
  accent: string;
  sub: string;
}

export function DashboardStats({ stats }: { stats: Stat[] }) {
  return (
    <>
      {/* ── Scrollable strip (mobile / tablet ≤1024px) ─────── */}
      <div className="stats-scroll-wrap">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card stats-scroll-card"
            style={{ "--accent": stat.accent } as React.CSSProperties}
          >
            <span className="stat-card-label">{stat.label}</span>
            <span className="stat-card-value">{stat.value}</span>
            <span className="stat-card-sub">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Wrapping grid (desktop >1024px) ─────────────────── */}
      <div className="stats-grid-wrap">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card"
            style={{ "--accent": stat.accent } as React.CSSProperties}
          >
            <span className="stat-card-label">{stat.label}</span>
            <span className="stat-card-value">{stat.value}</span>
            <span className="stat-card-sub">{stat.sub}</span>
          </div>
        ))}
      </div>
    </>
  );
}
