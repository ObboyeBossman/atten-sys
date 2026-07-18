import type { Metadata } from "next";
export const metadata: Metadata = { title: "Disputes" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Disputes</h1>
        <p className="page-subtitle">Pending attendance disputes for your courses</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
