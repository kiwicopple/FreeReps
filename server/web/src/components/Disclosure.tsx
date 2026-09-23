import type { ReactNode, CSSProperties } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "./ui/collapsible";
import { Button } from "./ui/button";
/** Independent disclosure; content stays mounted to preserve form drafts. */
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
  return (
    <Collapsible className={className} style={style}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto justify-start whitespace-normal text-left"
          />
        }
      >
        {trigger}
      </CollapsibleTrigger>
      <CollapsiblePanel keepMounted>{children}</CollapsiblePanel>
    </Collapsible>
  );
}
