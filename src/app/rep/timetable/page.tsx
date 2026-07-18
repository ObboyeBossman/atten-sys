import type { Metadata } from "next";
export const metadata: Metadata = { title: "Timetable" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Timetable</h1>
        <p className="page-subtitle">Weekly timetable for your group</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
