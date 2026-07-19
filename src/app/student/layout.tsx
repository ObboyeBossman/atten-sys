import type { Metadata } from "next";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Student Portal", template: "%s | Student | ATTEN-SYS" },
};

const STUDENT_NAV = [
  { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" },
  { label: "Attendance", href: "/student/attendance", icon: "check" },
  { label: "Notifications", href: "/student/notifications", icon: "bell" },
  { label: "Profile", href: "/student/profile", icon: "user" },
] as const;

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Check if this student is also an active course rep so we can show the portal switcher
  let isRep = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("student_id", user.id)
        .eq("is_course_rep", true)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      isRep = !!data;
    }
  } catch {
    // If the check fails, silently fall back — student just won't see the switcher
  }

  return (
    <PortalLayout
      role="student"
      roleLabel="Student Portal"
      navItems={STUDENT_NAV}
      homeUrl="/student/dashboard"
      switchTo={isRep ? { label: "Rep Portal", href: "/rep/dashboard" } : undefined}
    >
      {children}
    </PortalLayout>
  );
}
