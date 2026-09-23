import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function SummaryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] md:gap-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
/** Formatted values stay with the caller so presentation cannot change calculations. */
export default function SummaryValue({
  label,
  value,
  unit,
  detail,
  status,
  sparkline,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  status?: ReactNode;
  sparkline?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="num flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-bold text-3xl tracking-tight md:text-4xl">
        {value ?? "—"}
        {unit && (
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {status && <div className="text-sm">{status}</div>}
      {detail && (
        <div className="text-xs leading-relaxed text-muted-foreground">
          {detail}
        </div>
      )}
      {sparkline}
    </div>
  );
}
