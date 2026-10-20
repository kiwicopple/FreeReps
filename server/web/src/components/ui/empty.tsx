import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-4 px-6 py-12 text-center text-sm text-foreground-light",
        className,
      )}
      {...props}
    />
  );
}
