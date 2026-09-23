import { useState, type CSSProperties, type ReactElement } from "react";
import { CalendarIcon } from "lucide-react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Field, FieldLabel, FieldDescription, FieldError } from "./ui/field";
import { Popover, PopoverTrigger, PopoverPopup } from "./ui/popover";
import {
  Drawer,
  DrawerTrigger,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
  DrawerFooter,
  DrawerClose,
} from "./ui/drawer";
/** Calendar values are local date-only strings. Never serialize a day through UTC. */
export function calendarDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localDate(value?: string) {
  return value ? new Date(`${value}T12:00:00`) : undefined;
}
export function validCalendarDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    calendarDay(localDate(value)!) === value
  );
}
type DateProps = {
  value: string;
  onValueChange: (day: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  "aria-label"?: string;
};
export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  disabled,
  trigger,
  "aria-label": label = "Date",
}: DateProps & { trigger?: ReactElement }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(value);
      setError("");
    }
  }
  function apply(day: string) {
    if (!validCalendarDay(day)) {
      setError("Enter a valid date in YYYY-MM-DD format.");
      return;
    }
    if ((min && day < min) || (max && day > max)) {
      setError(
        `Choose a date${min ? ` on or after ${min}` : ""}${max ? ` on or before ${max}` : ""}.`,
      );
      return;
    }
    onValueChange(day);
    setOpen(false);
  }
  const content = (
    <div className="mx-auto w-fit max-w-full space-y-4">
      <Calendar
        mode="single"
        selected={localDate(value)}
        defaultMonth={localDate(value)}
        disabled={[
          ...(min ? [{ before: localDate(min)! }] : []),
          ...(max ? [{ after: localDate(max)! }] : []),
        ]}
        onSelect={(date) => {
          if (date) apply(calendarDay(date));
        }}
      />
      <Field invalid={!!error}>
        <FieldLabel>Enter date</FieldLabel>
        <FieldDescription>YYYY-MM-DD</FieldDescription>
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder="YYYY-MM-DD"
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply(draft);
              }
            }}
          />
          <Button type="button" onClick={() => apply(draft)}>
            Apply
          </Button>
        </div>
        {error && <FieldError match>{error}</FieldError>}
      </Field>
    </div>
  );
  const button = trigger ?? (
    <Button
      variant="outline"
      size="icon"
      disabled={disabled}
      aria-label={`Choose ${label.toLowerCase()}`}
    >
      <CalendarIcon />
    </Button>
  );
  return desktop ? (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={button} />
      <PopoverPopup aria-label={label}>{content}</PopoverPopup>
    </Popover>
  ) : (
    <Drawer open={open} onOpenChange={changeOpen}>
      <DrawerTrigger render={button} />
      <DrawerPopup showBar>
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel>{content}</DrawerPanel>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
/** Editable form dates retain native validation and blank/required semantics. */
export default function DateControl({
  value,
  onValueChange,
  min,
  max,
  required,
  disabled,
  id,
  className,
  style,
  "aria-label": label = "Date",
}: DateProps & {
  required?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${className ?? ""}`}
      style={style}
    >
      <Input
        id={id}
        aria-label={label}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className="date-entry min-w-0 flex-1"
      />
      <DatePicker
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
