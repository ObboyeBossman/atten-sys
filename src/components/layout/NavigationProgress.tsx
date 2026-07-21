"use client";

/**
 * NavigationProgress — global route-change detection
 *
 * Wraps the app in a context that fires on every Link click or programmatic
 * router.push so that any child (PortalLayout, AdminLayout, page skeletons)
 * can react immediately — before the server component even starts loading.
 *
 * Strategy:
 *  1. Intercept clicks on <a> elements via a document-level listener.
 *  2. Supplement with usePathname diffing so programmatic navigation
 *     (router.push, redirect) is also caught.
 *  3. A 120 ms micro-delay prevents flicker on instant cache hits.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

interface NavigationState {
  navigating: boolean;
  targetHref: string | null;
}

const NavigationContext = createContext<NavigationState>({
  navigating: false,
  targetHref: null,
});

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<NavigationState>({
    navigating: false,
    targetHref: null,
  });

  // Track last known pathname to detect when navigation resolves
  const prevPathname = useRef(pathname);
  // Timer to cancel flicker on near-instant cache hits
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startNavigation = useCallback((href: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 80 ms grace — if the page swaps faster than this, no shimmer shows
    debounceRef.current = setTimeout(() => {
      setState({ navigating: true, targetHref: href });
    }, 80);
  }, []);

  const stopNavigation = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setState({ navigating: false, targetHref: null });
  }, []);

  // Intercept anchor clicks (covers Link components)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only internal navigation
      const isInternal =
        href.startsWith("/") &&
        !href.startsWith("//") &&
        anchor.target !== "_blank" &&
        !anchor.hasAttribute("download");

      if (!isInternal) return;

      // Same-page hash links — skip
      if (href.split("?")[0].split("#")[0] === pathname) return;

      startNavigation(href);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, startNavigation]);

  // Detect when pathname actually changes → navigation complete
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      stopNavigation();
    }
  }, [pathname, stopNavigation]);

  return (
    <NavigationContext.Provider value={state}>
      {children}
    </NavigationContext.Provider>
  );
}
