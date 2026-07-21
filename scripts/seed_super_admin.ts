import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ");

  if (!email || !password || !name) {
    console.error("Usage: tsx seed_super_admin.ts <email> <password> <name>");
    process.exit(1);
  }

  console.log(`Creating super admin: ${email}`);

  // 1. Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "super_admin" },
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("User already exists — fetching existing user...");
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === email);
      if (!existing) throw new Error("Could not find existing user");

      // Ensure super_admins row exists
      const { error: saError } = await supabase
        .from("super_admins")
        .upsert({ id: existing.id, name }, { onConflict: "id" });
      if (saError) throw saError;
      console.log(`✅ Super admin row ensured for existing user (${existing.id})`);
      return;
    }
    throw authError;
  }

  const userId = authData.user.id;
  console.log(`Auth user created: ${userId}`);

  // 2. Insert super_admins row (trigger handle_new_user already created user_profiles)
  const { error: saError } = await supabase
    .from("super_admins")
    .insert({ id: userId, name });

  if (saError) throw saError;

  console.log(`✅ Super admin seeded successfully!`);
  console.log(`   Email   : ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Name    : ${name}`);
  console.log(`   UUID    : ${userId}`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
