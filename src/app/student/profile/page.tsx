import type { Metadata } from "next";
export const metadata: Metadata = { title: "Profile" };
export default function Page() {
  return (
    <div>
      <div className="page-header"><div>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your student profile</p>
      </div></div>
      <div className="card"><p style={{ color: "var(--color-text-3)" }}>This page is being built.</p></div>
    </div>
  );
}
