import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    render?: React.ReactElement<{ children?: React.ReactNode }>;
  }
>(({ className, render, children, ...props }, ref) => {
  const Comp = render ? Slot.Root : "div";
  return (
    <Comp
      ref={ref}
      className={cn(
        "overflow-hidden rounded-lg border bg-surface-100 text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    >
      {render
        ? React.cloneElement(
            render,
            undefined,
            children ?? render.props.children,
          )
        : children}
    </Comp>
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 py-4 px-(--card-padding-x) border-b",
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xs font-mono uppercase", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-foreground-lighter", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "py-4 px-(--card-padding-x) border-b last:border-none",
      className,
    )}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center py-4 px-(--card-padding-x)", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};

export { CardContent as CardPanel };
