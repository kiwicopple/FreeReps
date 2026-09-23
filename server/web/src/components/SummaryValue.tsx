import { Skeleton } from "./ui/skeleton";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Card } from "./ui/card";

export function SummaryGrid({
  children,
  className,
  label = "Key metrics",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] md:gap-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
/** Formatted values stay with the caller so presentation cannot change calculations. */
export function SummaryContent({
  label,
  value,
  unit,
  detail,
  status,
  sparkline,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  status?: ReactNode;
  sparkline?: ReactNode;
}) {
  return (
    <>
      <span
        data-slot="summary-label"
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </span>
      <span
        data-slot="summary-value"
        className="num flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-bold text-2xl leading-tight tracking-tight md:text-3xl"
      >
        {value ?? "—"}
        {unit && (
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            {" "}
            {unit}
          </span>
        )}
      </span>
      {status && <span className="flex flex-col gap-2 text-sm">{status}</span>}
      {detail && (
        <span className="text-xs leading-relaxed text-muted-foreground">
          {detail}
        </span>
      )}
      {sparkline && (
        <span className="mt-auto block w-full pt-3">{sparkline}</span>
      )}
    </>
  );
}

export default function SummaryValue({
  className,
  ...props
}: Parameters<typeof SummaryContent>[0] & { className?: string }) {
  return (
    <Card className={cn("summary-card", className)}>
      <SummaryContent {...props} />
    </Card>
  );
}

export function SummarySkeleton({ count = 4 }: { count?: number }) {
  return (
    <SummaryGrid label="Loading key metrics">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="summary-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="my-2 h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </SummaryGrid>
  );
}
