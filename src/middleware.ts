import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that are always public
const PUBLIC_ROUTES = ["/login", "/change-password"];

// Portal prefixes and their required roles/conditions
const PORTAL_GUARDS = [
  { prefix: "/admin", role: "super_admin", requireActive: true },
  { prefix: "/lecturer", role: "lecturer", requireActive: true },
  { prefix: "/rep", role: "student", requireRep: true },
  { prefix: "/student", role: "student" },
] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the Supabase session
  const { supabase, supabaseResponse, user } = await updateSession(request);

  // If public route, allow through (but redirect logged-in users away from /login)
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user && pathname === "/login") {
      // Redirect to correct portal based on role
      const profile = await supabase
        .from("user_profiles")
        .select("role, is_active, must_change_password")
        .eq("id", user.id)
        .single();

      if (profile.data) {
        const redirectUrl = getPortalUrl(profile.data.role);
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    return supabaseResponse;
  }

  // Root redirect
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const profile = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile.data) {
      return NextResponse.redirect(
        new URL(getPortalUrl(profile.data.role), request.url)
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Determine which portal prefix this request matches
  const portal = PORTAL_GUARDS.find((g) => pathname.startsWith(g.prefix));
  if (!portal) {
    // Not a portal route — allow through
    return supabaseResponse;
  }

  // Must be authenticated for any portal route
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fetch profile for role/status checks
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // must_change_password redirect — skip if already on change-password
  if (
    profile.must_change_password &&
    !pathname.includes("/change-password")
  ) {
    const changePasswordUrl = getChangePasswordUrl(portal.prefix);
    return NextResponse.redirect(new URL(changePasswordUrl, request.url));
  }

  // Role check
  if (profile.role !== portal.role) {
    // Wrong role — redirect to their own portal
    return NextResponse.redirect(
      new URL(getPortalUrl(profile.role), request.url)
    );
  }

  // Active check for admin and lecturer
  if ("requireActive" in portal && portal.requireActive && !profile.is_active) {
    return NextResponse.redirect(new URL("/login?reason=inactive", request.url));
  }

  // Rep check — must also have is_course_rep = true in active membership
  if ("requireRep" in portal && portal.requireRep) {
    const { data: membership } = await supabase
      .from("group_memberships")
      .select("is_course_rep, status")
      .eq("student_id", user.id)
      .eq("is_course_rep", true)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      // Not a rep — send to student portal
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

function getPortalUrl(role: string): string {
  switch (role) {
    case "super_admin":
      return "/admin/dashboard";
    case "lecturer":
      return "/lecturer/dashboard";
    case "student":
      return "/student/dashboard";
    default:
      return "/login";
  }
}

function getChangePasswordUrl(portalPrefix: string): string {
  return `${portalPrefix}/change-password`;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public assets (sw.js, workbox-*, manifest.webmanifest, icons/)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
