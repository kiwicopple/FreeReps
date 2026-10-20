import { useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "./ui/select";
import { Popover, PopoverTrigger, PopoverPopup } from "./ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./ui/supabase-command";
import { Button } from "./ui/button";
import { useField } from "./ui/field";
export type ChoiceOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};
export default function Choice({
  options,
  value,
  onValueChange,
  searchable = false,
  className,
  style,
  id,
  disabled,
  required,
  name,
  ...label
}: {
  options: readonly ChoiceOption[];
  value: string | number;
  onValueChange: (value: string) => void;
  searchable?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const field = useField();
  const groups = useMemo(
    () =>
      [...new Set(options.map((o) => o.group ?? ""))].map((group) => ({
        group,
        items: options.filter((o) => (o.group ?? "") === group),
      })),
    [options],
  );
  const selected = options.find((o) => o.value === String(value));
  if (searchable)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id ?? field?.id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              {...label}
              className={className}
              style={style}
            />
          }
        >
          {selected?.label ?? "Select…"}
          <ChevronsUpDown aria-hidden />
        </PopoverTrigger>
        <PopoverPopup className="w-[max(260px,var(--radix-popover-trigger-width))] max-w-[calc(100vw-32px)] p-0">
          <Command>
            <CommandInput
              aria-label={
                label["aria-label"]
                  ? `Search ${label["aria-label"]}`
                  : "Search options"
              }
              placeholder="Search…"
            />
            <CommandList>
              <CommandEmpty>No matching options.</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.group} heading={g.group || undefined}>
                  {g.items.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.label}
                      disabled={item.disabled}
                      onSelect={() => {
                        onValueChange(item.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        aria-hidden
                        className={
                          item.value === String(value)
                            ? "size-4"
                            : "invisible size-4"
                        }
                      />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverPopup>
      </Popover>
    );
  // Radix reserves the empty string for no selection, so encode a blank option locally.
  const empty = "__protocol_empty__";
  return (
    <Select
      value={String(value) || empty}
      onValueChange={(next) => onValueChange(next === empty ? "" : next)}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        id={id ?? field?.id}
        className={className}
        style={style}
        {...label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectGroup key={g.group}>
            {g.group && <SelectLabel>{g.group}</SelectLabel>}
            {g.items.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value || empty}
                disabled={item.disabled}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
