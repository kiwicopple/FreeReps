import type { ComponentProps } from "react";
import * as UI from "./supabase-alert-dialog";
import {
  renderChild,
  restoreFocus,
  type RenderProps,
  type FinalFocus,
} from "./overlay-composition";
export const AlertDialog = UI.AlertDialog,
  AlertDialogHeader = UI.AlertDialogHeader,
  AlertDialogTitle = UI.AlertDialogTitle,
  AlertDialogDescription = UI.AlertDialogDescription,
  AlertDialogFooter = UI.AlertDialogFooter;
export function AlertDialogTrigger({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.AlertDialogTrigger> & RenderProps) {
  return (
    <UI.AlertDialogTrigger {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.AlertDialogTrigger>
  );
}
export function AlertDialogClose({
  render,
  children,
  ...props
}: ComponentProps<typeof UI.AlertDialogCancel> & RenderProps) {
  return (
    <UI.AlertDialogCancel {...props} asChild={!!render}>
      {renderChild({ render, children })}
    </UI.AlertDialogCancel>
  );
}
export function AlertDialogPopup({
  finalFocus,
  ...props
}: ComponentProps<typeof UI.AlertDialogContent> & { finalFocus?: FinalFocus }) {
  return (
    <UI.AlertDialogContent
      {...props}
      onCloseAutoFocus={(event) => restoreFocus(finalFocus, event)}
    />
  );
}
