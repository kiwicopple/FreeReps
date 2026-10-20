import { useCallback, useSyncExternalStore } from "react";
/** One breakpoint for navigation and responsive interaction surfaces. */
export const DESKTOP_QUERY = "(min-width: 768px)";
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query],
  );
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY);
}
