import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Groups" };
export const revalidate = 60;

/* ── types ──────────────────────────────────────────────── */
type GroupRow = {
  id: string;
  groupName: string;
  courseCount: number;
  memberCount: number;
  semesterName: string;
  courseNames: string[];
};

/* ── data ───────────────────────────────────────────────── */
async function getData() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lecturerResult = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  // All courses assigned to this lecturer — with group + semester info
  type RawCourse = {
    id: string;
    name: string;
    code: string;
    group_id: string;
    groups: { id: string; group_name: string } | null;
    app_semesters: { name: string } | null;
  };

  const coursesResult = await supabase
    .from("courses")
    .select(
      "id, name, code, group_id, groups(id, group_name), app_semesters(name)"
    )
    .eq("lecturer_id", user.id);

  const courses = (coursesResult.data ?? []) as unknown as RawCourse[];

  if (courses.length === 0) return { groups: [] };

  // Collect unique group IDs
  const groupMap: Record<
    string,
    {
      id: string;
      groupName: string;
      semesterName: string;
      courseNames: string[];
    }
  > = {};

  courses.forEach((c) => {
    const gid = c.group_id;
    if (!groupMap[gid]) {
      groupMap[gid] = {
        id: gid,
        groupName: c.groups?.group_name ?? "Unknown Group",
        semesterName: c.app_semesters?.name ?? "—",
        courseNames: [],
      };
    }
    groupMap[gid].courseNames.push(`${c.code}`);
  });

  const groupIds = Object.keys(groupMap);

  // Member counts for each group
  type MemberCountRow = { group_id: string };
  const membersResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "active");

  const memberRows = (membersResult.data ?? []) as MemberCountRow[];
  const memberCounts: Record<string, number> = {};
  memberRows.forEach((m) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
  });

  const groups: GroupRow[] = Object.values(groupMap).map((g) => ({
    id: g.id,
    groupName: g.groupName,
    semesterName: g.semesterName,
    courseCount: g.courseNames.length,
    memberCount: memberCounts[g.id] ?? 0,
    courseNames: g.courseNames,
  }));

  // Sort by group name
  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));

  return { groups };
}

/* ── page ───────────────────────────────────────────────── */
export default async function LecturerGroupsPage() {
  const { groups } = await getData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">
            Student groups you teach through your assigned courses
          </p>
        </div>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "var(--space-16) var(--space-6)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--color-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-4)",
              color: "var(--color-text-3)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "var(--text-base)",
              color: "var(--color-text)",
              marginBottom: "var(--space-1)",
            }}
          >
            No groups yet
          </div>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-3)",
            }}
          >
            Groups appear here once courses are assigned to you.
          </p>
        </div>
      )}

      {/* Groups list */}
      {groups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/lecturer/groups/${group.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card group-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-4) var(--space-5)",
                  cursor: "pointer",
                  transition: "all var(--transition-base)",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 52,
                    height: 52,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-primary)",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.groupName}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-3)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    {group.semesterName}
                  </div>
                  {group.courseNames.length > 0 && (
                    <div
                      style={{
                        marginTop: "var(--space-2)",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-1)",
                      }}
                    >
                      {group.courseNames.map((code) => (
                        <span
                          key={code}
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            background: "rgba(99,102,241,0.08)",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            border: "1px solid rgba(99,102,241,0.18)",
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "var(--space-1)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-xl)",
                      fontWeight: 800,
                      color: "var(--color-text)",
                    }}
                  >
                    {group.memberCount}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-3)",
                    }}
                  >
                    students
                  </div>
                </div>

                {/* Chevron */}
                <div style={{ flexShrink: 0, color: "var(--color-text-3)" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 5l5 5-5 5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .group-card:hover {
          border-color: var(--color-border-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
