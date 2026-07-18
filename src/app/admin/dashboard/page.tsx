import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">System overview and live monitoring</p>
        </div>
      </div>

      {/* System health cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        {[
          { label: "Active Semester", value: "—", accent: "var(--color-primary)", sub: "Loading…" },
          { label: "Active Students", value: "—", accent: "var(--color-success)", sub: "Loading…" },
          { label: "Active Lecturers", value: "—", accent: "var(--color-info)", sub: "Loading…" },
          { label: "Sessions Today", value: "—", accent: "var(--color-warning)", sub: "Loading…" },
          { label: "Pending Disputes", value: "—", accent: "var(--color-danger)", sub: "System-wide" },
        ].map((stat) => (
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

      {/* Live sessions + recent audit */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "var(--space-6)",
        }}
      >
        <div className="card">
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Live Sessions
          </h2>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
            No live sessions right now.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Recent Audit Events
          </h2>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
            Loading audit events…
          </p>
        </div>
      </div>
    </div>
  );
}
