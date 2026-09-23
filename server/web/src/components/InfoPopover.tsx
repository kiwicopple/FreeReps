import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverPopup } from "./ui/popover";

export default function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} />}
      >
        <Info />
      </PopoverTrigger>
      <PopoverPopup className="max-w-sm p-4 text-sm leading-relaxed">
        {children}
      </PopoverPopup>
    </Popover>
  );
}
