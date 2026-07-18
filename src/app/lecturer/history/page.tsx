import type { Metadata } from "next";
export const metadata: Metadata = { title: "Past Courses" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Past Courses</h1>
        <p className="page-subtitle">Courses you have previously taught</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
