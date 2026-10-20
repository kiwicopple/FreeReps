import { useField } from "./field";
import { cva, VariantProps } from "class-variance-authority";
import * as React from "react";

import { SIZE_VARIANTS, SIZE_VARIANTS_DEFAULT } from "@/lib/supabase/constants";
import { cn } from "@/lib/utils";

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof InputVariants> {
  nativeInput?: boolean;
  unstyled?: boolean;
}

export const InputVariants = cva(
  cn(
    "flex h-10 w-full rounded-md border border-control hover:border-control-hover read-only:border-button bg-field px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground-muted read-only:text-foreground-light",
    "focus:border-control-hover focus-ring disabled:cursor-not-allowed disabled:text-foreground-muted transition-colors duration-200",
    "aria-[invalid=true]:bg-destructive-200 aria-[invalid=true]:border-destructive-400 aria-[invalid=true]:hover:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus-visible:border-destructive",
  ),
  {
    variants: {
      size: {
        ...SIZE_VARIANTS,
      },
    },
    defaultVariants: {
      size: SIZE_VARIANTS_DEFAULT,
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      size = "small",
      nativeInput: _nativeInput,
      unstyled: _unstyled,
      ...props
    },
    ref,
  ) => {
    const field = useField();
    return (
      <input
        type={type}
        ref={ref}
        {...props}
        id={props.id ?? field?.id}
        aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
        aria-describedby={
          props["aria-describedby"] ??
          (field?.error ? `${field.id}-error` : undefined)
        }
        className={cn(InputVariants({ size }), className)}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
