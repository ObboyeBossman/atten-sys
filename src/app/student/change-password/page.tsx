import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = { title: "Change Password" };

export default function StudentChangePasswordPage() {
  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Update Your Password</h1>
        <p className="text-[var(--color-text-3)]">
          For your security, you are required to change your default password before accessing the portal.
        </p>
      </div>
      <div className="card">
        <ChangePasswordForm portalPrefix="/student" />
      </div>
    </div>
  );
}
