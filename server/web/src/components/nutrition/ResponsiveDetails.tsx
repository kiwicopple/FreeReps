import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { Button } from "../ui/button";
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

/** Nutrition content expands independently on desktop and stacks in scrolling mobile drawers. */
export default function ResponsiveDetails({
  title,
  className,
  trigger: label,
  children,
}: {
  title: string;
  className?: string;
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
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
  const trigger = (
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
      <Collapsible className={className} open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger render={trigger}>{label}</CollapsibleTrigger>
        <CollapsiblePanel>{content}</CollapsiblePanel>
      </Collapsible>
    );
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div className={className}>
        <DrawerTrigger render={trigger}>{label}</DrawerTrigger>
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
