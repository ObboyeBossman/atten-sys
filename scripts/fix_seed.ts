import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("listUsers error:", error);
    return;
  }
  
  for (const user of users) {
    console.log(`Found user: ${user.email} (${user.id})`);
    
    // Seed them into the correct table based on their email or role
    let role = user.user_metadata?.role;
    if (!role) {
       if (user.email === 'student@example.com') role = 'student';
       if (user.email === 'lecturer@example.com') role = 'lecturer';
       if (user.email === 'admin@example.com' || user.email === 'obboyebossman@gmail.com') role = 'super_admin';
    }

    if (!role) continue;
    console.log(`Assigning role ${role}...`);

    await supabase.from("user_profiles").upsert({
      id: user.id,
      role: role,
      is_active: true,
      must_change_password: false,
    });

    if (role === "student") {
      await supabase.from("students").upsert({
        id: user.id,
        name: user.user_metadata?.name || "Student",
        index_number: user.user_metadata?.index || "STU-001",
      });
    } else if (role === "lecturer") {
      await supabase.from("lecturers").upsert({
        id: user.id,
        name: user.user_metadata?.name || "Lecturer",
        staff_id: user.user_metadata?.staffId || "LEC-001",
      });
    } else if (role === "super_admin") {
      await supabase.from("super_admins").upsert({
        id: user.id,
        name: user.user_metadata?.name || "Admin",
      });
    }
  }
}
main();
