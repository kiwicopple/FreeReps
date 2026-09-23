import type { ReactNode } from "react";
import { useIsDesktop } from "../hooks/useMediaQuery";

interface Props {
  /** The active date or range, e.g. "Monday, 16 March 2026". */
  kicker: ReactNode;
  title: string;
  /** The range control, or on the dashboard the sync status and button. */
  actions?: ReactNode;
}

/**
 * Kicker line, then the h1, with the actions right-aligned on the same
 * baseline. The h1 drops from 34px to 30px below the phone breakpoint.
 */
export default function PageHeader({ kicker, title, actions }: Props) {
  const isDesktop = useIsDesktop();

  return (
    <div
      className="flex items-end justify-between gap-6 page-x"
      style={{
        paddingTop: isDesktop ? 22 : 16,
        paddingBottom: isDesktop ? 18 : 14,
      }}
    >
      <div>
        <div className="kick">{kicker}</div>
        <h1
          style={{
            fontSize: isDesktop ? 34 : 30,
            lineHeight: 1.05,
            letterSpacing: isDesktop ? "-0.025em" : "-0.03em",
            marginTop: 8,
          }}
        >
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex items-baseline gap-3.5 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
