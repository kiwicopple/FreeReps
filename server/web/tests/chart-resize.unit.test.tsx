import { act, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AutoSizeUplot from "../src/components/AutoSizeUplot";
import type uPlot from "uplot";

const plot = vi.hoisted(() => ({
  create: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("uplot", () => ({
  default: class {
    constructor(opts: unknown, data: unknown) {
      plot.create(opts, data);
    }
    setSize(size: unknown) {
      plot.resize(size);
    }
    destroy() {
      plot.destroy();
    }
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// Resize-only changes must leave the same uPlot instance (and its interaction state) alive.
test("container resize and hidden-panel activation keep the plot instance", () => {
  let width = 0;
  let notify!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ width }) as DOMRect,
  );
  const opts: uPlot.Options = { width: 0, height: 300, series: [{}, {}] };
  const data: uPlot.AlignedData = [
    [1, 2],
    [60, 62],
  ];
  const view = render(<AutoSizeUplot opts={opts} data={data} />);
  expect(plot.create).not.toHaveBeenCalled();
  act(() => {
    width = 800;
    notify();
  });
  expect(plot.create).toHaveBeenCalledExactlyOnceWith(
    { ...opts, width: 800 },
    data,
  );
  act(() => {
    width = 960;
    notify();
  });
  expect(plot.resize).toHaveBeenLastCalledWith({ width: 960, height: 300 });
  act(() => {
    width = 0;
    notify();
  });
  expect(plot.resize).toHaveBeenCalledTimes(1);
  act(() => {
    width = 640;
    notify();
  });
  expect(plot.resize).toHaveBeenLastCalledWith({ width: 640, height: 300 });
  expect(plot.create).toHaveBeenCalledTimes(1);
  expect(plot.destroy).not.toHaveBeenCalled();
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(plot.destroy).toHaveBeenCalledTimes(1);
});
