import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "../../hooks/useMediaQuery";

/** Inline details on desktop; a modal, independently scrolling sheet on phones. */
export default function ResponsiveDetails({ title, className, children }: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const parts = Children.toArray(children);
  const summary = parts[0];
  const label = isValidElement<{ children?: ReactNode }>(summary) ? summary.props.children : summary;

  useEffect(() => {
    if (desktop) setOpen(false);
  }, [desktop]);

  useEffect(() => {
    if (!open || desktop) return;
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open, desktop]);

  if (desktop) return <details className={className}>{children}</details>;

  return (
    <>
      <div className={className}>
        <button ref={trigger} type="button" className="nutrition-sheet-trigger"
          aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          {label}
        </button>
      </div>
      {open && createPortal(
        <dialog ref={dialog} className="nutrition-sheet nutrition-page"
          aria-labelledby={heading} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false);
          }}>
          <header className="nutrition-sheet-header">
            <h2 id={heading}>{title}</h2>
            <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={`Close ${title}`}>Close</button>
          </header>
          <div className="nutrition-sheet-body" onClick={(event) => {
            // A trend action navigates away from these details.
            if ((event.target as HTMLElement).closest("button[data-sheet-close]")) setOpen(false);
          }}>{parts.slice(1)}</div>
        </dialog>, document.body
      )}
    </>
  );
}
