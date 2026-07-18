import type { Metadata } from "next";
export const metadata: Metadata = { title: "Add Student" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Add Student</h1>
        <p className="page-subtitle">Add a student by serial number</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
