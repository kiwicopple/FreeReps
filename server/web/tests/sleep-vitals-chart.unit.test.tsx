import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import SleepVitals from "../src/components/sleep/SleepVitals";
import type { SleepStage, TimeSeriesPoint } from "../src/api";
import { localTimeZone } from "../src/utils/localDate";

const start = Date.parse("2025-01-14T23:00:00Z"),
  end = start + 8 * 3_600_000;
const stage: SleepStage = {
  StartTime: new Date(start).toISOString(),
  EndTime: new Date(end).toISOString(),
  Stage: "Core",
  Source: "Synthetic Watch",
  DurationHr: 8,
};
const point = (minutes: number, avg: number): TimeSeriesPoint => ({
  time: new Date(start + minutes * 60_000).toISOString(),
  avg,
  min: avg - 1,
  max: avg + 1,
  count: 2,
});

// Same-night background updates must not silently select a different interval by array index.
test("inspection follows bucket identity across insertions and recovers when that interval disappears", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const key = ["sleep-vitals", "respiratory_rate", start, end, localTimeZone()];
  client.setQueryData(key, [point(0, 14), point(60, 18)]);
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <SleepVitals
        stages={[stage]}
        value="respiratory_rate"
        onValueChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Next recorded interval" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Next recorded interval" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Avg 18 breaths/min");
  await act(async () => {
    client.setQueryData(key, [point(0, 14), point(30, 16), point(60, 18)]);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Avg 18 breaths/min");
  await act(async () => {
    client.setQueryData(key, [point(0, 14)]);
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "15-minute recorded ranges",
  );
  await user.click(
    screen.getByRole("button", { name: "Previous recorded interval" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Avg 14 breaths/min");
  view.unmount();
  client.clear();
});
