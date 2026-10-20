import { cloneElement, type ReactElement } from "react";
import {
  Button as StudioButton,
  type ButtonProps as StudioButtonProps,
  buttonVariants as studioVariants,
} from "./studio-button";
import { cn } from "@/lib/utils";

const variants = {
  default: "primary",
  secondary: "default",
  outline: "outline",
  ghost: "text",
  link: "link",
  destructive: "danger",
  "destructive-outline": "outline",
} as const;
const sizes = {
  default: "small",
  sm: "tiny",
  xs: "tiny",
  lg: "medium",
  xl: "large",
  icon: "small",
  "icon-sm": "tiny",
  "icon-xs": "tiny",
  "icon-lg": "medium",
  "icon-xl": "large",
} as const;
export interface ButtonProps extends Omit<
  StudioButtonProps,
  "variant" | "size" | "loading"
> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
  render?: ReactElement<{ children?: React.ReactNode }>;
}
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cn(
    studioVariants({ variant: variants[variant], size: sizes[size] }),
    size.startsWith("icon") && "aspect-square px-2",
    className,
  );
}
/** Maps application action semantics onto the upstream Studio button. */
export function Button({
  variant = "default",
  size = "default",
  render,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <StudioButton
      {...props}
      data-slot="button"
      variant={variants[variant]}
      size={sizes[size]}
      asChild={!!render || props.asChild}
      className={cn(
        "gap-2 [&_svg]:size-4 [&_svg]:shrink-0",
        size.startsWith("icon") && "aspect-square px-2",
        variant === "destructive-outline" && "text-destructive",
        className,
      )}
    >
      {render
        ? cloneElement(render, undefined, children ?? render.props.children)
        : children}
    </StudioButton>
  );
}
