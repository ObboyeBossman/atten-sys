import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = { title: "Profile" };
export const revalidate = 0;

async function getProfileData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const p = profile as { role: string; is_active: boolean } | null;
  if (!p || p.role !== "super_admin" || !p.is_active) return null;

  const { data: adminData } = await supabase
    .from("super_admins")
    .select("name, created_at")
    .eq("id", user.id)
    .single();

  const a = adminData as { name: string; created_at: string } | null;
  if (!a) return null;

  return {
    name: a.name,
    email: user.email ?? "",
    createdAt: a.created_at,
  };
}

export default async function ProfilePage() {
  const data = await getProfileData();
  if (!data) redirect("/login");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account information and security</p>
        </div>
      </div>

      <ProfileClient
        name={data.name}
        email={data.email}
        createdAt={data.createdAt}
      />
    </div>
  );
}
