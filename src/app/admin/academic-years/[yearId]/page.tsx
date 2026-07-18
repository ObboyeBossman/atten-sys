import type { Metadata } from "next";
export const metadata: Metadata = { title: "Academic Year Detail" };
export default function Page({ params }: { params: Promise<Record<string, string>> }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Year Detail</h1>
          <p className="page-subtitle">Semesters and groups for this year</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
