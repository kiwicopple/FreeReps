import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Group({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button+button]:border-l-0",
        className,
      )}
      {...props}
    />
  );
}
