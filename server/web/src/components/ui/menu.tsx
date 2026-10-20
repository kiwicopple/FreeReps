import type { ComponentProps } from "react";
import * as UI from "./supabase-menu";
import { renderChild, type RenderProps } from "./overlay-composition";
import { cn } from "@/lib/utils";
export const Menu = UI.DropdownMenu,
  MenuPopup = UI.DropdownMenuContent,
  MenuSeparator = UI.DropdownMenuSeparator;
export function MenuTrigger({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.DropdownMenuTrigger> & RenderProps) {
  return (
    <UI.DropdownMenuTrigger {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.DropdownMenuTrigger>
  );
}
export function MenuItem({
  variant,
  className,
  ...props
}: ComponentProps<typeof UI.DropdownMenuItem> & { variant?: "destructive" }) {
  return (
    <UI.DropdownMenuItem
      className={cn(
        variant === "destructive" && "text-destructive focus:text-destructive",
        className,
      )}
      {...props}
    />
  );
}
