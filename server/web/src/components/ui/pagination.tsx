import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex justify-center", className)}
      {...props}
    />
  );
}
export function PaginationContent({
  className,
  ...props
}: ComponentProps<"ul">) {
  return <ul className={cn("flex items-center gap-2", className)} {...props} />;
}
export function PaginationItem(props: ComponentProps<"li">) {
  return <li {...props} />;
}
