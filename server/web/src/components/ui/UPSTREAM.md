# Coss UI source

Source: https://github.com/cosscom/coss
Revision: 59e8c88c4be28cbfdd9eb3cd7274c60ffa91413e
Imported from apps/ui/registry/default (MIT, see upstream LICENSING.md).
The source registry imports were changed to this application's aliases.
Companion library utilities and use-media-query share this provenance.
The adjacent license preserves coss.com's MIT notice. No code was copied
from the differently licensed packages/ui directory.
Update deliberately; do not regenerate components automatically.

Local accessibility adjustment: muted control text uses the full semantic color rather than 72% opacity to meet contrast on the Protocol light palette.

Layout consolidation also imports Card/CardFrame, Group and Meter from the
same pinned registry revision. Separator is retained as Group's required dependency.

Dashboard consolidation adds Sheet, Menu, Tooltip, Breadcrumb and Input Group
from the same pinned MIT registry revision. The local sheet composition uses
SheetPanel scrolling on desktop and DrawerPanel scrolling on mobile.
No package or registry revision was changed.
