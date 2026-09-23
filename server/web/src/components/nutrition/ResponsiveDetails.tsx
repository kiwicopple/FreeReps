import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  Sheet,
  SheetTrigger,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
  SheetClose,
} from "../ui/sheet";
import {
  Drawer,
  DrawerTrigger,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
  DrawerFooter,
  DrawerClose,
} from "../ui/drawer";
type CloseDetail = (afterClose?: () => void) => void;
const CloseDetails = createContext<CloseDetail | null>(null);

/** All nutrition details share modal scrolling, nested closure and focus restoration. */
export default function ResponsiveDetails({
  title,
  className,
  trigger: label,
  children,
  card = false,
}: {
  title: string;
  className?: string;
  trigger: ReactNode;
  children: ReactNode | ((close: CloseDetail) => ReactNode);
  card?: boolean;
}) {
  const closeParent = useContext(CloseDetails);
  const afterClosed = useRef<(() => void) | undefined>(undefined);
  const closeStack: CloseDetail = (afterClose) => {
    setOpen(false);
    if (closeParent) closeParent(afterClose);
    else afterClosed.current = afterClose;
  };
  const onOpenChangeComplete = (next: boolean) => {
    if (!next && afterClosed.current) {
      const action = afterClosed.current;
      afterClosed.current = undefined;
      action();
    }
  };
  const desktop = useIsDesktop();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [desktop, location.pathname, location.search]);
  const trigger = card ? (
    <Card
      className="summary-card nutrition-detail-trigger"
      render={
        <Button
          variant="ghost"
          className="h-auto w-full whitespace-normal text-left"
        />
      }
    />
  ) : (
    <Button
      variant="ghost"
      className="nutrition-detail-trigger h-auto w-full justify-start whitespace-normal p-0 text-left"
    />
  );
  const content = (
    <CloseDetails.Provider value={closeStack}>
      {typeof children === "function" ? children(closeStack) : children}
    </CloseDetails.Provider>
  );
  if (desktop)
    return (
      <Sheet
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        <div className={className}>
          <SheetTrigger render={trigger}>
            {label}
            {card && (
              <ChevronRight
                aria-hidden
                className="absolute right-5 top-5 size-4 text-muted-foreground"
              />
            )}
          </SheetTrigger>
        </div>
        <SheetPopup className="nutrition-page max-w-lg" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <SheetPanel>{content}</SheetPanel>
          <SheetFooter>
            <SheetClose
              aria-label={`Close ${title}`}
              render={<Button variant="outline" />}
            >
              Close
            </SheetClose>
          </SheetFooter>
        </SheetPopup>
      </Sheet>
    );
  return (
    <Drawer
      position="bottom"
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <div className={className}>
        <DrawerTrigger render={trigger}>
          {label}
          {card && (
            <ChevronRight
              aria-hidden
              className="absolute right-4 top-4 size-4 text-muted-foreground md:right-5 md:top-5"
            />
          )}
        </DrawerTrigger>
      </div>
      <DrawerPopup showBar className="nutrition-page max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel>{content}</DrawerPanel>
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
