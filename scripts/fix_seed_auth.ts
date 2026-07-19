import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = [
    { email: "student@example.com", password: "password123", role: "student", meta: { name: "John Doe", index: "STU-001" } },
    { email: "lecturer@example.com", password: "password123", role: "lecturer", meta: { name: "Dr. Jane Smith", staffId: "LEC-001" } },
    { email: "admin@example.com", password: "password123", role: "super_admin", meta: { name: "System Admin" } }
  ];
  
  for (const u of users) {
     const { data, error } = await supabase.auth.signInWithPassword({
        email: u.email,
        password: u.password,
     });
     
     if (error || !data.user) {
        console.error(`Failed to login ${u.email}:`, error?.message);
        continue;
     }
     
     const userId = data.user.id;
     console.log(`Assigning role ${u.role} to ${u.email} (${userId})...`);

    await admin.from("user_profiles").upsert({
      id: userId,
      role: u.role,
      is_active: true,
      must_change_password: false,
    });

    if (u.role === "student") {
      await admin.from("students").upsert({
        id: userId,
        name: u.meta.name,
        index_number: u.meta.index,
      });
    } else if (u.role === "lecturer") {
      await admin.from("lecturers").upsert({
        id: userId,
        name: u.meta.name,
        staff_id: u.meta.staffId,
      });
    } else if (u.role === "super_admin") {
      await admin.from("super_admins").upsert({
        id: userId,
        name: u.meta.name,
      });
    }
  }
}
main();
