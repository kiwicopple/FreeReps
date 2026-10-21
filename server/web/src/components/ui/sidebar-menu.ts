import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// From the pinned Supabase sidebar; routing and collapse remain app-owned.
export const sidebarMenuButtonVariants = cva(
  cn(
    "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md py-2 px-1.5 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent/50 active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent/50 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 text-foreground-lighter data-[active=true]:text-foreground",
  ),
  {
    variants: {
      variant: {
        default:
          "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
      hasIcon: {
        true: "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:pl-1.5! group-data-[collapsible=icon]:pr-2!",
        false: "",
      },
      isLoading: {
        // When data necessary to check whether an item should be disabled is not yet available, override the styles to avoid
        // showing the disabled state just for a moment
        true: "disabled:opacity-100 aria-disabled:opacity-100",
        // If the item is not loading, fallback to the default styles so that disabled state is handled properly
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      hasIcon: true,
    },
  },
);
