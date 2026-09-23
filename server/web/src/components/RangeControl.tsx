import { useEffect, useState, type ReactNode } from "react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import SegmentedControl from "./SegmentedControl";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerTrigger,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
  DrawerFooter,
  DrawerClose,
} from "./ui/drawer";
import { RadioGroup, Radio } from "./ui/radio-group";
const LONG_LABEL: Record<string, string> = {
  "1d": "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "1y": "Last year",
};
export default function RangeControl<T extends string>({
  options,
  value,
  onChange,
  name,
  note,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  name?: string;
  note?: ReactNode;
}) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (desktop) setOpen(false);
  }, [desktop]);
  if (desktop)
    return (
      <SegmentedControl
        label="Range"
        name={name}
        options={options.map((value) => ({ value, label: value }))}
        value={value}
        onChange={onChange}
      />
    );
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="outline" />}>
        {LONG_LABEL[value] ?? value}
      </DrawerTrigger>
      <DrawerPopup showBar>
        <DrawerHeader>
          <DrawerTitle>Range</DrawerTitle>
          <DrawerDescription>
            {note ?? "Choose the period to display."}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <RadioGroup
            name={name}
            aria-label="Range"
            value={value}
            onValueChange={(next) => {
              onChange(next as T);
              setOpen(false);
            }}
          >
            {options.map((option) => (
              <label key={option} className="flex items-center gap-3 py-3">
                <Radio value={option} />
                {LONG_LABEL[option] ?? option}
              </label>
            ))}
          </RadioGroup>
        </DrawerPanel>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
