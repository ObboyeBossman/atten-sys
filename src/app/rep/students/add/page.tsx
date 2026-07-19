import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddStudentClient } from "./AddStudentClient";

export const metadata: Metadata = { title: "Add Student" };

async function getData() {
  const supabase = await createSupabaseServerClient();

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
  const groupId = membershipData.group_id;

  const groupResult = await supabase
    .from("groups")
    .select("group_name")
    .eq("id", groupId)
    .maybeSingle();

  const groupName =
    (groupResult.data as { group_name: string } | null)?.group_name ??
    "Your Group";

  return { groupId, groupName };
}

export default async function AddStudentPage() {
  const { groupId, groupName } = await getData();

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: "var(--space-1)" }}>
            <Link
              href="/rep/students"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
              className="back-link"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M10 12L6 8l4-4" />
              </svg>
              Student Roster
            </Link>
          </div>
          <h1 className="page-title">Add Student</h1>
          <p className="page-subtitle">{groupName}</p>
        </div>
      </div>

      <AddStudentClient groupId={groupId} groupName={groupName} />

      <style>{`
        .back-link:hover { color: var(--color-text-2); }
      `}</style>
    </div>
  );
}
