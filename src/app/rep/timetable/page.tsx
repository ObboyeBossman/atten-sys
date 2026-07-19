import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Timetable" };
export const revalidate = 60;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

type TimetableEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  course: { id: string; name: string; code: string };
};

async function getData() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
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
  const groupName = (groupResult.data as { group_name: string } | null)?.group_name ?? "Your Group";

  // Active semester for context
  const semResult = await supabase
    .from("app_semesters")
    .select("name")
    .eq("status", "active")
    .maybeSingle();
  const semesterName = (semResult.data as { name: string } | null)?.name ?? null;

  // Timetable entries for this group with course info
  type RawEntry = {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    venue: string | null;
    courses: { id: string; name: string; code: string } | null;
  };

  const ttResult = await supabase
    .from("timetables")
    .select("id, day_of_week, start_time, end_time, venue, courses(id, name, code)")
    .eq("group_id", groupId)
    .order("day_of_week")
    .order("start_time");

  const entries = ((ttResult.data ?? []) as unknown as RawEntry[])
    .filter((e) => e.courses !== null)
    .map((e) => ({
      id: e.id,
      day_of_week: e.day_of_week,
      start_time: e.start_time,
      end_time: e.end_time,
      venue: e.venue,
      course: e.courses!,
    })) as TimetableEntry[];

  // Group by day
  const byDay: Record<number, TimetableEntry[]> = {};
  entries.forEach((e) => {
    if (!byDay[e.day_of_week]) byDay[e.day_of_week] = [];
    byDay[e.day_of_week].push(e);
  });

  // Days that have entries (Mon–Fri preferred, but include any)
  const activeDays = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDay[d]?.length);

  return { entries, byDay, activeDays, groupName, semesterName, groupId };
}

export default async function TimetablePage() {
  const { entries, byDay, activeDays, groupName, semesterName } = await getData();

  const todayDow = new Date().getDay();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {groupName}{semesterName ? ` · ${semesterName}` : ""}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--color-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-4)", color: "var(--color-text-3)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <path d="M2 8h20M8 3v5M16 3v5" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            No timetable entries yet
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Timetable slots are added from each course&apos;s detail page.
          </p>
          <Link href="/rep/courses" className="btn btn-primary">
            Go to Courses
          </Link>
        </div>
      ) : (
        <>
          {/* Day columns — mobile: stacked, desktop: side by side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            {activeDays.map((dow) => {
              const isToday = dow === todayDow;
              const dayEntries = byDay[dow] ?? [];

              return (
                <div key={dow}>
                  {/* Day header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: isToday ? "var(--color-primary)" : "var(--color-text-3)",
                      }}
                    >
                      {DAYS[dow]}
                    </span>
                    {isToday && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "var(--color-primary)",
                          color: "#fff",
                          borderRadius: "var(--radius-full)",
                          padding: "1px 7px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Today
                      </span>
                    )}
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)", marginLeft: "var(--space-1)" }} />
                  </div>

                  {/* Entries for this day */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {dayEntries.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/rep/courses/${entry.course.id}`}
                        style={{ textDecoration: "none" }}
                      >
                        <div
                          className="timetable-entry"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-4)",
                            padding: "var(--space-3) var(--space-4)",
                            borderRadius: "var(--radius-lg)",
                            background: isToday
                              ? "rgba(var(--color-primary-rgb,99,102,241),0.06)"
                              : "var(--color-surface)",
                            border: `1px solid ${isToday ? "rgba(var(--color-primary-rgb,99,102,241),0.25)" : "var(--color-border)"}`,
                            cursor: "pointer",
                            transition: "all var(--transition-fast)",
                          }}
                        >
                          {/* Time block */}
                          <div
                            style={{
                              flexShrink: 0,
                              width: 80,
                              textAlign: "center",
                            }}
                          >
                            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
                              {fmtTime(entry.start_time)}
                            </div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 1 }}>
                              {fmtTime(entry.end_time)}
                            </div>
                          </div>

                          {/* Divider */}
                          <div style={{ width: 1, height: 36, background: "var(--color-border)", flexShrink: 0 }} />

                          {/* Course info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: "var(--text-sm)",
                              color: "var(--color-text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {entry.course.name}
                            </div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{entry.course.code}</span>
                              {entry.venue && (
                                <span> · {entry.venue}</span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <div style={{ flexShrink: 0, color: "var(--color-text-3)" }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M7 5l5 5-5 5" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div
            style={{
              marginTop: "var(--space-6)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-text-3)", flexShrink: 0 }} aria-hidden="true">
              <rect x="2" y="3" width="16" height="15" rx="1.5" />
              <path d="M2 8h16M7 1v4M13 1v4" />
            </svg>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
              {entries.length} scheduled slot{entries.length !== 1 ? "s" : ""} across{" "}
              {activeDays.length} day{activeDays.length !== 1 ? "s" : ""}.
              Slots are managed from each course&apos;s detail page.
            </span>
            <Link
              href="/rep/courses"
              style={{
                marginLeft: "auto",
                fontSize: "var(--text-xs)",
                color: "var(--color-primary)",
                fontWeight: 600,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              Manage courses →
            </Link>
          </div>
        </>
      )}

      <style>{`
        .timetable-entry:hover {
          border-color: var(--color-border-hover) !important;
          transform: translateX(2px);
          box-shadow: var(--shadow-sm);
        }
        @media (min-width: 768px) {
          .timetable-entry:hover {
            transform: translateY(-1px);
          }
        }
      `}</style>
    </div>
  );
}
