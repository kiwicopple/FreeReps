import {
  createContext,
  useContext,
  useRef,
  type RefObject,
  type ComponentProps,
} from "react";
import { Drawer as Primitive } from "vaul";
import * as UI from "./supabase-drawer";
import { cn } from "@/lib/utils";
import {
  renderChild,
  restoreFocus,
  type RenderProps,
  type FinalFocus,
} from "./overlay-composition";
const Closed = createContext<((open: boolean) => void) | undefined>(undefined);
const TriggerTarget = createContext<RefObject<HTMLElement | null> | null>(null);
const Nested = createContext(false);
export function Drawer({
  position = "bottom",
  onOpenChangeComplete,
  children,
  ...props
}: ComponentProps<typeof UI.Drawer> & {
  position?: "bottom";
  onOpenChangeComplete?: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLElement | null>(null);
  const nested = useContext(Nested);
  const Root = nested ? Primitive.NestedRoot : UI.Drawer;
  return (
    <Root
      autoFocus
      {...props}
      direction={position}
      onAnimationEnd={onOpenChangeComplete}
      repositionInputs={false}
    >
      <TriggerTarget.Provider value={trigger}>
        <Closed.Provider value={onOpenChangeComplete}>
          <Nested.Provider value>{children}</Nested.Provider>
        </Closed.Provider>
      </TriggerTarget.Provider>
    </Root>
  );
}
export function DrawerTrigger({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.DrawerTrigger> & RenderProps) {
  const target = useContext(TriggerTarget);
  return (
    <UI.DrawerTrigger
      {...props}
      onClick={(event) => {
        if (target) target.current = event.currentTarget;
        props.onClick?.(event);
      }}
      asChild={!!render}
    >
      {renderChild({ render, children })}
    </UI.DrawerTrigger>
  );
}
export function DrawerClose({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.DrawerClose> & RenderProps) {
  return (
    <UI.DrawerClose {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.DrawerClose>
  );
}
export function DrawerPopup({
  showBar: _bar,
  finalFocus,
  className,
  ...props
}: ComponentProps<typeof UI.DrawerContent> & {
  showBar?: boolean;
  finalFocus?: FinalFocus;
}) {
  const closed = useContext(Closed);
  const target = useContext(TriggerTarget);
  return (
    <UI.DrawerContent
      {...props}
      aria-describedby={undefined}
      data-slot="drawer-popup"
      className={cn("max-h-[90dvh]", className)}
      onCloseAutoFocus={(event) => {
        restoreFocus(finalFocus ?? target ?? undefined, event);
        closed?.(false);
      }}
    />
  );
}
export const DrawerHeader = UI.DrawerHeader,
  DrawerTitle = UI.DrawerTitle,
  DrawerDescription = UI.DrawerDescription;
export function DrawerPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-panel"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}
export function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <UI.DrawerFooter
      className={cn(
        "shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}
