import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsClient, type Setting } from "./SettingsClient";

export const metadata: Metadata = { title: "System Settings" };
export const revalidate = 0; // always fresh — settings changes must be immediate

async function getSettings(): Promise<Setting[]> {
  const supabase = await createSupabaseServerClient();

  type SettingRow = {
    key: string;
    value: string;
    description: string | null;
    updated_by: string | null;
    updated_at: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawRows, error } = await (supabase as any)
    .from("system_settings")
    .select("key, value, description, updated_by, updated_at")
    .order("key");

  if (error || !rawRows) return [];

  const rows = rawRows as SettingRow[];

  // Resolve updater names
  const updaterIds = [
    ...new Set(rows.filter((r) => r.updated_by).map((r) => r.updated_by as string)),
  ];

  const nameMap: Record<string, string> = {};

  if (updaterIds.length > 0) {
    const [{ data: admins }, { data: lecturers }] = await Promise.all([
      supabase.from("super_admins").select("id, name").in("id", updaterIds),
      supabase.from("lecturers").select("id, name").in("id", updaterIds),
    ]);

    ([...(admins ?? []), ...(lecturers ?? [])] as { id: string; name: string }[]).forEach(
      (r) => { nameMap[r.id] = r.name; }
    );
  }

  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    description: r.description ?? null,
    updated_at: r.updated_at,
    updater_name: r.updated_by ? (nameMap[r.updated_by] ?? null) : null,
  }));
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">
            Configure system-wide behaviour — changes take effect immediately
          </p>
        </div>

        {/* Live count badge */}
        <span
          className="badge badge-neutral"
          style={{ fontSize: "var(--text-xs)", alignSelf: "flex-start" }}
        >
          {settings.length} {settings.length === 1 ? "setting" : "settings"}
        </span>
      </div>

      {/* Info banner */}
      <div
        className="alert alert-info"
        style={{ marginBottom: "var(--space-6)", fontSize: "var(--text-sm)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="8" cy="8" r="7" />
          <path d="M8 5v4M8 10.5v.5" />
        </svg>
        <span>
          Click <strong>Edit</strong> on any setting to change its value. Each change is written
          to the database immediately and logged in the audit trail.
        </span>
      </div>

      {/* Settings list */}
      <SettingsClient settings={settings} />
    </div>
  );
}
