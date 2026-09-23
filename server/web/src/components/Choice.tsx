import {
  Children,
  isValidElement,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
  SelectGroup,
  SelectGroupLabel,
} from "./ui/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxCollection,
} from "./ui/combobox";
type Option = {
  value: string;
  label: string;
  group: string;
  disabled?: boolean;
};
function optionsFrom(children: ReactNode, group = ""): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        label?: string;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? ""),
          label: Children.toArray(child.props.children).join(""),
          group,
          disabled: child.props.disabled,
        },
      ];
    return optionsFrom(
      child.props.children,
      child.type === "optgroup" ? (child.props.label ?? "") : group,
    );
  });
}
/** A common composition for short choices and searchable, grouped metric lists. */
export default function Choice({
  children,
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
  children: ReactNode;
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
  const options = useMemo(() => optionsFrom(children), [children]);
  const groups = useMemo(
    () =>
      [...new Set(options.map((o) => o.group))].map((value) => ({
        value,
        items: options.filter((o) => o.group === value),
      })),
    [options],
  );
  const selected = options.find((o) => o.value === String(value)) ?? null;
  if (searchable)
    return (
      <div className={className} style={style}>
        <Combobox
          items={groups}
          value={selected}
          onValueChange={(item) => {
            if (item) onValueChange(item.value);
          }}
          isItemEqualToValue={(a, b) => a.value === b.value}
          disabled={disabled}
          required={required}
          name={name}
        >
          <ComboboxInput
            id={id}
            triggerProps={{ "aria-label": "Show options" }}
            {...label}
            placeholder="Search…"
          />
          <ComboboxPopup>
            <ComboboxEmpty>No matching options.</ComboboxEmpty>
            <ComboboxList>
              {(group: { value: string; items: Option[] }) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  {group.value && (
                    <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel>
                  )}
                  <ComboboxCollection>
                    {(item: Option) => (
                      <ComboboxItem
                        key={item.value}
                        value={item}
                        disabled={item.disabled}
                      >
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </div>
    );
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      items={options}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger id={id} className={className} style={style} {...label}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {groups.map((group) => (
          <SelectGroup key={group.value}>
            {group.value && <SelectGroupLabel>{group.value}</SelectGroupLabel>}
            {group.items.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                disabled={item.disabled}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}
