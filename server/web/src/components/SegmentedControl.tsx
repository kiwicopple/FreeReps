import type { ReactNode } from "react";
import { RadioGroupPrimitive, RadioPrimitive } from "./ui/radio-group";
import { segmentedControlRootClassName, segmentedControlItemVariants } from "@/lib/segmented-control";
export default function SegmentedControl<T extends string>({ options, value, onChange, name, label }: {
  options: readonly { value: T; label: ReactNode }[]; value: T;
  onChange: (value: T) => void; name?: string; label: string;
}) {
  return <RadioGroupPrimitive name={name} aria-label={label} value={value} onValueChange={onChange} className={segmentedControlRootClassName}>
    {options.map(option => <RadioPrimitive.Root key={option.value} value={option.value} className={segmentedControlItemVariants({state:"checked"})}>{option.label}</RadioPrimitive.Root>)}
  </RadioGroupPrimitive>;
}
