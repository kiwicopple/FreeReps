import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
/** A measurement (not task progress); clamp the fill while retaining the caller's full accessible description. */
export function Meter({
  value,
  max = 100,
  min = 0,
  getAriaValueText,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  value: number;
  max?: number;
  min?: number;
  getAriaValueText?: () => string;
}) {
  const fill = Math.max(0, Math.min(100, (100 * (value - min)) / (max - min)));
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={getAriaValueText?.()}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        data-slot="meter-indicator"
        className="h-full bg-primary transition-transform motion-reduce:transition-none"
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}
