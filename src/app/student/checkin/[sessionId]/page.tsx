import type { Metadata } from "next";
export const metadata: Metadata = { title: "Check In" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Check In</h1></div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
