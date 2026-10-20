import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Fieldset(props: ComponentProps<"fieldset">) {
  return <fieldset {...props} />;
}
export function FieldsetLegend({
  className,
  ...props
}: ComponentProps<"legend">) {
  return <legend className={cn("text-sm font-medium", className)} {...props} />;
}
