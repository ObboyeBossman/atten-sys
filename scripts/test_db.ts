import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.from("user_profiles").select("*").limit(1);
  console.log("user_profiles:", error ? error.message : "OK");

  const { data: d2, error: e2 } = await supabase.from("students").select("*").limit(1);
  console.log("students:", e2 ? e2.message : "OK");
}
main().catch(console.error);
