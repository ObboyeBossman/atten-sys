import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Group Detail" };
export const revalidate = 60;

/* ── data ───────────────────────────────────────────────── */
async function getData(groupId: string) {
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

  // Verify this lecturer has at least one course for this group
  const courseCheckResult = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("lecturer_id", user.id)
    .eq("group_id", groupId);

  if (!courseCheckResult.count || courseCheckResult.count === 0) {
    redirect("/lecturer/groups");
  }

  // Group info
  type RawGroup = {
    id: string;
    group_name: string;
  };

  const groupResult = await supabase
    .from("groups")
    .select("id, group_name")
    .eq("id", groupId)
    .maybeSingle();

  const group = groupResult.data as unknown as RawGroup | null;
  if (!group) notFound();

  // Members
  type MemberRow = {
    student_id: string;
    is_course_rep: boolean;
    students: { name: string; index_number: string } | null;
  };

  const membersResult = await supabase
    .from("group_memberships")
    .select("student_id, is_course_rep, students(name, index_number)")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("student_id");

  const members = (membersResult.data ?? []) as unknown as MemberRow[];

  // Courses this lecturer teaches in this group
  type RawCourse = { id: string; name: string; code: string };
  const coursesResult = await supabase
    .from("courses")
    .select("id, name, code")
    .eq("lecturer_id", user.id)
    .eq("group_id", groupId)
    .order("code");

  const courses = (coursesResult.data ?? []) as unknown as RawCourse[];

  // Sort members: rep first, then alphabetically
  const sorted = [...members].sort((a, b) => {
    if (a.is_course_rep !== b.is_course_rep)
      return a.is_course_rep ? -1 : 1;
    return (a.students?.name ?? "").localeCompare(b.students?.name ?? "");
  });

  return { group, members: sorted, courses };
}

/* ── page ───────────────────────────────────────────────── */
export default async function GroupDetailPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { group, members, courses } = await getData(params.groupId);

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link
          href="/lecturer/groups"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-3)",
            textDecoration: "none",
          }}
          className="back-link"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 15l-5-5 5-5" />
          </svg>
          Groups
        </Link>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">{group.group_name}</h1>
          <p className="page-subtitle">
            {members.length} enrolled student{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Courses taught in this group */}
      {courses.length > 0 && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h2
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "var(--space-3)",
            }}
          >
            Your Courses in This Group
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/lecturer/courses/${c.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="card course-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
                    cursor: "pointer",
                    transition: "all var(--transition-base)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-sm)",
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      minWidth: 72,
                    }}
                  >
                    {c.code}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text)",
                      fontWeight: 500,
                    }}
                  >
                    {c.name}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-3)", flexShrink: 0 }} aria-hidden="true">
                    <path d="M7 5l5 5-5 5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Member roster */}
      <div>
        <h2
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "var(--space-3)",
          }}
        >
          Student Roster
        </h2>

        {members.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "var(--space-12) var(--space-6)",
            }}
          >
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>
              No active students in this group.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "var(--space-2) var(--space-5)",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
              }}
            >
              <div style={{ width: 32, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</div>
              <div style={{ width: 100, textAlign: "right", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Index No.</div>
            </div>

            {members.map((m, i) => (
              <div
                key={m.student_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "var(--space-3) var(--space-5)",
                  borderBottom:
                    i < members.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  gap: "var(--space-3)",
                }}
              >
                {/* Avatar */}
                <div
                  className="avatar"
                  style={{
                    flexShrink: 0,
                    background: m.is_course_rep
                      ? "rgba(99,102,241,0.1)"
                      : "var(--color-surface-2)",
                    color: m.is_course_rep
                      ? "var(--color-primary)"
                      : "var(--color-text-3)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 800,
                  }}
                >
                  {(m.students?.name ?? "?").charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    {m.students?.name ?? "Unknown"}
                    {m.is_course_rep && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                          background: "rgba(99,102,241,0.1)",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-full)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Rep
                      </span>
                    )}
                  </div>
                </div>

                {/* Index number */}
                <div
                  style={{
                    width: 100,
                    textAlign: "right",
                    fontSize: "var(--text-xs)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-3)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {m.students?.index_number ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .back-link:hover { color: var(--color-text-2) !important; }
        .course-card:hover {
          border-color: var(--color-border-hover);
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </div>
  );
}
