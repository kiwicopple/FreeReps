import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
} from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";
const FieldContext = createContext<{
  id: string;
  invalid?: boolean;
  error: string;
} | null>(null);
export const useField = () => useContext(FieldContext);
/** Keep native validation, exposing its message inline without a form-library dependency. */
export function Field({
  children,
  className,
  invalid,
  ...props
}: ComponentProps<"div"> & { invalid?: boolean }) {
  const id = useId();
  const [error, setError] = useState("");
  return (
    <FieldContext.Provider value={{ id, invalid: invalid || !!error, error }}>
      <div
        data-slot="field"
        data-invalid={invalid || !!error}
        className={cn("group/field flex w-full flex-col gap-2", className)}
        onInvalidCapture={(event) => {
          if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement
          )
            setError(event.target.validationMessage);
        }}
        onChangeCapture={(event) => {
          if (
            error &&
            (event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLTextAreaElement ||
              event.target instanceof HTMLSelectElement)
          )
            setError(event.target.validationMessage);
        }}
        {...props}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}
export function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof Label>) {
  const field = useField();
  return (
    <Label
      htmlFor={field?.id}
      data-slot="field-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm text-foreground-lighter", className)}
      {...props}
    />
  );
}
export function FieldError({
  className,
  match: _match,
  children,
  ...props
}: ComponentProps<"p"> & { match?: boolean }) {
  const field = useField();
  const message = children ?? field?.error;
  return message ? (
    <p
      id={field ? `${field.id}-error` : undefined}
      role="alert"
      data-slot="field-error"
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {message}
    </p>
  ) : null;
}
