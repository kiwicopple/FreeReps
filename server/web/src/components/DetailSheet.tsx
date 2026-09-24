import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
  SheetClose,
} from "./ui/sheet";
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
  DrawerFooter,
  DrawerClose,
} from "./ui/drawer";

/** A controlled detail surface for triggers that live in cards, lists or tables. */
export default function DetailSheet({
  title,
  open,
  onOpenChange,
  returnFocus,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const location = useLocation();
  useEffect(() => {
    onOpenChange(false);
  }, [desktop, location.pathname, location.search, onOpenChange]);
  const finalFocus = () => (returnFocus?.isConnected ? returnFocus : false);
  if (desktop)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetPopup
          className="max-w-lg"
          showCloseButton={false}
          finalFocus={finalFocus}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <SheetPanel>{children}</SheetPanel>
          <SheetFooter>
            <SheetClose
              render={<Button variant="outline" />}
              aria-label={`Close ${title}`}
            >
              Close
            </SheetClose>
          </SheetFooter>
        </SheetPopup>
      </Sheet>
    );
  return (
    <Drawer position="bottom" open={open} onOpenChange={onOpenChange}>
      <DrawerPopup showBar className="max-h-[90dvh]" finalFocus={finalFocus}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel>{children}</DrawerPanel>
        <DrawerFooter>
          <DrawerClose
            render={<Button variant="outline" />}
            aria-label={`Close ${title}`}
          >
            Close
          </DrawerClose>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
