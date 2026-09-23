import { ArrowUp, ArrowDown } from "lucide-react";
import PageSection from "../PageSection";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  deleteSourcePriority,
  fetchSourcePriority,
  saveSourcePriority,
} from "../../api";
import { formatNumber, formatTimeAgo } from "../../utils/format";
import { sourceLabelLong } from "../../utils/sourceLabel";

const DEFAULT_CATEGORY = "_default";

/**
 * Surfaces the source-priority logic that already runs in the ingest path but
 * had no UI: when two devices report the same metric, the source higher in the
 * list wins.
 */
export default function SourcesTab() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["source-priority"],
    queryFn: fetchSourcePriority,
  });
  const dirty = useRef(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.data || dirty.current) return;
    const rule = config.data.rules?.find(
      (r) => r.category === DEFAULT_CATEGORY,
    );
    setOrder(rule?.sources ?? config.data.default ?? config.data.sources ?? []);
  }, [config.data]);

  // Keyed by the source value itself, so the lookup cannot silently miss the
  // way the import-log job names did.
  const activityBySource = new Map(
    (config.data?.activity ?? []).map((a) => [a.source, a]),
  );

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    dirty.current = true;
    setOrder(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveSourcePriority(DEFAULT_CATEGORY, order);
      dirty.current = false;
      queryClient.invalidateQueries({ queryKey: ["source-priority"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const saved =
    config.data?.rules?.find((r) => r.category === DEFAULT_CATEGORY)?.sources ??
    config.data?.default ??
    [];
  const changed = order.join("|") !== saved.join("|");

  // Every rule that is not the default one. The ingest path honours these, so
  // hiding them would make the order above look absolute when it is not.
  const overrides = (config.data?.rules ?? []).filter(
    (r) => r.category !== DEFAULT_CATEGORY,
  );

  async function removeOverride(category: string) {
    setRemoving(category);
    setError(null);
    try {
      await deleteSourcePriority(category);
      queryClient.invalidateQueries({ queryKey: ["source-priority"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <PageSection
      title="Sources"
      description={
        <>
          When two devices report the same metric, the source higher in this
          list wins. Move an entry up to prefer it.
        </>
      }
    >
      {config.isPending && <Spinner className="my-4 size-5" />}
      {config.error && (
        <Alert variant="error">
          {config.error.message}
          <Button variant="ghost" onClick={() => void config.refetch()}>
            Retry
          </Button>
        </Alert>
      )}
      {config.isSuccess && order.length === 0 && (
        <Empty>No sources recorded yet.</Empty>
      )}

      <ol className="divide-y">
        {order.map((src, i) => {
          const activity = activityBySource.get(src);
          return (
            <li
              key={src || "(healthkit)"}
              className="flex flex-wrap items-center gap-3 py-4"
            >
              <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-36">
                <p className="text-sm font-medium break-words">
                  {sourceLabelLong(src)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i === 0
                    ? "Wins on conflict"
                    : i === 1
                      ? "Used when rank 1 has no reading"
                      : `Used when ranks 1–${i} have no reading`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activity
                    ? `${formatTimeAgo(activity.last_seen)} · ${formatNumber(activity.rows)} rows`
                    : "Nothing stored"}
                </p>
              </div>
              <Badge variant={activity ? "success" : "secondary"}>
                {activity ? "Delivering" : "No data"}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={saving || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move ${sourceLabelLong(src)} up`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={saving || i === order.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move ${sourceLabelLong(src)} down`}
                >
                  <ArrowDown />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="pt-5">
        <Button onClick={save} disabled={saving || !changed} loading={saving}>
          Save order
        </Button>
      </div>
      {overrides.length > 0 && (
        <div className="space-y-3 pt-6">
          <h3 className="text-sm font-semibold">Category exceptions</h3>
          <p className="max-w-prose text-sm text-muted-foreground">
            These categories use their own source order.
          </p>
          <div className="divide-y border-y">
            {overrides.map((rule) => (
              <div
                key={rule.category}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-medium capitalize">
                    {rule.category.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rule.sources.map(sourceLabelLong).join(" → ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  disabled={removing !== null}
                  loading={removing === rule.category}
                  onClick={() => removeOverride(rule.category)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageSection>
  );
}
