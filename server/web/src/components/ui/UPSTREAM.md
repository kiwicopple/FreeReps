# Supabase Design System

Source: https://github.com/supabase/supabase
Pinned revision: `10a1753d89fe6a3bf9ca6282a9c1bdc046002067`.

Components are copied selectively from `packages/ui/src/components/shadcn/ui`
and the Studio Button from `packages/ui/src/components/Button/Button.tsx`.
Shared button utilities come from `packages/ui/src/lib`. Theme sources are from
`packages/ui/build/css` and `packages/config/css`, with the hit-area utility from
`packages/config/tailwind-plugins`. Do not regenerate against an unpinned registry.

The upstream UI package declares MIT. The repository root license is Apache 2.0,
reproduced in `SUPABASE-LICENSE`; retain that notice with these source adaptations.
The former coss MIT notice in `LICENSE.md` is retained for historical attribution.

Local adaptations:

- Imports resolve to this Vite application instead of monorepo aliases.
- Inter is self-hosted; no Next.js runtime or font loader is needed.
- Application action names map onto the Studio Button variants. Icon buttons
  retain their accessible names. Child layout supports icons and wrapping text.
- Card supports slot composition for interactive metric cards.
- Responsive detail compositions use Radix Sheet and Vaul Drawer, preserving
  nested navigation, return focus, independent scrolling and safe-area padding.
- Fields associate labels with native inputs and nullable number values.
- Tables use a native horizontal scroll container; no new data-table engine.
- Calendar outside days retain sufficient contrast. Date arithmetic is unchanged.
- Domain measurement meters retain `role=meter`, not a task progress role.
- Page layout, responsive navigation and chart engines remain application code.

Supabase's own compatibility token file is included because the pinned upstream
components consume those aliases. Protocol's former hand-authored palette is gone.

The sidebar menu variants in `sidebar-menu.ts` come from the same pinned
`shadcn/ui/sidebar.tsx`. They style native router links; Protocol retains its
existing responsive shell and collapse preference.
