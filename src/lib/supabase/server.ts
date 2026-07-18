import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses cookie-based session management.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component where cookies
            // cannot be set. Safe to ignore — middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase Admin client using the service role key.
 * MUST only be used in Server Actions or Route Handlers — never in client code.
 */
export async function createSupabaseAdminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
