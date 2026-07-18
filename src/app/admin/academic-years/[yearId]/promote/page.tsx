import type { Metadata } from "next";
export const metadata: Metadata = { title: "Year-End Promotion" };
export default function Page({ params }: { params: Promise<Record<string, string>> }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Year-End Promotion</h1>
          <p className="page-subtitle">Promote all students to the next academic year</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
