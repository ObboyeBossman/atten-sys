import type { Metadata } from "next";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Your system notifications</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
