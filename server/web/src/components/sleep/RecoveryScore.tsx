import { Alert } from "../ui/alert";
import { Spinner } from "../ui/spinner";
import { Badge } from "../ui/badge";
import { Button } from "@/components/ui/button";
import Disclosure from "@/components/Disclosure";
import { useQuery } from "@tanstack/react-query";
import { fetchSleep, fetchTimeSeries, type SleepSession } from "../../api";
import { recoveryScore, type RecoveryNight } from "../../utils/recovery";
import { shiftDate } from "../../utils/nutrition";

async function loadNight(session: SleepSession): Promise<RecoveryNight> {
  const [heart, hrv] = await Promise.all([
    fetchTimeSeries("heart_rate", session.SleepStart, session.SleepEnd, "5min"),
    fetchTimeSeries(
      "heart_rate_variability",
      session.SleepStart,
      session.SleepEnd,
      "5min",
    ),
  ]);
  return { session, heart: heart ?? [], hrv: hrv ?? [] };
}

export default function RecoveryScore({ session }: { session: SleepSession }) {
  const date = session.Date.slice(0, 10);
  const query = useQuery({
    queryKey: ["recovery-v1", session],
    queryFn: async () => {
      const history = await fetchSleep(
        shiftDate(date, -28),
        shiftDate(date, -1),
      );
      const current = await loadNight(session);
      const nights: RecoveryNight[] = [];
      // Bound concurrent requests and count each recorded date only once.
      const unique = [
        ...new Map(
          (history.sessions ?? [])
            .filter((s) => s.Date < session.Date)
            .map((s) => [s.Date.slice(0, 10), s]),
        ).values(),
      ];
      for (let i = 0; i < unique.length; i += 4)
        nights.push(
          ...(await Promise.all(unique.slice(i, i + 4).map(loadNight))),
        );
      return recoveryScore(current, nights);
    },
    staleTime: 60000,
  });
  const result = query.data;
  return (
    <section
      className="page-x"
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        paddingTop: 18,
        paddingBottom: 18,
        marginBottom: 20,
      }}
      aria-label="Protocol recovery score"
    >
      <div className="kick">Protocol recovery · experimental v1</div>
      {query.isLoading ? (
        <p role="status" className="flex items-center gap-2">
          <Spinner />
          Calculating recovery…
        </p>
      ) : query.isError ? (
        <Alert variant="error">
          Recovery could not load.{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : (
        result && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginTop: 10,
              }}
            >
              <strong className="num" style={{ fontSize: 40 }}>
                {result.score ?? "—"}
                <span style={{ fontSize: 16, fontWeight: 400 }}> / 100</span>
              </strong>
              <Badge variant="secondary">
                {result.score == null
                  ? "Insufficient sleep data"
                  : result.sleepOnly
                    ? "Provisional · sleep-only"
                    : result.provisional
                      ? "Provisional · partial data"
                      : "Personal baseline available"}
              </Badge>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                marginTop: 6,
              }}
            >
              Data coverage: {result.coverage}% of the model. A personal trend
              indicator, not a medical assessment or clearance to train.
            </p>
            <Disclosure style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer" }}>
                Contributors &amp; how it works
              </summary>
              {result.parts.map((p) => (
                <div
                  key={p.name}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong>
                      {p.name} · {p.weight}%
                    </strong>
                    <span>
                      {p.score == null
                        ? "Not included"
                        : `${Math.round(p.score)}/100`}
                    </span>
                  </div>
                  <div
                    style={{ color: "var(--muted-foreground)", marginTop: 4 }}
                  >
                    {p.detail}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 12 }}>
                <p>
                  Score = weighted average of available contributors. Missing
                  contributors are excluded and remaining weights are rescaled.
                  Partial scores are not directly comparable with full scores.
                </p>
                <p>
                  Duration = hours asleep ÷ 8 × 100, capped at 100. Eight hours
                  is our starting reference, not a measured personal need.
                  Continuity = time asleep ÷ recorded sleep window × 100.
                </p>
                <p>
                  Vitals use the median of five-minute averages overnight,
                  compared with the median of usable nights in the preceding 28
                  days. At least seven prior nights are required per vital.
                  Heart rate needs readings in half the night's intervals; HRV
                  needs at least three intervals. The selected night and future
                  nights never enter its baseline.
                </p>
                <p>
                  Heart-rate score = 100 − 500 × absolute proportional change
                  from baseline. HRV score = 100 − 200 × absolute proportional
                  change. Both are clamped to 0–100; unusually high or low
                  values receive no bonus. These weights and cutoffs are our
                  unvalidated design choices.
                </p>
                <p>
                  Uses your configured source priorities. Keep the device and
                  export method consistent when comparing scores. Training load,
                  temperature, breathing rate, sleep stages, and
                  lowest-heart-rate timing are not scored in v1.
                </p>
                <p>
                  <a
                    href="https://www.cdc.gov/sleep/about/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sleep-duration background (CDC) ↗
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Readiness contributors (Oura) ↗
                  </a>
                  . These references inform the inputs, not our formula.
                </p>
              </div>
            </Disclosure>
          </>
        )
      )}
    </section>
  );
}
