import type { ComponentProps } from "react";
import * as UI from "./supabase-tabs";
import { cn } from "@/lib/utils";
export function Tabs({ className, ...props }: ComponentProps<typeof UI.Tabs>) {
  return (
    <UI.Tabs
      activationMode="manual"
      className={cn(
        "flex flex-col gap-2 data-[orientation=vertical]:flex-row",
        className,
      )}
      {...props}
    />
  );
}
export function TabsList({
  variant: _variant,
  size: _size,
  className,
  ...props
}: ComponentProps<typeof UI.TabsList> & {
  variant?: "default" | "underline";
  size?: "sm" | "default" | "lg";
}) {
  return (
    <UI.TabsList
      className={cn(
        "gap-4 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}
export const TabsTab = UI.TabsTrigger;
export function TabsPanel({
  keepMounted,
  ...props
}: ComponentProps<typeof UI.TabsContent> & { keepMounted?: boolean }) {
  return (
    <UI.TabsContent forceMount={keepMounted ? true : undefined} {...props} />
  );
}
