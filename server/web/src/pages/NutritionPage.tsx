import { Empty } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import DateNavigator from "@/components/DateNavigator";
import PageSection from "@/components/PageSection";
import { Meter } from "@/components/ui/meter";
import Choice from "@/components/Choice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import ResponsiveDetails from "../components/nutrition/ResponsiveDetails";
import ProtocolEditor from "../components/nutrition/ProtocolEditor";
import {
  getFoodLog,
  getCatalog,
  getProtocols,
  getNutritionDays,
  saveCompletion,
} from "../nutritionApi";
import type { FoodDay, NutritionTarget, ProtocolRecord } from "../nutritionApi";
import {
  amount,
  averageKnown,
  localToday,
  nutrientLabel,
  protocolForDate,
  shiftDate,
  sourceURL,
  targetStatus,
  unitLabel,
  validDate,
} from "../utils/nutrition";
import { nutrientInfo } from "../utils/nutrientInfo";
import "./nutrition.css";
const HERO = ["energy", "protein", "carbohydrate", "fat"];
const SECONDARY = ["fiber", "water"];
const MICRO = [
  "vitamin_a_rae",
  "vitamin_c",
  "vitamin_d",
  "vitamin_e_alpha_tocopherol",
  "vitamin_k",
  "thiamin_b1",
  "riboflavin_b2",
  "niacin_b3",
  "pantothenic_acid_b5",
  "vitamin_b6",
  "biotin_b7",
  "folate_dfe",
  "vitamin_b12",
  "choline",
  "calcium",
  "magnesium",
  "potassium",
  "iron",
  "zinc",
  "selenium",
  "iodine",
  "copper",
  "manganese",
  "phosphorus",
  "chromium",
  "molybdenum",
  "chloride",
  "sodium",
];
function Source({ value }: { value: string }) {
  const href = sourceURL(value);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      Source ↗
    </a>
  ) : (
    <span>{value}</span>
  );
}
function targetText(t: NutritionTarget | undefined) {
  return t
    ? `${t.kind === "maximum" ? "Limit " : t.kind === "reference" ? "Reference " : ""}${t.kind === "range" ? `${amount(t.low)}–${amount(t.high)}` : amount(t.value)} ${unitLabel(t.unit)}`
    : "No target set";
}
export default function NutritionPage() {
  const [params, setParams] = useSearchParams();
  const rawDate = params.get("date");
  const date = validDate(rawDate) ? rawDate : localToday();
  const rawRange = params.get("range");
  const range = rawRange === "7d" || rawRange === "30d" ? rawRange : "day";
  const count = range === "day" ? 1 : range === "7d" ? 7 : 30;
  const start = shiftDate(date, 1 - count),
    end = shiftDate(date, 1);
  const editButton = useRef<HTMLButtonElement>(null);
  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("energy");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ["nutrition", start, end],
    queryFn: async () => {
      const [log, protocols, completion, catalog] = await Promise.all([
        getFoodLog(start, end),
        getProtocols(),
        getNutritionDays(start, end),
        getCatalog(),
      ]);
      return { log, protocols, completion, catalog };
    },
    refetchInterval: () =>
      document.visibilityState === "visible" ? 60000 : false,
    refetchOnWindowFocus: "always",
  });
  const refresh = async () => {
    const result = await query.refetch();
    if (result.error) throw result.error;
  };
  const data = query.data;
  const days = data?.log.days ?? [];
  const protocols = data?.protocols ?? [];
  const protocol = protocolForDate(protocols, date);
  const currentDay = data?.completion.find((d) => d.date === date);
  const records = (data?.log.entries ?? [])
    .filter((r) => r.entry.status === "recorded")
    .sort((a, b) =>
      (a.entry.eaten_at || a.entry.local_date + "T00").localeCompare(
        b.entry.eaten_at || b.entry.local_date + "T00",
      ),
    );
  const completeDays = data?.completion.filter((d) => d.complete).length ?? 0;
  function navigate(d: string, r = range) {
    setParams({ date: d, range: r });
  }
  async function toggle() {
    setError("");
    setSaving(true);
    try {
      await saveCompletion(
        date,
        !currentDay?.complete,
        currentDay?.version ?? 0,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
      await query.refetch();
    } finally {
      setSaving(false);
    }
  }
  function nutrient(key: string, hero = false) {
    const avg = averageKnown(days, key);
    const total = days[0]?.nutrients[key];
    const value = range === "day" ? (total?.known_subtotal ?? null) : avg.value;
    const t = protocol?.targets[key];
    const unit = unitLabel(data?.catalog[key] ?? "");
    const covered = range === "day" && !!total?.complete_for_logged_items;
    const status =
      range === "day"
        ? targetStatus(value, t, !!currentDay?.complete, covered)
        : `${avg.count}/${count} days with values`;
    const meterTarget = t?.kind === "range" ? t.high : t?.value;
    return (
      <ResponsiveDetails
        title={nutrientLabel(key)}
        key={key}
        className={hero ? "nutrition-hero" : "nutrition-nutrient"}
        trigger={
          <>
            <span className="nutrition-label">{nutrientLabel(key)}</span>
            <span className="nutrition-value">
              {amount(value)}
              {value != null && <small> {unit}</small>}
            </span>
            {(hero || (value != null && t)) && (
              <span className="nutrition-muted col-span-full">
                {range === "day"
                  ? targetText(t)
                  : "Daily average of known intake"}
              </span>
            )}
            {range === "day" &&
              value != null &&
              t &&
              t.kind !== "reference" &&
              meterTarget != null &&
              Number.isFinite(meterTarget) &&
              meterTarget > 0 && (
                <Meter
                  className="col-span-full my-1"
                  aria-label={`${nutrientLabel(key)} logged versus target`}
                  value={Math.max(0, Math.min(value, meterTarget))}
                  max={meterTarget}
                  getAriaValueText={() =>
                    `${amount(value)} ${unit} logged; ${targetText(t)}. Intake comparison, not logging completion.`
                  }
                />
              )}
            {value != null && (
              <span className="nutrition-status">{status}</span>
            )}
            {range === "day" && value != null && !covered && (
              <span className="nutrition-muted">Partial data</span>
            )}
          </>
        }
      >
        {(close) => (
          <div className="nutrition-detail">
            <p className="nutrition-muted">
              {range === "day"
                ? `${total?.known_items ?? 0}/${total?.total_items ?? 0} items have values${total?.estimated_items ? ` · ${total.estimated_items} estimated` : ""}`
                : "Daily average of known intake"}
            </p>
            {nutrientInfo[key] && (
              <section
                className="nutrition-explainer"
                aria-label={`About ${nutrientLabel(key)}`}
              >
                <p>{nutrientInfo[key].summary}</p>
                <a
                  href={nutrientInfo[key].source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more about {nutrientLabel(key).toLowerCase()} ↗
                </a>
              </section>
            )}
            <Button
              variant="outline"
              onClick={() => {
                close();
                setSelected(key);
                if (range === "day") navigate(date, "7d");
              }}
            >
              Show {nutrientLabel(key).toLowerCase()} trend
            </Button>
            {t && (
              <p>
                {targetText(t)} · {t.label}
                <br />
                <Source value={t.source} />
                {t.upper != null && (
                  <>
                    <br />
                    Upper reference limit: {amount(t.upper)} {unit} (total
                    intake)
                  </>
                )}
              </p>
            )}
            {key === "water" && (
              <p>
                Total-water reference includes food moisture. Logged drinks
                alone cannot establish whether this reference is met.
              </p>
            )}
            {["omega_3", "epa", "dha", "fat", "carbohydrate", "sugar"].includes(
              key,
            ) && (
              <p>
                These measures overlap with their components; do not add them
                together.
              </p>
            )}
            {records.flatMap((r) =>
              r.entry.items.map((item, i) => {
                const n = item.nutrients[key];
                return (
                  <div className="nutrition-contribution" key={r.entry.id + i}>
                    <strong>{item.name}</strong>
                    <span>{n ? `${amount(n.value)} ${unit}` : "Unknown"}</span>
                    <small>
                      {r.entry.local_date} · {item.portion}
                      {n ? ` · ${n.basis}, ${n.confidence} confidence` : ""}
                    </small>
                    {n?.low != null && (
                      <small>
                        Assumption range: {amount(n.low)}–{amount(n.high)}{" "}
                        {unit}
                      </small>
                    )}
                    {n && (
                      <small>
                        <Source value={n.reference} />
                      </small>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        )}
      </ResponsiveDetails>
    );
  }
  return (
    <>
      <PageHeader
        title="Nutrition"
        actions={
          <RangeControl
            options={["day", "7d", "30d"]}
            value={range}
            onChange={(r) => navigate(date, r)}
            name="nutrition-range"
          />
        }
      >
        <DateNavigator
          label="End date"
          value={date}
          onValueChange={(value) => navigate(value)}
          onPrevious={() => navigate(shiftDate(date, -1))}
          onNext={() => navigate(shiftDate(date, 1))}
          onReset={() => navigate(localToday())}
          resetLabel="Today"
        />
      </PageHeader>
      <div className="page-x nutrition-page space-y-6">
        {error && (
          <Alert variant="error" role="alert">
            {error}
          </Alert>
        )}
        {query.isError && (
          <Alert variant="error" role="alert">
            Could not refresh nutrition: {query.error.message}.{" "}
            {data ? "Showing the last loaded data." : ""}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </Alert>
        )}
        {query.isPending ? (
          <p>Loading your nutrition log…</p>
        ) : (
          data && (
            <>
              <PageSection title="Logging status">
                <div className="nutrition-intro">
                  <div>
                    <strong>
                      {range === "day"
                        ? currentDay?.complete
                          ? "Day marked complete"
                          : "Day in progress"
                        : `${completeDays} of ${count} days marked complete`}
                    </strong>
                    <p className="nutrition-muted">
                      {range === "day"
                        ? "Log everything you consume, then mark the day complete."
                        : "Averages include days with values, including partial days. Missing days are excluded."}{" "}
                      Unknown nutrients are never counted as zero.
                    </p>
                  </div>
                  {range === "day" && (
                    <Button
                      variant="outline"
                      disabled={saving || query.isError}
                      onClick={() => void toggle()}
                    >
                      {saving
                        ? "Saving…"
                        : currentDay?.complete
                          ? "Reopen day"
                          : "Mark day complete"}
                    </Button>
                  )}
                </div>
              </PageSection>
              {!protocol && (
                <p className="nutrition-notice">
                  No protocol applies to this date. Intake is still available;
                  set targets through the connected chat.
                </p>
              )}
              {!records.length && (
                <Empty className="nutrition-notice">
                  No intake logged in this period. Send a photo or description
                  in the connected conversation to add food, drinks or
                  supplements.
                </Empty>
              )}
              <section
                className="nutrition-heroes"
                aria-label="Calories and macros"
              >
                {HERO.map((k) => nutrient(k, true))}
              </section>
              <PageSection title="Fiber and water">
                <div className="nutrition-secondary">
                  {SECONDARY.map((k) => nutrient(k))}
                </div>
              </PageSection>
              {range !== "day" && (
                <PageSection
                  title="Daily trend"
                  actions={
                    <Choice
                      searchable
                      aria-label="Trend nutrient"
                      value={selected}
                      onValueChange={(value) => setSelected(value)}
                      options={Object.keys(data.catalog).map((k) => ({
                        value: k,
                        label: nutrientLabel(k),
                      }))}
                    />
                  }
                >
                  <Trend
                    days={days}
                    nutrient={selected}
                    protocols={protocols}
                  />
                  <p className="nutrition-muted">
                    Solid: logged intake · dashed: target active on each date.
                    Gaps mean unknown intake.
                  </p>
                  <div className="nutrition-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>
                            Logged {unitLabel(data.catalog[selected])}
                          </TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Coverage</TableHead>
                          <TableHead>Day</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {days.map((d) => (
                          <TableRow key={d.date}>
                            <TableCell>
                              <Button
                                variant="outline"
                                className="nutrition-text-button"
                                onClick={() => navigate(d.date, "day")}
                              >
                                {d.date}
                              </Button>
                            </TableCell>
                            <TableCell>
                              {amount(d.nutrients[selected]?.known_subtotal)}
                            </TableCell>
                            <TableCell>
                              {targetText(
                                protocolForDate(protocols, d.date)?.targets[
                                  selected
                                ],
                              )}
                            </TableCell>
                            <TableCell>
                              {d.nutrients[selected]?.known_items ?? 0}/
                              {d.items} items
                            </TableCell>
                            <TableCell>
                              {data.completion.find((c) => c.date === d.date)
                                ?.complete
                                ? "Complete"
                                : "Partial / unlogged"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </PageSection>
              )}
              <PageSection title={<>Vitamins & minerals</>}>
                <p className="nutrition-muted">
                  Food and supplements combined. A complete day can still have
                  incomplete nutrient information.
                </p>
                <div className="nutrition-grid">
                  {MICRO.map((k) => nutrient(k))}
                </div>
              </PageSection>
              <PageSection title={<>Supplements</>}>
                {records.flatMap((r) =>
                  r.entry.items
                    .filter((i) => i.kind === "supplement")
                    .map((item, i) => (
                      <div
                        className="nutrition-supplement"
                        key={r.entry.id + i}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <p className="nutrition-muted">
                            {item.portion} · {r.entry.local_date}
                          </p>
                        </div>
                        <span>
                          {Object.entries(item.nutrients)
                            .filter(([k]) =>
                              [
                                "creatine",
                                "vitamin_d",
                                "omega_3",
                                "epa",
                                "dha",
                              ].includes(k),
                            )
                            .map(
                              ([k, n]) =>
                                `${nutrientLabel(k)} ${amount(n.value)} ${unitLabel(n.unit)}`,
                            )
                            .join(" · ")}
                        </span>
                      </div>
                    )),
                )}
                {!records.some((r) =>
                  r.entry.items.some((i) => i.kind === "supplement"),
                ) && <p className="nutrition-muted">No supplements logged.</p>}
                <p className="nutrition-muted">
                  Recorded consumption, not a recommended supplement schedule.
                </p>
              </PageSection>
              <ResponsiveDetails
                title="Other nutrients"
                className="nutrition-section"
                trigger={
                  <>
                    <h2 style={{ display: "inline" }}>Other nutrients</h2>
                  </>
                }
              >
                <div className="nutrition-grid">
                  {Object.keys(data.catalog)
                    .filter(
                      (k) => ![...HERO, ...SECONDARY, ...MICRO].includes(k),
                    )
                    .sort()
                    .map((k) => nutrient(k))}
                </div>
              </ResponsiveDetails>
              <PageSection title={<>Food log</>}>
                {records.map((r) => (
                  <ResponsiveDetails
                    title={r.entry.meal || "Food entry"}
                    key={r.entry.id}
                    className="nutrition-log"
                    trigger={
                      <>
                        <span>
                          <strong>{r.entry.meal || "Food entry"}</strong>
                          <small>
                            {r.entry.local_date}
                            {r.entry.eaten_at
                              ? ` · ${new Date(r.entry.eaten_at).toLocaleTimeString("en-SG", { timeZone: r.entry.timezone, hour: "2-digit", minute: "2-digit" })}${r.entry.time_precision === "approximate" ? " (approx.)" : ""}`
                              : " · Time not specified"}
                          </small>
                        </span>
                        <span>{r.entry.items.length} items</span>
                      </>
                    }
                  >
                    {r.entry.items.map((i, index) => (
                      <div className="nutrition-detail" key={index}>
                        <strong>{i.name}</strong> · {i.portion}
                        <p className="nutrition-muted">{i.assumptions}</p>
                        <dl>
                          {Object.entries(i.nutrients).map(([k, n]) => (
                            <div className="nutrition-contribution" key={k}>
                              <dt>{nutrientLabel(k)}</dt>
                              <dd>
                                {amount(n.value)} {unitLabel(n.unit)}
                              </dd>
                              <small>
                                {n.basis} · {n.confidence} confidence ·{" "}
                                <Source value={n.reference} />
                              </small>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                    <p className="nutrition-muted">{r.entry.notes}</p>
                  </ResponsiveDetails>
                ))}
              </PageSection>
              {protocol && (
                <PageSection
                  title="Your protocol"
                  description={`Effective ${protocol.effective_date}`}
                  actions={
                    <Button
                      ref={editButton}
                      variant="outline"
                      disabled={editing}
                      onClick={() => setEditing(true)}
                    >
                      Edit targets
                    </Button>
                  }
                >
                  {editing && protocol && (
                    <ProtocolEditor
                      record={protocol}
                      date={date}
                      version={Math.max(0, ...protocols.map((p) => p.version))}
                      catalog={data.catalog}
                      onClose={closeEditor}
                      onSave={refresh}
                    />
                  )}
                  <p>
                    {protocol.profile.goal} · {protocol.profile.activity}
                  </p>
                  <p>{protocol.profile.preferences}</p>
                  <p className="nutrition-muted">{protocol.notes}</p>
                  <h3>Revision history</h3>
                  {protocols.map((p) => (
                    <p className="nutrition-muted" key={p.version}>
                      Version {p.version} · effective{" "}
                      {p.protocol.effective_date} · {p.reason}
                    </p>
                  ))}
                </PageSection>
              )}
              <p className="nutrition-muted nutrition-footer">
                Send meal photos in the connected conversation. FreeReps stores
                the intake record, not your photos. Updates refresh every minute
                while this page is visible.
              </p>
            </>
          )
        )}
      </div>
    </>
  );
}
function Trend({
  days,
  nutrient,
  protocols,
}: {
  days: FoodDay[];
  nutrient: string;
  protocols: ProtocolRecord[];
}) {
  const values = days.map((d) => d.nutrients[nutrient]?.known_subtotal ?? null);
  const targets = days.map(
    (d) => protocolForDate(protocols, d.date)?.targets[nutrient]?.value ?? null,
  );
  const max =
    Math.max(
      1,
      ...values.filter((v): v is number => v != null),
      ...targets.filter((v): v is number => v != null),
    ) * 1.1;
  function path(vs: (number | null)[]) {
    let active = false;
    return vs
      .map((v, i) => {
        if (v == null) {
          active = false;
          return "";
        }
        const p = `${active ? "L" : "M"}${45 + (i * 640) / Math.max(days.length - 1, 1)},${175 - (v / max) * 150}`;
        active = true;
        return p;
      })
      .join(" ");
  }
  return (
    <svg
      className="nutrition-chart"
      viewBox="0 0 720 210"
      role="img"
      aria-label={`${nutrientLabel(nutrient)} daily logged intake and targets; exact values in table below`}
    >
      <text x="0" y="20" fill="currentColor" fontSize="12">
        {amount(max)}
      </text>
      <text x="20" y="179" fill="currentColor" fontSize="12">
        0
      </text>
      <line
        x1="45"
        y1="175"
        x2="690"
        y2="175"
        stroke="currentColor"
        opacity=".2"
      />
      <path
        d={path(targets)}
        fill="none"
        stroke="currentColor"
        opacity=".5"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <path
        d={path(values)}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
      />
      {values.map((v, i) =>
        v == null ? null : (
          <circle
            key={i}
            cx={45 + (i * 640) / Math.max(days.length - 1, 1)}
            cy={175 - (v / max) * 150}
            r="3"
            fill="var(--primary)"
          />
        ),
      )}
      <text x="45" y="200" fill="currentColor" fontSize="12">
        {days[0]?.date}
      </text>
      <text x="685" y="200" fill="currentColor" textAnchor="end" fontSize="12">
        {days[days.length - 1]?.date}
      </text>
    </svg>
  );
}
