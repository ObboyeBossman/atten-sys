import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentsClient, type StudentRow, type FilterOption } from "./StudentsClient";

export const metadata: Metadata = { title: "Students" };
export const revalidate = 0;

const PER_PAGE = 50;

type SearchParams = Promise<{
  q?: string;
  group?: string;
  year?: string;
  status?: string;
  page?: string;
}>;

async function getData(params: Awaited<SearchParams>) {
  const supabase = await createSupabaseServerClient();

  const q = params.q?.trim() ?? "";
  const groupId = params.group ?? "";
  const yearId = params.year ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  // ── Fetch filter options in parallel ─────────────────────────────────────
  const [groupsRes, yearsRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, group_name, academic_year_id")
      .order("group_name"),
    supabase
      .from("academic_years")
      .select("id, name")
      .order("start_date", { ascending: false }),
  ]);

  const groups: FilterOption[] = (groupsRes.data ?? []).map((g: { id: string; group_name: string }) => ({
    id: g.id,
    name: g.group_name,
  }));
  const academicYears: FilterOption[] = (yearsRes.data ?? []).map((y: { id: string; name: string }) => ({
    id: y.id,
    name: y.name,
  }));

  // ── Build students query ──────────────────────────────────────────────────
  // We join: students → user_profiles (for is_active, email via auth)
  // For current group: latest active group_membership → groups → academic_years
  //
  // Strategy: fetch students + user_profiles, then resolve group memberships
  // separately and merge (Supabase doesn't support LEFT JOINs via the JS client
  // for this level of nesting cleanly).

  // Step 1: get all student ids that match the group/year filter
  let filteredStudentIds: string[] | null = null;

  if (groupId || yearId) {
    let memQuery = supabase
      .from("group_memberships")
      .select("student_id, group_id, groups(id, group_name, academic_year_id, academic_years(name))")
      .eq("status", "active");

    if (groupId) memQuery = memQuery.eq("group_id", groupId);

    const { data: memData } = await memQuery;

    if (yearId && memData) {
      // Filter memberships where group belongs to the selected year
      type MemRow = { student_id: string; groups: { academic_year_id?: string } | null };
      const filtered = (memData as MemRow[]).filter((m) => {
        return m.groups?.academic_year_id === yearId;
      });
      filteredStudentIds = filtered.map((m) => m.student_id);
    } else if (memData) {
      filteredStudentIds = (memData as { student_id: string }[]).map((m) => m.student_id);
    } else {
      filteredStudentIds = [];
    }

    // Empty set — no results
    if ((filteredStudentIds ?? []).length === 0) {
      return {
        students: [],
        total: 0,
        page,
        perPage: PER_PAGE,
        groups,
        academicYears,
        searchQuery: q,
        groupFilter: groupId,
        yearFilter: yearId,
        statusFilter: status,
      };
    }
  }

  // Step 2: query user_profiles filtered by role=student + status
  let profileQuery = supabase
    .from("user_profiles")
    .select("id, is_active", { count: "exact" })
    .eq("role", "student");

  if (status === "active") profileQuery = profileQuery.eq("is_active", true);
  if (status === "inactive") profileQuery = profileQuery.eq("is_active", false);
  if (filteredStudentIds) profileQuery = profileQuery.in("id", filteredStudentIds);

  const { data: allProfiles, count: totalCount } = await profileQuery;
  const profileIds = (allProfiles ?? []).map((p: { id: string; is_active: boolean }) => p.id);

  if (profileIds.length === 0) {
    return {
      students: [],
      total: 0,
      page,
      perPage: PER_PAGE,
      groups,
      academicYears,
      searchQuery: q,
      groupFilter: groupId,
      yearFilter: yearId,
      statusFilter: status,
    };
  }

  // Step 3: fetch students (with name/index search) — paginated
  let studentsQuery = supabase
    .from("students")
    .select("id, name, index_number")
    .in("id", profileIds)
    .order("name")
    .range(from, to);

  if (q) {
    studentsQuery = studentsQuery.or(
      `name.ilike.%${q}%,index_number.ilike.%${q}%`
    );
  }

  const { data: studentsData } = await studentsQuery;
  const studentIds = (studentsData ?? []).map((s: { id: string; name: string; index_number: string }) => s.id);

  if (studentIds.length === 0) {
    return {
      students: [],
      total: totalCount ?? 0,
      page,
      perPage: PER_PAGE,
      groups,
      academicYears,
      searchQuery: q,
      groupFilter: groupId,
      yearFilter: yearId,
      statusFilter: status,
    };
  }

  // Step 4: resolve emails from auth.users via admin API — not exposed to client
  // We use user_profiles as proxy since email is stored in auth.users separately.
  // Supabase JS client on the server can list users — but for large sets we'll
  // just skip email in this iteration (it would need admin.listUsers with pagination).
  // Instead, we'll construct the email from index_number + system domain.
  const { data: settingRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "institution_email_domain")
    .maybeSingle() as unknown as { data: { value: string } | null };
  const domain = settingRow?.value ?? "ttu.edu.gh";

  // Step 5: get active group memberships for these students
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select(
      "student_id, groups(group_name, academic_year_id, academic_years(name))"
    )
    .in("student_id", studentIds)
    .eq("status", "active");

  type MembershipItem = {
    student_id: string;
    groups: {
      group_name: string;
      academic_year_id: string;
      academic_years: { name: string } | null;
    } | null;
  };

  const membershipMap: Record<
    string,
    { group_name: string; year_name: string | null }
  > = {};
  ((memberships ?? []) as MembershipItem[]).forEach((m) => {
    if (m.groups) {
      membershipMap[m.student_id] = {
        group_name: m.groups.group_name,
        year_name: m.groups.academic_years?.name ?? null,
      };
    }
  });

  // Build profile map for is_active
  const profileMap: Record<string, boolean> = {};
  (allProfiles ?? []).forEach((p: { id: string; is_active: boolean }) => {
    profileMap[p.id] = p.is_active;
  });

  const students: StudentRow[] = (studentsData ?? []).map((s: { id: string; name: string; index_number: string }) => {
    const mem = membershipMap[s.id];
    return {
      id: s.id,
      name: s.name,
      index_number: s.index_number,
      email: `${s.index_number.toLowerCase()}@${domain}`,
      is_active: profileMap[s.id] ?? true,
      current_group: mem?.group_name ?? null,
      academic_year: mem?.year_name ?? null,
      group_id: null,
    };
  });

  return {
    students,
    total: totalCount ?? 0,
    page,
    perPage: PER_PAGE,
    groups,
    academicYears,
    searchQuery: q,
    groupFilter: groupId,
    yearFilter: yearId,
    statusFilter: status,
  };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const data = await getData(params);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            View, filter, and manage student accounts across the system
          </p>
        </div>
        <div className="alert alert-info" style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)" }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" />
            <path d="M8 5v4M8 10.5v.5" />
          </svg>
          New students are added via the rep portal's Add Student flow
        </div>
      </div>

      <StudentsClient {...data} />
    </div>
  );
}
