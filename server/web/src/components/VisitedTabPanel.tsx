import { useEffect, useState, type ReactNode } from "react";
import { TabsPanel } from "./ui/tabs";

/** Visit lazily, then keep drafts in memory while inactive panels remain hidden. */
export default function VisitedTabPanel({
  active,
  value,
  children,
  className,
  label,
}: {
  active: string;
  value: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [visited, setVisited] = useState(active === value);
  useEffect(() => {
    if (active === value) setVisited(true);
  }, [active, value]);
  return visited || active === value ? (
    <TabsPanel
      keepMounted
      hidden={active !== value}
      inert={active !== value}
      value={value}
      className={className}
      aria-label={label}
    >
      {children}
    </TabsPanel>
  ) : null;
}
