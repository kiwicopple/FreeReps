import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { fetchImportLogs, type ImportLog } from "../../api";
import { formatNumber } from "../../utils/format";
import { MONO, TabHeader } from "./parts";

export default function IngestTab() {
  const logs = useQuery({
    queryKey: ["import-logs", 25],
    queryFn: () => fetchImportLogs(25),
  });

  const serverURL =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/v1/ingest`;

  return (
    <>
      <TabHeader title="Ingest">
        Point Health Auto Export at this URL. Requests arrive over the tailnet,
        so the reverse proxy is what authenticates them.
      </TabHeader>

      <div style={{ paddingTop: 20 }}>
        <Label className="kick" htmlFor="ingest-url">
          Server URL
        </Label>
        <Input
          id="ingest-url"

          style={{ ...MONO, maxWidth: 620, marginTop: 8 }}
          value={serverURL}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <div style={{ paddingTop: 30 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent ingests</h3>
        <div
          style={{
            borderTop: "2px solid var(--foreground)",
            marginTop: 12,
          }}
        >
          {logs.isPending && <Spinner className="my-4 size-5" />}
          {logs.error && (
            <Alert variant="error">
              {logs.error.message}
              <Button variant="ghost" onClick={() => void logs.refetch()}>
                Retry
              </Button>
            </Alert>
          )}
          {logs.data && logs.data.length > 0 ? (
            logs.data.map((log) => <IngestRow key={log.id} log={log} />)
          ) : logs.isSuccess ? (
            <Empty>No ingests recorded yet.</Empty>
          ) : null}
        </div>
      </div>
    </>
  );
}

function IngestRow({ log }: { log: ImportLog }) {
  const summary = [
    log.metrics_inserted
      ? `${formatNumber(log.metrics_inserted)} metrics`
      : null,
    log.workouts_inserted
      ? `${formatNumber(log.workouts_inserted)} workouts`
      : null,
    log.sleep_sessions ? `${formatNumber(log.sleep_sessions)} nights` : null,
    log.sets_inserted ? `${formatNumber(log.sets_inserted)} sets` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        className="num"
        style={{
          width: 150,
          flex: "none",
          font: "400 12px var(--font-body)",
          color: "var(--muted-foreground)",
        }}
      >
        {new Date(log.created_at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      <span
        style={{ width: 180, flex: "none", font: "500 13px var(--font-body)" }}
      >
        {log.source || "—"}
      </span>
      <span
        style={{
          flex: "1 1 180px",
          minWidth: 0,
          font: "400 12.5px var(--font-body)",
          color: "var(--muted-foreground)",
        }}
      >
        {log.error_message || summary || "nothing new"}
      </span>
      <Badge
        variant={log.status === "success" ? "success" : "secondary"}
        style={{ flex: "none" }}
      >
        {log.status === "success" ? "OK" : log.status}
      </Badge>
    </div>
  );
}
