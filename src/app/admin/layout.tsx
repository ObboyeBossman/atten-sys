import type { Metadata } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminContentWrapper } from "./AdminContentWrapper";
import { AdminThemeApplier } from "./AdminThemeApplier";
import styles from "./admin.module.css";
import "./admin-light-theme.css";
import "./admin-dark-theme.css";

export const metadata: Metadata = {
  title: { default: "Admin Portal", template: "%s | Admin | ATTEN-SYS" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Default to dark; AdminThemeApplier swaps to admin-light/admin-dark on the client */
    <div className={styles.adminRoot} data-portal="admin-dark">
      <AdminThemeApplier />
      <AdminSidebar />
      <main className={styles.adminMain}>
        <AdminContentWrapper>{children}</AdminContentWrapper>
      </main>
    </div>
  );
}
