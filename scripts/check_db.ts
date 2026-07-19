import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url!, key!);

  const { data: students } = await supabase.from("students").select("*").limit(5);
  const { data: lecturers } = await supabase.from("lecturers").select("*").limit(5);
  const { data: admins } = await supabase.from("super_admins").select("*").limit(5);

  console.log("Students:", students);
  console.log("Lecturers:", lecturers);
  console.log("Admins:", admins);
}
main();
