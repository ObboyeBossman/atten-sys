import type { Metadata } from "next";
export const metadata: Metadata = { title: "Levels" };
export default function Page() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Levels</h1>
          <p className="page-subtitle">Manage levels per qualification type</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
