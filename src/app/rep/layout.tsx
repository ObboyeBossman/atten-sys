import type { Metadata } from "next";
import { PortalLayout } from "@/components/layout/PortalLayout";
import "@/app/portal-light-theme.css";
import "@/app/portal-dark-theme.css";

export const metadata: Metadata = {
  title: { default: "Rep Portal", template: "%s | Rep | ATTEN-SYS" },
};

const REP_NAV = [
  { label: "Dashboard", href: "/rep/dashboard", icon: "dashboard" },
  { label: "Students", href: "/rep/students", icon: "users" },
  { label: "Courses", href: "/rep/courses", icon: "book" },
  { label: "Disputes", href: "/rep/disputes", icon: "flag" },
  { label: "Timetable", href: "/rep/timetable", icon: "calendar" },
] as const;

export default function RepLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      role="rep"
      roleLabel="Course Rep"
      navItems={REP_NAV}
      homeUrl="/rep/dashboard"
      switchTo={{ label: "Student Portal", href: "/student/dashboard" }}
    >
      {children}
    </PortalLayout>
  );
}
