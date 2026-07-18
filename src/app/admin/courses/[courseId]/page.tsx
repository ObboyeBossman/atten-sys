import type { Metadata } from "next";
export const metadata: Metadata = { title: "Course Detail" };
export default function Page({ params }: { params: Promise<Record<string, string>> }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Course Detail</h1>
          <p className="page-subtitle">Course info and lecturer assignment</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
