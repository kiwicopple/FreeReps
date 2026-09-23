import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "../ui/collapsible";
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
const CloseDetails = createContext<() => void>(() => {});

/** Metric cards use sheets at every width; compact rows keep independent desktop expansion. */
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
  children: ReactNode | ((close: () => void) => ReactNode);
  card?: boolean;
}) {
  const closeParent = useContext(CloseDetails);
  const closeStack = () => {
    setOpen(false);
    closeParent();
  };
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [desktop]);
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
  if (desktop && !card)
    return (
      <Collapsible className={className} open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger render={trigger}>{label}</CollapsibleTrigger>
        <CollapsiblePanel>{content}</CollapsiblePanel>
      </Collapsible>
    );
  return (
    <Drawer
      position={desktop ? "right" : "bottom"}
      open={open}
      onOpenChange={setOpen}
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
      <DrawerPopup
        showBar={!desktop}
        className={
          desktop
            ? "nutrition-page h-full max-h-dvh max-w-lg"
            : "nutrition-page max-h-[90dvh]"
        }
      >
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
