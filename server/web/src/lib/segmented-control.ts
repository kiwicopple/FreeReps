/** Supabase-style segmented choices using Radix radio semantics. */
export const segmentedControlRootClassName =
  "inline-flex w-fit items-center gap-1 rounded-md border bg-surface-100 p-1";
export function segmentedControlItemVariants(_options?: { state?: string }) {
  return "relative inline-flex min-h-7 cursor-pointer items-center justify-center rounded-sm px-3 text-sm text-foreground-light transition-colors hover:text-foreground focus-ring disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:text-foreground";
}
