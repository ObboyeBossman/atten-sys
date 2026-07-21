import type { Metadata } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminContentWrapper } from "./AdminContentWrapper";
import styles from "./admin.module.css";
import "./admin-light-theme.css";
import "./admin-dark-theme.css";

export const metadata: Metadata = {
  title: { default: "Admin Portal", template: "%s | Admin | ATTEN-SYS" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.adminRoot} data-portal="admin-dark">
      <AdminSidebar />
      <main className={styles.adminMain}>
        <AdminContentWrapper>{children}</AdminContentWrapper>
      </main>
    </div>
  );
}
