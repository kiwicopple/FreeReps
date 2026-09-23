import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Apple,
  BedDouble,
  Dumbbell,
  ChartNoAxesCombined,
  GitCompareArrows,
  TrendingUp,
  Settings,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { fetchMe } from "../api";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipPopup,
} from "./ui/tooltip";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import {
  Drawer,
  DrawerTrigger,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
  DrawerClose,
  DrawerFooter,
} from "./ui/drawer";

const PRIMARY = [
  { to: "/", label: "Today", icon: Activity, end: true },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
  { to: "/sleep", label: "Sleep", icon: BedDouble },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/trends", label: "Trends", icon: TrendingUp },
];
const ANALYSIS = [
  { to: "/metrics", label: "Metrics", icon: ChartNoAxesCombined },
  { to: "/correlations", label: "Correlations", icon: GitCompareArrows },
];
const SETTINGS = { to: "/settings", label: "Settings", icon: Settings };
const MOBILE = [PRIMARY[0], PRIMARY[2], PRIMARY[3], PRIMARY[1]];
const SIDEBAR_KEY = "protocol.sidebar.collapsed";

export default function Layout({ children }: { children: ReactNode }) {
  const desktop = useIsDesktop();
  const location = useLocation();
  const [more, setMore] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 300000,
  });
  useEffect(() => setMore(false), [location.pathname, desktop]);
  const toggle = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, String(!current));
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
      return !current;
    });
  const navItem = (item: (typeof PRIMARY)[number]) => (
    <Tooltip key={item.to}>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            className="sidebar-link"
            render={<NavLink to={item.to} end={item.end} />}
          />
        }
      >
        <item.icon aria-hidden className="size-5 shrink-0" />
        <span className="sidebar-label">{item.label}</span>
      </TooltipTrigger>
      <TooltipPopup side="right">{item.label}</TooltipPopup>
    </Tooltip>
  );
  return (
    <TooltipProvider>
      <div className="app-shell" data-collapsed={collapsed}>
        {desktop && (
          <aside className="app-sidebar" aria-label="Application sidebar">
            <Link to="/" className="sidebar-brand" aria-label="Protocol home">
              <span aria-hidden className="sidebar-mark">
                P
              </span>
              <span className="sidebar-label">Protocol</span>
            </Link>
            <ScrollArea className="min-h-0 flex-1">
              <nav aria-label="Main navigation" className="space-y-1 px-2">
                {PRIMARY.map(navItem)}
                <Separator className="my-4" />
                <p className="sidebar-label px-3 pb-2 text-xs text-muted-foreground">
                  Analysis
                </p>
                {ANALYSIS.map(navItem)}
              </nav>
            </ScrollArea>
            <div className="space-y-2 border-t p-2">
              {navItem(SETTINGS)}
              <p className="sidebar-label truncate px-3 text-xs text-muted-foreground">
                {user?.display_name || user?.login}
              </p>
              <Button
                variant="ghost"
                className="sidebar-toggle w-full justify-start"
                onClick={toggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                <span className="sidebar-label">Collapse sidebar</span>
              </Button>
            </div>
          </aside>
        )}
        <main className="app-main">{children}</main>
        {!desktop && (
          <nav className="mobile-nav" aria-label="Main navigation">
            {MOBILE.map((item) => (
              <Button
                key={item.to}
                variant="ghost"
                className="mobile-nav-item"
                render={<NavLink to={item.to} end={item.end} />}
              >
                <item.icon aria-hidden />
                <span>{item.label}</span>
              </Button>
            ))}
            <Drawer open={more} onOpenChange={setMore}>
              <DrawerTrigger
                render={
                  <Button
                    variant="ghost"
                    className="mobile-nav-item"
                    data-active={
                      more ||
                      ["/settings", "/trends"].includes(location.pathname)
                    }
                  />
                }
              >
                <MoreHorizontal aria-hidden />
                <span>More</span>
              </DrawerTrigger>
              <DrawerPopup showBar>
                <DrawerHeader>
                  <DrawerTitle>More</DrawerTitle>
                </DrawerHeader>
                <DrawerPanel className="space-y-2">
                  {[PRIMARY[4], SETTINGS].map((item) => (
                    <Button
                      key={item.to}
                      variant="ghost"
                      className="w-full justify-start"
                      render={<Link to={item.to} />}
                      onClick={() => setMore(false)}
                    >
                      <item.icon aria-hidden />
                      {item.label}
                    </Button>
                  ))}
                </DrawerPanel>
                <DrawerFooter>
                  <DrawerClose render={<Button variant="outline" />}>
                    Close
                  </DrawerClose>
                </DrawerFooter>
              </DrawerPopup>
            </Drawer>
          </nav>
        )}
      </div>
    </TooltipProvider>
  );
}
