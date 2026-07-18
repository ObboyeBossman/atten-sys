import type { Metadata } from "next";
import { PortalLayout } from "@/components/layout/PortalLayout";

export const metadata: Metadata = {
  title: { default: "Student Portal", template: "%s | Student | ATTEN-SYS" },
};

const STUDENT_NAV = [
  { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" },
  { label: "Attendance", href: "/student/attendance", icon: "check" },
  { label: "Notifications", href: "/student/notifications", icon: "bell" },
  { label: "Profile", href: "/student/profile", icon: "user" },
] as const;

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      role="student"
      roleLabel="Student Portal"
      navItems={STUDENT_NAV}
      homeUrl="/student/dashboard"
    >
      {children}
    </PortalLayout>
  );
}
