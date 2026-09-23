import type { ReactNode } from "react";

export default function PageHeader({
  kicker,
  title,
  actions,
}: {
  kicker: ReactNode;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-x flex flex-wrap items-end justify-between gap-4 py-6">
      <div className="min-w-0">
        <div className="kick">{kicker}</div>
        <h1 className="mt-2 text-3xl leading-tight tracking-tight md:text-[34px]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}
