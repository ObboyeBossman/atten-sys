import type { Metadata } from "next";
export const metadata: Metadata = { title: "Academic Years" };
export default function Page() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Years</h1>
          <p className="page-subtitle">Manage academic years and set the current year</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
