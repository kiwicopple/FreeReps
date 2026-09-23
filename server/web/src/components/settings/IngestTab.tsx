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
    typeof window === "undefined" ? "" : `${window.location.origin}/api/v1/ingest`;

  return (
    <>
      <TabHeader title="Ingest">
        Point Health Auto Export at this URL. Requests arrive over the tailnet,
        so the reverse proxy is what authenticates them.
      </TabHeader>

      <div style={{ paddingTop: 20 }}>
        <label className="kick" htmlFor="ingest-url">
          Server URL
        </label>
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
          {logs.data && logs.data.length > 0 ? (
            logs.data.map((log) => <IngestRow key={log.id} log={log} />)
          ) : (
            <p
              style={{
                color: "var(--muted-foreground)",
                fontSize: 13,
                paddingTop: 14,
              }}
            >
              No ingests recorded yet.
            </p>
          )}
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
          flex: 1,
          minWidth: 0,
          font: "400 12.5px var(--font-body)",
          color: "var(--muted-foreground)",
        }}
      >
        {log.error_message || summary || "nothing new"}
      </span>
      <span
        className={`tag ${log.status === "success" ? "tag-accent" : "tag-neutral"}`}
        style={{ flex: "none" }}
      >
        {log.status === "success" ? "OK" : log.status}
      </span>
    </div>
  );
}
