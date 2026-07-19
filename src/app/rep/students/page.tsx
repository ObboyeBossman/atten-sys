import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentsClient, type StudentRow } from "./StudentsClient";

export const metadata: Metadata = { title: "Student Roster" };
export const revalidate = 0;

type SearchParams = Promise<{ q?: string }>;

/* ── data fetching ───────────────────────────────────────────────────────── */
async function getData(searchQuery: string) {
  const supabase = await createSupabaseServerClient();

  // Resolve rep's identity + group
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membershipResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .maybeSingle();

  const membershipData = membershipResult.data as { group_id: string } | null;
  if (!membershipData) redirect("/student/dashboard");

  const groupId = (membershipData as { group_id: string }).group_id;

  // Fetch group name
  const groupResult = await supabase
    .from("groups")
    .select("group_name")
    .eq("id", groupId)
    .maybeSingle();
  const groupData = groupResult.data as { group_name: string } | null;
  const groupName = groupData?.group_name ?? "Your Group";

  // Fetch all active memberships for the group
  const membershipsResult = await supabase
    .from("group_memberships")
    .select("student_id, is_course_rep, joined_at")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  type MemberRow = { student_id: string; is_course_rep: boolean; joined_at: string };
  const memberships = (membershipsResult.data ?? []) as MemberRow[];
  const studentIds = memberships.map((m) => m.student_id);

  if (studentIds.length === 0) {
    return { students: [], total: 0, groupName, searchQuery };
  }

  // Fetch student names + index numbers
  let studentsQuery = supabase
    .from("students")
    .select("id, name, index_number")
    .in("id", studentIds)
    .order("name");

  if (searchQuery) {
    studentsQuery = studentsQuery.or(
      `name.ilike.%${searchQuery}%,index_number.ilike.%${searchQuery}%`
    );
  }

  const { data: studentsData } = await studentsQuery;
  type StudentBasic = { id: string; name: string; index_number: string };
  const students = (studentsData ?? []) as StudentBasic[];

  // Fetch active status from user_profiles
  const profileResult = await supabase
    .from("user_profiles")
    .select("id, is_active")
    .in("id", studentIds);

  type ProfileRow = { id: string; is_active: boolean };
  const profileMap: Record<string, boolean> = {};
  ((profileResult.data ?? []) as ProfileRow[]).forEach((p) => {
    profileMap[p.id] = p.is_active;
  });

  // Build membership lookup
  const memberMap: Record<string, { is_course_rep: boolean; joined_at: string }> = {};
  memberships.forEach((m) => {
    memberMap[m.student_id] = { is_course_rep: m.is_course_rep, joined_at: m.joined_at };
  });

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    index_number: s.index_number,
    is_course_rep: memberMap[s.id]?.is_course_rep ?? false,
    is_active: profileMap[s.id] ?? true,
    joined_at: memberMap[s.id]?.joined_at ?? "",
  }));

  return { students: rows, total: rows.length, groupName, searchQuery };
}

/* ── page ────────────────────────────────────────────────────────────────── */
export default async function RepStudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const data = await getData(searchQuery);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Roster</h1>
          <p className="page-subtitle">All students enrolled in your group</p>
        </div>
        <Link href="/rep/students/add" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="7" r="4" />
            <path d="M2 18c0-3.31 2.69-6 6-6M14 11v6M11 14h6" />
          </svg>
          Add Student
        </Link>
      </div>

      <StudentsClient {...data} />
    </div>
  );
}
