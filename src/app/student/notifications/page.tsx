import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, message, type, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Updates and alerts about your classes.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {!notifications || notifications.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-[var(--color-text-3)]">You have no notifications.</p>
          </div>
        ) : (
          (notifications as any[]).map((notif: any) => (
            <div key={notif.id} className={`card ${!notif.is_read ? 'border-l-4 border-l-[var(--color-primary)]' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{notif.title}</h3>
                <span className="text-xs text-[var(--color-text-3)] whitespace-nowrap ml-4">
                  {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-2)]">{notif.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
