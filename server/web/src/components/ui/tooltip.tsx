import type { ComponentProps } from "react";
import * as UI from "./supabase-tooltip";
import { renderChild, type RenderProps } from "./overlay-composition";
export const Tooltip = UI.Tooltip,
  TooltipProvider = UI.TooltipProvider,
  TooltipPopup = UI.TooltipContent;
export function TooltipTrigger({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.TooltipTrigger> & RenderProps) {
  return (
    <UI.TooltipTrigger {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.TooltipTrigger>
  );
}
