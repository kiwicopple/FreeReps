import { useState, type ReactNode, type CSSProperties } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import { Button } from "./ui/button";
/** Keep drafts mounted while closed; hidden content cannot receive focus. */
export default function Disclosure({
  trigger,
  children,
  className,
  style,
}: {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={className}
      style={style}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto justify-start whitespace-normal text-left"
        >
          {trigger}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount hidden={!open}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
