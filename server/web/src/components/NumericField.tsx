import type { CSSProperties } from "react";
import { Input } from "./ui/input";
/** Null is the editable empty state; callers decide when a value is required. */
export default function NumericField({
  value,
  onValueChange,
  min,
  max,
  step,
  required,
  disabled,
  id,
  placeholder,
  className,
  style,
  "aria-label": label,
}: {
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  return (
    <Input
      id={id}
      type="number"
      value={value ?? ""}
      onChange={(event) =>
        onValueChange(
          event.currentTarget.value === ""
            ? null
            : event.currentTarget.valueAsNumber,
        )
      }
      min={min}
      max={max}
      step={step ?? "any"}
      required={required}
      disabled={disabled}
      aria-label={label}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}
