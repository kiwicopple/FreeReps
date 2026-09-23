import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Group } from "./ui/group";
import { DatePicker } from "./DateControl";

export default function DateNavigator({
  value,
  onValueChange,
  onPrevious,
  onNext,
  onReset,
  resetLabel,
  previousDisabled,
  nextDisabled,
  min,
  max,
  label,
}: {
  value: string;
  onValueChange: (day: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
  resetLabel: "Today" | "Latest";
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  min?: string;
  max?: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={`${label} navigation`}
    >
      <Group aria-label={label}>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          disabled={previousDisabled}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </Button>
        <DatePicker
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          aria-label={label}
          trigger={
            <Button
              variant="outline"
              aria-label={`Choose ${label.toLowerCase()}`}
            >
              <CalendarIcon />
              {value}
            </Button>
          }
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={nextDisabled}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </Group>
      <Button variant="ghost" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}
