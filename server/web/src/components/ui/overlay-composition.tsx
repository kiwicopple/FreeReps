import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
export type RenderProps = {
  render?: ReactElement<{ children?: ReactNode }>;
  children?: ReactNode;
};
export function renderChild({ render, children }: RenderProps) {
  return render
    ? cloneElement(render, undefined, children ?? render.props.children)
    : children;
}
export type FinalFocus =
  (() => HTMLElement | false | null) | RefObject<HTMLElement | null>;
export function restoreFocus(target: FinalFocus | undefined, event: Event) {
  if (!target) return;
  event.preventDefault();
  const element = typeof target === "function" ? target() : target.current;
  if (element && element.isConnected) element.focus({ preventScroll: true });
}
