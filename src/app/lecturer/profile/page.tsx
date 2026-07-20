import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = { title: "Profile" };
export const revalidate = 0;

async function getData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: lecturer } = await supabase
    .from("lecturers")
    .select("name, staff_id, phone, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!lecturer) return null;

  const l = lecturer as {
    name: string;
    staff_id: string;
    phone: string | null;
    created_at: string;
  };

  return {
    name: l.name,
    email: user.email ?? "",
    staffId: l.staff_id,
    phone: l.phone,
    createdAt: l.created_at,
  };
}

export default async function LecturerProfilePage() {
  const data = await getData();
  if (!data) redirect("/login");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">
            Manage your account information and security
          </p>
        </div>
      </div>

      <ProfileClient
        name={data.name}
        email={data.email}
        staffId={data.staffId}
        phone={data.phone}
        createdAt={data.createdAt}
      />
    </div>
  );
}
