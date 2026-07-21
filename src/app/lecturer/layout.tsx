import type { Metadata } from "next";
import { PortalLayout } from "@/components/layout/PortalLayout";
import "@/app/portal-light-theme.css";
import "@/app/portal-dark-theme.css";

export const metadata: Metadata = {
  title: { default: "Lecturer Portal", template: "%s | Lecturer | ATTEN-SYS" },
};

const LECTURER_NAV = [
  { label: "Dashboard", href: "/lecturer/dashboard", icon: "dashboard" },
  { label: "Courses", href: "/lecturer/courses", icon: "book" },
  { label: "Sessions", href: "/lecturer/sessions", icon: "video" },
  { label: "Groups", href: "/lecturer/groups", icon: "users" },
  { label: "Disputes", href: "/lecturer/disputes", icon: "flag" },
  { label: "History", href: "/lecturer/history", icon: "clock" },
  { label: "Profile", href: "/lecturer/profile", icon: "user" },
] as const;

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      role="lecturer"
      roleLabel="Lecturer Portal"
      navItems={LECTURER_NAV}
      homeUrl="/lecturer/dashboard"
    >
      {children}
    </PortalLayout>
  );
}
