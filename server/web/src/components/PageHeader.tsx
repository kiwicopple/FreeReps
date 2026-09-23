import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--page-header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--page-header-height");
    };
  }, []);
  return (
    <header ref={header} className="page-header">
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-3">
        <div className="flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 break-words text-2xl leading-tight tracking-tight">
            {title}
          </h1>
          {actions && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}
