import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Seeding Database...");

  const users = [
    { email: "student@example.com", password: "password123", role: "student", meta: { name: "John Doe", index: "STU-001" } },
    { email: "lecturer@example.com", password: "password123", role: "lecturer", meta: { name: "Dr. Jane Smith", staffId: "LEC-001" } },
    { email: "admin@example.com", password: "password123", role: "super_admin", meta: { name: "System Admin" } }
  ];

  for (const u of users) {
    console.log(`Creating ${u.email}...`);
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (authErr) {
      console.error(`Error creating auth user ${u.email}:`, authErr.message);
      continue;
    }

    const userId = authData.user.id;
    
    // Check if profile exists (maybe created by trigger)
    const { data: profile } = await supabase.from("user_profiles").select("id").eq("id", userId).maybeSingle();
    
    if (!profile) {
      const { error: profileErr } = await supabase.from("user_profiles").insert({
        id: userId,
        role: u.role,
        is_active: true,
        must_change_password: false,
      });
      if (profileErr) console.error(`Error creating profile for ${u.email}:`, profileErr);
    } else {
      await supabase.from("user_profiles").update({ role: u.role, is_active: true, must_change_password: false }).eq("id", userId);
    }

    if (u.role === "student") {
      await supabase.from("students").upsert({
        id: userId,
        name: u.meta.name,
        index_number: u.meta.index,
      });
    } else if (u.role === "lecturer") {
      await supabase.from("lecturers").upsert({
        id: userId,
        name: u.meta.name,
        staff_id: u.meta.staffId,
      });
    } else if (u.role === "super_admin") {
      await supabase.from("super_admins").upsert({
        id: userId,
        name: u.meta.name,
      });
    }
  }

  // Create a faculty, department, programme, and some groups just so they exist
  const { data: faculty } = await supabase.from("faculties").upsert({ name: "Faculty of Engineering" }).select().single();
  if (faculty) {
    const { data: dept } = await supabase.from("departments").upsert({ name: "Computer Engineering", faculty_id: faculty.id }).select().single();
    if (dept) {
      const { data: prog } = await supabase.from("programmes").upsert({ name: "BSc Computer Engineering", department_id: dept.id, code: "BCE" }).select().single();
      
      const { data: acadYear } = await supabase.from("academic_years").upsert({ name: "2024/2025" }).select().single();
      if (acadYear && prog) {
        const { data: sem } = await supabase.from("app_semesters").upsert({ name: "Semester 1", academic_year_id: acadYear.id, status: "active" }).select().single();
        
        const { data: qual } = await supabase.from("qualification_types").upsert({ name: "BSc" }).select().single();
        const { data: lvl } = await supabase.from("levels").upsert({ name: "Level 100", sort_order: 1 }).select().single();
        
        if (qual && lvl) {
            const { data: group } = await supabase.from("groups").upsert({
                programme_id: prog.id,
                qualification_type_id: qual.id,
                level_id: lvl.id,
                admission_year_id: acadYear.id,
                group_name: "BCE - 2024 - L100",
            }).select().single();

            // Add course
            if (group && sem) {
              const { data: course } = await supabase.from("courses").upsert({
                  group_id: group.id,
                  semester_id: sem.id,
                  name: "Introduction to Computer Engineering",
                  code: "COE 101",
                  credit_hours: 3
              }).select().single();
              
              // Enroll student
              const { data: student } = await supabase.from("students").select("id").limit(1).single();
              if (student && group) {
                  await supabase.from("group_memberships").upsert({
                      student_id: student.id,
                      group_id: group.id,
                      status: "active"
                  });
              }

              // Create a class session for the student to see
              if (course) {
                const now = new Date();
                const past = new Date(now.getTime() - 10 * 60000); // started 10 mins ago
                await supabase.from("class_sessions").insert({
                    course_id: course.id,
                    semester_id: sem.id,
                    duration_minutes: 120,
                    venue: "Lab 1",
                    started_at: past.toISOString(),
                });
              }
            }
        }
      }
    }
  }

  console.log("Seeding complete!");
}
main().catch(console.error);
