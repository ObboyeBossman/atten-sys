import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { r2PublicUrl } from "@/lib/r2";
import { EditPhoneField } from "@/components/student/EditPhoneField";
import { AvatarUpload } from "@/components/student/AvatarUpload";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = { title: "My Profile" };

export default async function StudentProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("phone")
    .eq("id", user.id)
    .single();

  const profile = profileData as any;

  const { data: studentData } = await supabase
    .from("students")
    .select("name, index_number, photo_path")
    .eq("id", user.id)
    .single();

  const student = studentData as any;

  const photoUrl = student?.photo_path ? r2PublicUrl(student.photo_path) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal information.</p>
        </div>
      </div>

      {/* ── Avatar ── */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-4)",
        }}>
          Profile Photo
        </h2>
        <AvatarUpload
          currentPhotoUrl={photoUrl}
          studentName={student?.name ?? "Student"}
        />
      </div>

      {/* ── Read-only identity ── */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-4)",
        }}>
          Identity
        </h2>

        <div className="space-y-4">
          {/* Name — read-only */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "var(--space-3)",
            gap: "var(--space-4)",
          }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", flexShrink: 0 }}>Full Name</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontWeight: 600, textAlign: "right" }}>{student?.name}</span>
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-3)",
                padding: "2px 6px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}>locked</span>
            </div>
          </div>

          {/* Index number — read-only */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "var(--space-3)",
            gap: "var(--space-4)",
          }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", flexShrink: 0 }}>Index Number</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{student?.index_number}</span>
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-3)",
                padding: "2px 6px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}>locked</span>
            </div>
          </div>

          {/* Email — read-only */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-4)",
          }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", flexShrink: 0 }}>Email</span>
            <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{user.email}</span>
          </div>
        </div>
      </div>

      {/* ── Editable contact ── */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-4)",
        }}>
          Contact
        </h2>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-4)",
        }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", flexShrink: 0, paddingTop: "var(--space-1)" }}>
            Phone Number
          </span>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <EditPhoneField initialPhone={profile?.phone ?? null} />
          </div>
        </div>
      </div>

      {/* ── Change password ── */}
      <div className="card">
        <h2 style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-3)",
          marginBottom: "var(--space-4)",
        }}>
          Password
        </h2>
        <ChangePasswordForm portalPrefix="/student" />
      </div>
    </div>
  );
}
