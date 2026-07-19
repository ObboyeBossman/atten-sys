import type { Metadata } from "next";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { LecturersClient, type LecturerRow } from "./LecturersClient";

export const metadata: Metadata = { title: "Lecturers" };
export const revalidate = 0;

const PER_PAGE = 50;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
}>;

async function getData(params: Awaited<SearchParams>) {
  const supabase = await createSupabaseServerClient();

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  // Step 1: fetch user_profiles for all lecturers, filtered by status
  let profileQuery = supabase
    .from("user_profiles")
    .select("id, is_active", { count: "exact" })
    .eq("role", "lecturer");

  if (status === "active") profileQuery = profileQuery.eq("is_active", true);
  if (status === "inactive") profileQuery = profileQuery.eq("is_active", false);

  const { data: allProfiles, count: totalCount } = await profileQuery;
  const profileIds = (allProfiles ?? []).map((p: { id: string; is_active: boolean }) => p.id);

  if (profileIds.length === 0) {
    return { lecturers: [], total: 0, page, perPage: PER_PAGE, searchQuery: q, statusFilter: status };
  }

  // Build is_active map
  const activeMap: Record<string, boolean> = {};
  (allProfiles ?? []).forEach((p: { id: string; is_active: boolean }) => {
    activeMap[p.id] = p.is_active;
  });

  // Step 2: query lecturers table with optional search, paginated
  let lecturerQuery = supabase
    .from("lecturers")
    .select("id, name, staff_id, phone")
    .in("id", profileIds)
    .order("name")
    .range(from, to);

  if (q) {
    lecturerQuery = lecturerQuery.or(`name.ilike.%${q}%,staff_id.ilike.%${q}%`);
  }

  const { data: lecturersData } = await lecturerQuery;
  const lecturerIds = (lecturersData ?? []).map(
    (l: { id: string; name: string; staff_id: string; phone: string | null }) => l.id
  );

  if (lecturerIds.length === 0) {
    return { lecturers: [], total: totalCount ?? 0, page, perPage: PER_PAGE, searchQuery: q, statusFilter: status };
  }

  // Step 3: fetch emails from Supabase Auth admin API
  // We list users by ID. Auth admin API doesn't support bulk lookup by ID array,
  // so we fetch all lecturer-role users and build an email map.
  const adminClient = await createSupabaseAdminClient();
  const emailMap: Record<string, string> = {};
  try {
    // listUsers returns pages of 1000 max; for typical lecturer counts this is fine
    const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    (authUsers?.users ?? []).forEach((u) => {
      if (u.id && u.email) emailMap[u.id] = u.email;
    });
  } catch (e) {
    console.error("Failed to list auth users for email map:", e);
  }

  // Step 4: get current course counts per lecturer (active semester courses)
  const { data: coursesData } = await supabase
    .from("courses")
    .select("lecturer_id")
    .in("lecturer_id", lecturerIds);

  const courseCountMap: Record<string, number> = {};
  (coursesData ?? []).forEach((c: { lecturer_id: string | null }) => {
    if (c.lecturer_id) {
      courseCountMap[c.lecturer_id] = (courseCountMap[c.lecturer_id] ?? 0) + 1;
    }
  });

  // Step 5: assemble rows
  const lecturers: LecturerRow[] = (
    lecturersData ?? []
  ).map((l: { id: string; name: string; staff_id: string; phone: string | null }) => ({
    id: l.id,
    name: l.name,
    staff_id: l.staff_id,
    phone: l.phone,
    email: emailMap[l.id] ?? "—",
    is_active: activeMap[l.id] ?? true,
    course_count: courseCountMap[l.id] ?? 0,
  }));

  return {
    lecturers,
    total: totalCount ?? 0,
    page,
    perPage: PER_PAGE,
    searchQuery: q,
    statusFilter: status,
  };
}

export default async function LecturersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const data = await getData(params);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lecturers</h1>
          <p className="page-subtitle">
            Create and manage lecturer accounts across the system
          </p>
        </div>
      </div>

      <LecturersClient {...data} />
    </div>
  );
}
