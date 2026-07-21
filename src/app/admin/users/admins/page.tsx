import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminsClient, type AdminRow } from "./AdminsClient";

export const metadata: Metadata = { title: "Super Admins" };
export const revalidate = 0;

async function getAdminsData(): Promise<{ admins: AdminRow[]; selfId: string } | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Gate: only active super_admins can view this page
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const p = profile as { role: string; is_active: boolean } | null;
  if (!p || p.role !== "super_admin" || !p.is_active) return null;

  // Fetch all super admins joined with user_profiles for is_active status
  const { data: adminRows, error } = await (supabase as any)
    .from("super_admins")
    .select("id, name, created_at");

  if (error || !adminRows) return { admins: [], selfId: user.id };

  // Fetch profiles and emails for all admins in parallel
  const ids = (adminRows as { id: string; name: string; created_at: string }[]).map((r) => r.id);

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, is_active")
    .in("id", ids);

  // Use admin client to get emails from auth.users
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const adminClient = await createSupabaseAdminClient();

  const profileMap: Record<string, boolean> = {};
  (profiles ?? []).forEach((p: { id: string; is_active: boolean }) => {
    profileMap[p.id] = p.is_active;
  });

  // Fetch all users from auth to get emails
  const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  (authList?.users ?? []).forEach((u) => {
    emailMap[u.id] = u.email ?? "";
  });

  const admins: AdminRow[] = (adminRows as { id: string; name: string; created_at: string }[]).map(
    (r) => ({
      id: r.id,
      name: r.name,
      email: emailMap[r.id] ?? "—",
      is_active: profileMap[r.id] ?? true,
      created_at: r.created_at,
      is_self: r.id === user.id,
    })
  );

  // Sort: self first, then by name
  admins.sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    return a.name.localeCompare(b.name);
  });

  return { admins, selfId: user.id };
}

export default async function AdminsPage() {
  const data = await getAdminsData();
  if (!data) redirect("/login");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Super Admins</h1>
          <p className="page-subtitle">
            Manage accounts with full system access
          </p>
        </div>
      </div>

      <AdminsClient admins={data.admins} />
    </div>
  );
}
