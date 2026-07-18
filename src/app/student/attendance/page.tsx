import type { Metadata } from "next";
export const metadata: Metadata = { title: "Attendance History" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Attendance History</h1>
        <p className="page-subtitle">All your attendance records</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
