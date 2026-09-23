import { buttonVariants } from "../components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "../components/ui/tabs";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import AlertsTab from "../components/settings/AlertsTab";
import FrontPageTab from "../components/settings/FrontPageTab";
import HevyTab from "../components/settings/HevyTab";
import IdentityTab from "../components/settings/IdentityTab";
import ImportTab from "../components/settings/ImportTab";
import IngestTab from "../components/settings/IngestTab";
import OuraTab from "../components/settings/OuraTab";
import SourcesTab from "../components/settings/SourcesTab";
import WithingsTab from "../components/settings/WithingsTab";
import { useIsDesktop } from "../hooks/useMediaQuery";

/* Hevy and Import are absent from the design's five-tab rail, but both drive
   working integrations, so they stay rather than being dropped along with the
   old layout. */
const TABS = [
  { id: "identity", label: "Identity", render: () => <IdentityTab /> },
  { id: "sources", label: "Sources", render: () => <SourcesTab /> },
  { id: "oura", label: "Oura", render: () => <OuraTab /> },
  { id: "withings", label: "Withings", render: () => <WithingsTab /> },
  { id: "hevy", label: "Hevy", render: () => <HevyTab /> },
  { id: "front-page", label: "Front page", render: () => <FrontPageTab /> },
  { id: "ingest", label: "Ingest", render: () => <IngestTab /> },
  { id: "import", label: "Import", render: () => <ImportTab /> },
  { id: "alerts", label: "Alerts", render: () => <AlertsTab /> },
] as const;

type TabID = (typeof TABS)[number]["id"];

const VALID = new Set<string>(TABS.map((t) => t.id));

export default function SettingsPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: TabID = raw && VALID.has(raw) ? (raw as TabID) : "identity";

  const setTab = (id: TabID) => {
    const p = new URLSearchParams(params);
    p.set("tab", id);
    setParams(p, { replace: true });
  };

  if (!isDesktop) {
    // One scrolling page rather than a rail: the phone has no room beside the
    // content, and the sections are short enough to read in sequence.
    return (
      <>
        <PageHeader
          title="Settings"
          actions={
            <Link
              to="/trends"
              className={buttonVariants({ variant: "outline" })}
            >
              View trends →
            </Link>
          }
        />
        <div className="page-x space-y-6">
          {TABS.map((tab) => (
            <div key={tab.id}>{tab.render()}</div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" />

      <Tabs
        orientation="vertical"
        value={active}
        onValueChange={(id) => setTab(id as TabID)}
        className="page-x min-h-[640px] gap-6"
      >
        <TabsList
          aria-label="Settings sections"
          className="w-44 shrink-0 self-start lg:w-56"
        >
          {TABS.map((tab) => (
            <TabsTab key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsPanel key={tab.id} value={tab.id} className="min-w-0 flex-1">
            {tab.render()}
          </TabsPanel>
        ))}
      </Tabs>
    </>
  );
}
