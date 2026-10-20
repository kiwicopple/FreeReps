import type { ComponentProps } from "react";
import * as UI from "./supabase-popover";
import { renderChild, type RenderProps } from "./overlay-composition";
export const Popover = UI.Popover;
export function PopoverTrigger({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.PopoverTrigger> & RenderProps) {
  return (
    <UI.PopoverTrigger {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.PopoverTrigger>
  );
}
export const PopoverPopup = UI.PopoverContent;
