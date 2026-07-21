"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { useEffect, useRef } from "react";

/**
 * Watches the resolved theme and keeps the nearest ancestor
 * [data-portal] attribute in sync (admin-light / admin-dark).
 * Must be rendered inside the ThemeProvider tree.
 */
export function AdminThemeApplier() {
  const { resolved } = useTheme();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current?.closest("[data-portal]") as HTMLElement | null;
    if (!el) return;
    el.setAttribute(
      "data-portal",
      resolved === "light" ? "admin-light" : "admin-dark"
    );
  }, [resolved]);

  return <span ref={ref} style={{ display: "none" }} aria-hidden="true" />;
}
