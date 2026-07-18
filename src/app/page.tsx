import { redirect } from "next/navigation";

// Root page — middleware handles role-based redirect.
// This is only reached if middleware is bypassed (shouldn't happen).
export default function Home() {
  redirect("/login");
}
