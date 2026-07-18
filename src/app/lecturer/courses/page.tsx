import type { Metadata } from "next";
export const metadata: Metadata = { title: "My Courses" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">My Courses</h1>
        <p className="page-subtitle">Courses assigned to you this semester</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
