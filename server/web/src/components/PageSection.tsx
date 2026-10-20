import { useId, type ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { cn } from "../lib/utils";

/** A labelled Supabase card, with a flush body for tables and lists. */
export default function PageSection({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  table = false,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  table?: boolean;
  className?: string;
  id?: string;
}) {
  const heading = useId();
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={heading}
      className={cn("min-w-0", className)}
    >
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <h2 id={heading} className="text-sm font-medium">
              {title}
            </h2>
            {description && (
              <CardDescription className="max-w-prose [&_a]:underline">
                {description}
              </CardDescription>
            )}
          </div>
          {actions && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </CardHeader>
        <CardContent className={cn("min-w-0", (flush || table) && "p-0")}>
          {children}
        </CardContent>
        {footer && (
          <CardFooter className="flex flex-wrap items-center gap-3">
            {footer}
          </CardFooter>
        )}
      </Card>
    </section>
  );
}
