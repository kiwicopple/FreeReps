import { useId, type ReactNode } from "react";
import {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameDescription,
  CardFrameFooter,
} from "./ui/card";
import { cn } from "../lib/utils";

/** A section owns its heading and spacing; its callers own the content and behavior. */
export default function PageSection({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  const heading = useId();
  return (
    <CardFrame
      render={<section id={id} aria-labelledby={heading} />}
      className={cn("min-w-0", className)}
    >
      <CardFrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="min-w-0 space-y-1">
          <CardFrameTitle render={<h2 id={heading} />} className="text-base">
            {title}
          </CardFrameTitle>
          {description && (
            <CardFrameDescription className="max-w-prose [&_a]:underline [&_a]:underline-offset-2">
              {description}
            </CardFrameDescription>
          )}
        </div>
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </CardFrameHeader>
      <Card className={cn("min-w-0", !flush && "p-4 md:p-6")}>{children}</Card>
      {footer && (
        <CardFrameFooter className="px-4 md:px-6">{footer}</CardFrameFooter>
      )}
    </CardFrame>
  );
}
