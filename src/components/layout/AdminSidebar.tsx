"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./AdminSidebar.module.css";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="1" y="1" width="7" height="7" rx="1.5" />
        <rect x="10" y="1" width="7" height="7" rx="1.5" />
        <rect x="1" y="10" width="7" height="7" rx="1.5" />
        <rect x="10" y="10" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Institution",
    href: "/admin/institution/faculties",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M1 17h16M3 17V7l6-5 6 5v10M7 17v-5h4v5" />
      </svg>
    ),
    children: [
      { label: "Faculties", href: "/admin/institution/faculties" },
      { label: "Departments", href: "/admin/institution/departments" },
      { label: "Programmes", href: "/admin/institution/programmes" },
      { label: "Qual. Types", href: "/admin/institution/qualification-types" },
      { label: "Levels", href: "/admin/institution/levels" },
    ],
  },
  {
    label: "Academic Years",
    href: "/admin/academic-years",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="1" y="3" width="16" height="14" rx="1.5" />
        <path d="M1 7h16M6 1v4M12 1v4" />
      </svg>
    ),
  },
  {
    label: "Semesters",
    href: "/admin/semesters",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="9" cy="9" r="8" />
        <path d="M9 5v4l3 3" />
      </svg>
    ),
  },
  {
    label: "Groups",
    href: "/admin/groups",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="6" cy="6" r="3" />
        <circle cx="12" cy="6" r="3" />
        <path d="M1 16c0-2.76 2.24-5 5-5M12 11c2.76 0 5 2.24 5 5" />
        <path d="M9 11c1.65 0 3 1.35 3 3" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/admin/users/students",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="9" cy="6" r="4" />
        <path d="M1 17c0-3.87 3.58-7 8-7s8 3.13 8 7" />
      </svg>
    ),
    children: [
      { label: "Students", href: "/admin/users/students" },
      { label: "Lecturers", href: "/admin/users/lecturers" },
      { label: "Super Admins", href: "/admin/users/admins" },
    ],
  },
  {
    label: "Courses",
    href: "/admin/courses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 1h12a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
        <path d="M6 6h6M6 9h6M6 12h4" />
      </svg>
    ),
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 1h12a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
        <path d="M6 6h6M6 9h6M6 12h4" />
        <circle cx="14" cy="14" r="3.5" fill="var(--color-bg)" stroke="currentColor" />
        <path d="M12.5 14h2M13.5 13v2" />
      </svg>
    ),
  },
  {
    label: "Feedback",
    href: "/admin/feedback",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M2 2h14a1 1 0 011 1v9a1 1 0 01-1 1H5l-4 3V3a1 1 0 011-1z" />
        <path d="M5 7h8M5 10h5" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="9" cy="9" r="3" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" />
      </svg>
    ),
  },
] as const;

const BrandMark = () => (
  <>
    <div className={styles.brandIcon}>
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="brandGradAdmin" x1="0" y1="0" x2="28" y2="28">
            <stop stopColor="#ef4444" />
            <stop offset="1" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" rx="8" fill="url(#brandGradAdmin)" />
        <path d="M7 10h14M7 14h10M7 18h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="21" cy="18" r="4" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
        <path d="M19.5 18l1 1 2-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div>
      <div className={styles.brandName}>ATTEN-SYS</div>
      <div className={styles.brandRole}>Super Admin</div>
    </div>
  </>
);

interface NavContentProps {
  pathname: string;
  closeDrawer: () => void;
  onSignOutClick: () => void;
  adminName?: string;
}

function NavContent({ pathname, closeDrawer, onSignOutClick, adminName }: NavContentProps) {
  return (
    <>
      {/* Navigation */}
      <nav className={styles.nav} aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const isParentActive = pathname.startsWith(item.href.split("/").slice(0, 3).join("/"));

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={closeDrawer}
                className={`${styles.navItem} ${isParentActive ? styles.navItemActive : ""}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
              {"children" in item && item.children && isParentActive && (
                <div className={styles.subNav}>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={closeDrawer}
                      className={`${styles.subNavItem} ${pathname === child.href ? styles.subNavItemActive : ""}`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <Link href="/admin/profile" className={styles.profileLink} onClick={closeDrawer}>
          <div className={`avatar ${styles.profileAvatar}`}>
            {adminName ? adminName.charAt(0).toUpperCase() : "A"}
          </div>
          <span className={styles.profileName}>{adminName ?? "Admin"}</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <ThemeToggle variant="icon" />
          <button
            onClick={onSignOutClick}
            className={styles.logoutBtn}
            title="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l4-4-4-4M14 7H6" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminName, setAdminName] = useState<string | undefined>(undefined);

  // Fetch the logged-in admin's name once on mount
  useEffect(() => {
    async function fetchName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("super_admins")
        .select("name")
        .eq("id", user.id)
        .single();
      if (data?.name) setAdminName(data.name);
    }
    fetchName();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on route change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close dialog on Escape
  useEffect(() => {
    if (!confirmSignOut) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmSignOut(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmSignOut]);

  async function handleLogout() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark />
        </div>
        <NavContent pathname={pathname} closeDrawer={closeDrawer} onSignOutClick={() => setConfirmSignOut(true)} adminName={adminName} />
      </aside>

      {/* ── Mobile topbar ────────────────────────────────────────── */}
      <header className={styles.mobileTopbar}>
        <button
          className={styles.hamburger}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        {/* Mobile topbar brand — text only, no logo */}
        <div className={styles.mobileTopbarBrand}>
          <div className={styles.brandName}>ATTEN-SYS</div>
          <div className={styles.brandRole}>Super Admin</div>
        </div>
      </header>

      {/* ── Backdrop ─────────────────────────────────────────────── */}
      <div
        className={`${styles.drawerBackdrop} ${drawerOpen ? styles.drawerBackdropOpen : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* ── Drawer panel ─────────────────────────────────────────── */}
      <aside
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
        aria-label="Navigation menu"
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHeader}>
          <div className={styles.brand} style={{ border: "none", padding: 0 }}>
            <BrandMark />
          </div>
          <button
            className={styles.drawerClose}
            onClick={closeDrawer}
            aria-label="Close navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>
        <NavContent pathname={pathname} closeDrawer={closeDrawer} onSignOutClick={() => setConfirmSignOut(true)} adminName={adminName} />
      </aside>

      {/* ── Sign-out confirmation dialog ─────────────────────────── */}
      {confirmSignOut && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmSignOut(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
        >
          <div className={styles.dialog}>
            <div className={styles.dialogIcon} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h2 className={styles.dialogTitle} id="signout-title">Sign out?</h2>
            <p className={styles.dialogBody}>
              You'll be returned to the login screen. Any unsaved work will be lost.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={styles.dialogCancel}
                onClick={() => setConfirmSignOut(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                className={styles.dialogConfirm}
                onClick={handleLogout}
                disabled={signingOut}
              >
                {signingOut ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ animation: "spin 0.6s linear infinite" }}>
                      <path d="M7 1a6 6 0 1 0 6 6" />
                    </svg>
                    Signing out…
                  </>
                ) : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
