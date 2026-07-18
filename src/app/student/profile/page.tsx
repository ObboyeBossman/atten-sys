import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Student Profile" };

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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal information.</p>
        </div>
      </div>
      
      <div className="card">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-2)] mb-1">Full Name</label>
            <div className="text-lg font-medium">{student?.name}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-2)] mb-1">Index Number</label>
            <div className="text-lg font-medium">{student?.index_number}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-2)] mb-1">Email Address</label>
            <div className="text-lg font-medium">{user.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-2)] mb-1">Phone Number</label>
            <div className="text-lg font-medium">{profile?.phone || "Not provided"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
