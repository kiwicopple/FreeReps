import type { ReactNode } from "react";

export default function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-x flex flex-col gap-4 py-6">
      <div className="flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-3xl leading-tight tracking-tight md:text-[34px]">
          {title}
        </h1>
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
