import { buttonVariants } from "@/components/ui/button";
import { Link } from "react-router-dom";
import PageHeader from "./PageHeader";

/**
 * Metrics and Correlations need width the phone does not have — a 248px rail
 * beside a 420px chart, and a 720×520 scatter beside a 440px stats column.
 * Both routes stay reachable by URL rather than 404ing, because someone will
 * follow a link from a laptop session.
 */
export default function DesktopOnly({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div
        className="page-x"
        style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}
      >
        <p
          style={{
            font: "400 13px/1.55 var(--font-body)",
            color: "var(--muted-foreground)",
            maxWidth: "42ch",
            margin: 0,
          }}
        >
          Metrics and Correlations need a wider screen. Open Protocol on a
          desktop.
        </p>
        <Link
          to="/trends"
          className={buttonVariants({ variant: "ghost" })}
          style={{ fontSize: 12.5, marginTop: 14, marginLeft: -4 }}
        >
          Go to Trends →
        </Link>
      </div>
    </>
  );
}
