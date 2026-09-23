import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

/** The measured content width drives panels independently of the sidebar. */
export default function PageContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("page-content page-x", className)} {...props} />;
}
