import type { Metadata } from "next";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "@/app/portal-light-theme.css";
import "@/app/portal-dark-theme.css";

export const metadata: Metadata = {
  title: { default: "Student Portal", template: "%s | Student | ATTEN-SYS" },
};

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  let isRep = false;
  let unreadCount = 0;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check course-rep status for portal switcher
      const { data: repData } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("student_id", user.id)
        .eq("is_course_rep", true)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      isRep = !!repData;

      // Fetch unread notification count for nav badge
      const { count } = await (supabase
        .from("notifications") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      unreadCount = count ?? 0;
    }
  } catch {
    // Silently fall back — badge just won't show
  }

  const STUDENT_NAV = [
    { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" as const },
    { label: "Attendance", href: "/student/attendance", icon: "check" as const },
    { label: "Notifications", href: "/student/notifications", icon: "bell" as const, badge: unreadCount },
    { label: "Feedback", href: "/student/feedback", icon: "star" as const },
    { label: "Profile", href: "/student/profile", icon: "user" as const },
  ];

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
