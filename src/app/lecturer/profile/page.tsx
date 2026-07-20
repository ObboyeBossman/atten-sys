import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = { title: "Profile" };

async function getData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lecturer } = await supabase
    .from("lecturers")
    .select("name, staff_id, phone")
    .eq("id", user.id)
    .maybeSingle();

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
    </div>
  );
}
