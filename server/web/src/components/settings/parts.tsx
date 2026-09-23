import { Label } from "@/components/ui/label";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { Input } from "@/components/ui/input";
import { useId, type ReactNode } from "react";

/** The shared row: label column, value, both on one baseline. */
export function Row({
  label,
  labelWidth = 180,
  children,
}: {
  label: ReactNode;
  labelWidth?: number;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  return (
    <div
      data-slot="setting-row"
      style={{
        display: "grid",
        gridTemplateColumns: desktop
          ? `${labelWidth}px minmax(0,1fr)`
          : "minmax(0,1fr)",
        alignItems: "baseline",
        gap: desktop ? 24 : 10,
        padding: "15px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Label render={<span />} className="kick">
        {label}
      </Label>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

/** Tab heading, explanatory paragraph, then content under a 2px rule. */
export function TabHeader({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      <p
        style={{
          font: "400 13px/1.55 var(--font-body)",
          color: "var(--muted-foreground)",
          maxWidth: "62ch",
          margin: "10px 0 0",
        }}
      >
        {children}
      </p>
      <div
        style={{
          borderTop: "2px solid var(--foreground)",
          marginTop: 20,
        }}
      />
    </>
  );
}

export const MONO: React.CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 12.5,
};

/**
 * The redirect URI an OAuth provider has to have registered.
 *
 * Shown because it is the one setup value the operator cannot look up anywhere:
 * the server derives it from the address FreeReps was reached on, so a guess that
 * differs in scheme, port or hostname fails at the end of the authorization flow
 * rather than when it is entered.
 */
export function RedirectURIRow({ uri }: { uri: string }) {
  const inputId = useId();
  return (
    <div style={{ paddingTop: 18, maxWidth: 560 }}>
      <Label className="kick" htmlFor={inputId}>
        Redirect URI
      </Label>
      <Input
        id={inputId}

        style={{ ...MONO, width: "100%", marginTop: 8 }}
        readOnly
        value={uri}
        onClick={(e) => e.currentTarget.select()}
      />
      <p
        style={{
          font: "400 12px/1.5 var(--font-body)",
          color: "var(--muted-foreground)",
          margin: "6px 0 0",
        }}
      >
        Register this exact value with the provider. It follows the address you
        reach FreeReps on, so it changes with the hostname; set{" "}
        <code>server.base_url</code> in the config to pin it to one value.
      </p>
    </div>
  );
}
