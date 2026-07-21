import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";
import { AppearanceCard } from "@/components/theme/AppearanceCard";

export const metadata: Metadata = { title: "Profile" };

async function getData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

   
  const { data: lecturerRaw } = await (supabase as any)
    .from("lecturers")
    .select("name, staff_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const lecturer = lecturerRaw as { name: string; staff_id: string; phone: string | null } | null;
  if (!lecturer) redirect("/login");

  return {
    name: lecturer.name,
    staffId: lecturer.staff_id,
    phone: lecturer.phone,
    email: user.email ?? "",
  };
}

export default async function ProfilePage() {
  const { name, staffId, phone, email } = await getData();

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account and security settings</p>
        </div>
      </div>

      <ProfileClient
        name={name}
        email={email}
        staffId={staffId}
        phone={phone}
      />

      <div style={{ marginTop: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "var(--space-3)",
          }}
        >
          Appearance
        </h2>
        <AppearanceCard />
      </div>
    </div>
  );
}
