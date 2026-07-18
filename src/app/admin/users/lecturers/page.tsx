import type { Metadata } from "next";
export const metadata: Metadata = { title: "Lecturers" };
export default function Page() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lecturers</h1>
          <p className="page-subtitle">Lecturer accounts — create, edit, deactivate</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
