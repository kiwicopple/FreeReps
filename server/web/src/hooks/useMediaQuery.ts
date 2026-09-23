import { useMediaQuery } from "./use-media-query";
export { useMediaQuery } from "./use-media-query";
/** One app-level breakpoint, including coss responsive compositions. */
export const DESKTOP_QUERY = "(min-width: 768px)";
export function useIsDesktop(): boolean { return useMediaQuery(DESKTOP_QUERY); }
