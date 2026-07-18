import type { Metadata } from "next";
export const metadata: Metadata = { title: "Group Detail" };
export default function Page({ params }: { params: Promise<Record<string, string>> }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Group Detail</h1>
          <p className="page-subtitle">Students and courses in this group</p>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--color-text-3)" }}>This page is being built.</p>
      </div>
    </div>
  );
}
