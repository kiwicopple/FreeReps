import { createContext, useContext, type ComponentProps } from "react";
import * as UI from "./supabase-sheet";
import { cn } from "@/lib/utils";
import {
  renderChild,
  restoreFocus,
  type RenderProps,
  type FinalFocus,
} from "./overlay-composition";
const Closed = createContext<((open: boolean) => void) | undefined>(undefined);
export function Sheet({
  onOpenChangeComplete,
  children,
  ...props
}: ComponentProps<typeof UI.Sheet> & {
  onOpenChangeComplete?: (open: boolean) => void;
}) {
  return (
    <Closed.Provider value={onOpenChangeComplete}>
      <UI.Sheet {...props}>{children}</UI.Sheet>
    </Closed.Provider>
  );
}
export function SheetTrigger(
  props: ComponentProps<typeof UI.SheetTrigger> & RenderProps,
) {
  const { render, children, ...rest } = props;
  return (
    <UI.SheetTrigger {...rest} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.SheetTrigger>
  );
}
export function SheetClose(
  props: ComponentProps<typeof UI.SheetClose> & RenderProps,
) {
  const { render, children, ...rest } = props;
  return (
    <UI.SheetClose {...rest} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.SheetClose>
  );
}
export function SheetPopup({
  finalFocus,
  showCloseButton = true,
  className,
  ...props
}: ComponentProps<typeof UI.SheetContent> & {
  finalFocus?: FinalFocus;
  showCloseButton?: boolean;
}) {
  const closed = useContext(Closed);
  return (
    <UI.SheetContent
      {...props}
      aria-describedby={undefined}
      showClose={showCloseButton}
      size="content"
      data-slot="sheet-popup"
      className={cn("flex w-full max-w-lg flex-col gap-0", className)}
      onCloseAutoFocus={(event) => {
        restoreFocus(finalFocus, event);
        closed?.(false);
      }}
    />
  );
}
export const SheetHeader = UI.SheetHeader,
  SheetTitle = UI.SheetTitle,
  SheetDescription = UI.SheetDescription;
export function SheetPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <UI.SheetSection
      data-slot="sheet-panel"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        className,
      )}
      {...props}
    />
  );
}
export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <UI.SheetFooter
      className={cn(
        "shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}
