"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./PortalLayout.module.css";

type NavIcon =
  | "dashboard"
  | "book"
  | "video"
  | "users"
  | "flag"
  | "clock"
  | "user"
  | "check"
  | "bell"
  | "calendar";

function Icon({ name, size = 20 }: { name: NavIcon; size?: number }) {
  const props = { width: size, height: size, viewBox: `0 0 ${size} ${size}`, fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "dashboard":
      return <svg {...props}><rect x="1" y="1" width="8" height="8" rx="1.5" /><rect x="11" y="1" width="8" height="8" rx="1.5" /><rect x="1" y="11" width="8" height="8" rx="1.5" /><rect x="11" y="11" width="8" height="8" rx="1.5" /></svg>;
    case "book":
      return <svg {...props}><path d="M4 2h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>;
    case "video":
      return <svg {...props}><rect x="2" y="5" width="12" height="10" rx="1.5"/><path d="M14 8l5-3v9l-5-3"/></svg>;
    case "users":
      return <svg {...props}><circle cx="7" cy="6" r="3"/><circle cx="13" cy="6" r="3"/><path d="M1 18c0-3.31 2.69-6 6-6"/><path d="M13 12c3.31 0 6 2.69 6 6"/><path d="M10 12c1.66 0 3 1.34 3 3"/></svg>;
    case "flag":
      return <svg {...props}><path d="M4 2v18M4 2h12l-3 5 3 5H4"/></svg>;
    case "clock":
      return <svg {...props}><circle cx="10" cy="10" r="8"/><path d="M10 5v5l4 4"/></svg>;
    case "user":
      return <svg {...props}><circle cx="10" cy="6" r="4"/><path d="M2 19c0-4.42 3.58-8 8-8s8 3.58 8 8"/></svg>;
    case "check":
      return <svg {...props}><path d="M4 10l5 5L19 4"/><circle cx="10" cy="10" r="9"/></svg>;
    case "bell":
      return <svg {...props}><path d="M10 2a6 6 0 00-6 6v3l-2 4h16l-2-4V8a6 6 0 00-6-6z"/><path d="M8 17a2 2 0 004 0"/></svg>;
    case "calendar":
      return <svg {...props}><rect x="2" y="4" width="16" height="15" rx="1.5"/><path d="M2 9h16M7 2v4M13 2v4"/></svg>;
    default:
      return null;
  }
}

interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

interface PortalLayoutProps {
  role: "lecturer" | "rep" | "student";
  roleLabel: string;
  navItems: readonly NavItem[];
  homeUrl: string;
  children: React.ReactNode;
}

const ROLE_COLORS: Record<string, string> = {
  lecturer: "#6366f1",
  rep: "#f59e0b",
  student: "#22c55e",
};

const ROLE_INITIALS: Record<string, string> = {
  lecturer: "L",
  rep: "R",
  student: "S",
};

export function PortalLayout({ role, roleLabel, navItems, homeUrl, children }: PortalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const roleColor = ROLE_COLORS[role];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={styles.root}>
      {/* Sidebar (desktop) */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#3b82f6" />
              <path d="M7 10h14M7 14h10M7 18h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="21" cy="18" r="4" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
              <path d="M19.5 18l1 1 2-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>ATTEN-SYS</div>
            <div className={styles.brandRole} style={{ color: roleColor }}>{roleLabel}</div>
          </div>
        </div>

        <nav className={styles.nav} aria-label={`${roleLabel} navigation`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                style={isActive ? { "--role-color": roleColor } as React.CSSProperties : undefined}
              >
                <span className={styles.navIcon}>
                  <Icon name={item.icon} size={18} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div
            className={styles.avatar}
            style={{ background: `linear-gradient(135deg, ${roleColor}, #3b82f6)` }}
          >
            {ROLE_INITIALS[role]}
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l4-4-4-4M14 7H6" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className={styles.bottomNav} aria-label="Mobile navigation">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ""}`}
              style={isActive ? { "--role-color": roleColor } as React.CSSProperties : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
