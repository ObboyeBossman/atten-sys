"use client";

/**
 * AdminContentWrapper
 *
 * A minimal client component that wraps the admin content area so PageShimmer
 * (a client component) can live inside the otherwise-server AdminLayout.
 * Keeps AdminLayout itself a server component — no unnecessary client bundle.
 */

import { PageShimmer } from "@/components/layout/PageTransition";
import styles from "./admin.module.css";

export function AdminContentWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.adminContent} style={{ position: "relative" }}>
      <PageShimmer />
      {children}
    </div>
  );
}
