import PageContent from "@/components/PageContent";
import Choice from "@/components/Choice";
import VisitedTabPanel from "@/components/VisitedTabPanel";
import { Tabs, TabsList, TabsTab } from "../components/ui/tabs";
import { useSearchParams } from "react-router-dom";
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
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: TabID = raw && VALID.has(raw) ? (raw as TabID) : "identity";

  const setTab = (id: TabID) => {
    const p = new URLSearchParams(params);
    p.set("tab", id);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader title="Settings" />
      <PageContent>
        <Tabs
          orientation="vertical"
          value={active}
          onValueChange={(id) => setTab(id as TabID)}
          className="settings-layout gap-6"
        >
          <div className="settings-picker">
            <label
              htmlFor="settings-section"
              className="mb-2 block text-sm font-medium"
            >
              Section
            </label>
            <Choice
              id="settings-section"
              aria-label="Settings section"
              value={active}
              onValueChange={(id) => setTab(id as TabID)}
              options={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
            />
          </div>
          <TabsList
            aria-label="Settings sections"
            className="settings-sections w-44 shrink-0 self-start"
          >
            {TABS.map((tab) => (
              <TabsTab key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTab>
            ))}
          </TabsList>
          {TABS.map((tab) => (
            <VisitedTabPanel
              key={tab.id}
              active={active}
              value={tab.id}
              label={tab.label}
              className="min-w-0 flex-1"
            >
              {tab.render()}
            </VisitedTabPanel>
          ))}
        </Tabs>
      </PageContent>
    </>
  );
}
