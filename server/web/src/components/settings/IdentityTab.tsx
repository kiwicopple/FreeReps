import PageSection from "../PageSection";
import SegmentedControl from "../SegmentedControl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchStats, fetchVersion } from "../../api";
import { useTheme, type ThemePreference } from "../../theme";
import { formatNumber } from "../../utils/format";
import BirthDateRow from "./BirthDateRow";
import MaxHeartRateRow from "./MaxHeartRateRow";
import { MONO, Row } from "./parts";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function IdentityTab() {
  const { theme, setTheme } = useTheme();
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const version = useQuery({ queryKey: ["version"], queryFn: fetchVersion });
  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  const rows = stats.data
    ? `${formatNumber(stats.data.total_metric_rows)} metric rows · ${formatNumber(
        stats.data.total_workouts,
      )} workouts · ${formatNumber(stats.data.total_sleep_nights)} nights`
    : "—";

  return (
    <PageSection
      title="Identity"
      description={
        <>
          This server holds one person's data. Identity comes from the reverse
          proxy, so there is nothing to log into.
        </>
      }
    >
      {(me.isPending || version.isPending || stats.isPending) && (
        <Spinner className="my-4 size-5" />
      )}
      {(me.error || version.error || stats.error) && (
        <Alert variant="error">
          {(me.error || version.error || stats.error)?.message}
          <Button
            variant="ghost"
            onClick={() => {
              void me.refetch();
              void version.refetch();
              void stats.refetch();
            }}
          >
            Retry
          </Button>
        </Alert>
      )}

      <Row label="Display name">
        {me.data?.display_name || me.data?.login || "—"}
      </Row>
      <Row label="User ID">
        <span style={MONO}>{me.data?.login ?? "—"}</span>
      </Row>
      <Row label="Provided by">
        {me.data?.tailnet
          ? `Tailscale · ${me.data.tailnet}`
          : "Tailscale reverse proxy header"}
      </Row>
      <Row label="Server version">
        <span style={MONO}>{version.data?.version ?? "—"}</span>
      </Row>
      <Row label="Database">TimescaleDB · {rows}</Row>

      <BirthDateRow />
      <MaxHeartRateRow />

      <Row label="Appearance">
        <SegmentedControl
          label="Appearance"
          name="theme"
          options={THEMES}
          value={theme}
          onChange={setTheme}
        />
        <p
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--muted-foreground)",
            margin: "8px 0 0",
          }}
        >
          Auto follows the system setting. The choice is stored in this browser.
        </p>
      </Row>
    </PageSection>
  );
}
