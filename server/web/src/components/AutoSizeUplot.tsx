import { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface Props {
  opts: uPlot.Options;
  data: uPlot.AlignedData;
}

/** Keep the live chart on container-only resizes, including sidebar and tab changes. */
export default function AutoSizeUplot({ opts, data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current,
      target = chartRef.current;
    if (!container || !target) return;
    let chart: uPlot | undefined;
    const resize = () => {
      const width = Math.floor(container.getBoundingClientRect().width);
      if (width <= 0) return;
      if (!chart)
        chart = new uPlot(
          { ...opts, width, height: opts.height ?? 300 },
          data,
          target,
        );
      else chart.setSize({ width, height: opts.height ?? 300 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => {
      observer.disconnect();
      chart?.destroy();
    };
  }, [opts, data]);
  return (
    <div ref={containerRef} className="w-full min-w-0">
      <div ref={chartRef} />
    </div>
  );
}
