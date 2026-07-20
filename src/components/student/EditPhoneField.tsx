"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePhone } from "@/actions/profile";

interface EditPhoneFieldProps {
  initialPhone: string | null;
}

export function EditPhoneField({ initialPhone }: EditPhoneFieldProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialPhone ?? "");
  const [saved, setSaved] = useState(initialPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    setValue(saved);
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setValue(saved);
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    if (!value.trim()) {
      setError("Please enter a phone number.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePhone(value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(value.trim());
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <label
        className="block text-sm font-medium text-[var(--color-text-2)] mb-1"
        htmlFor="phone-field"
      >
        Phone Number
      </label>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              id="phone-field"
              type="tel"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              autoFocus
              placeholder="+233 XX XXX XXXX"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              style={{
                flex: 1,
                background: "var(--color-surface-2)",
                border: `1px solid ${error ? "var(--color-danger)" : "var(--color-primary)"}`,
                borderRadius: "var(--radius-md)",
                padding: "var(--space-2) var(--space-3)",
                color: "var(--color-text)",
                fontSize: "var(--text-base)",
                outline: "none",
                transition: "border-color var(--transition-fast)",
                minHeight: 44,
              }}
            />
            <button
              onClick={handleSave}
              disabled={isPending || !value.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: isPending || !value.trim() ? "var(--color-surface-3)" : "var(--color-primary)",
                color: isPending || !value.trim() ? "var(--color-text-3)" : "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                cursor: isPending || !value.trim() ? "not-allowed" : "pointer",
                transition: "all var(--transition-fast)",
                minHeight: 44,
                whiteSpace: "nowrap",
              }}
            >
              {isPending ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      display: "inline-block",
                      animation: "spin 0.6s linear infinite",
                    }}
                    aria-hidden="true"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "transparent",
                color: "var(--color-text-3)",
                border: "1px solid var(--color-border)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                cursor: isPending ? "not-allowed" : "pointer",
                transition: "all var(--transition-fast)",
                minHeight: 44,
              }}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "var(--text-lg)", fontWeight: 500, flex: 1 }}>
            {saved || <span style={{ color: "var(--color-text-3)" }}>Not provided</span>}
          </span>
          <button
            onClick={handleEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-2)",
              border: "1px solid var(--color-border)",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              minHeight: 44,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-primary)";
              e.currentTarget.style.color = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-2)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
