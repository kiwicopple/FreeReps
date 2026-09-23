import { Label } from "@/components/ui/label";
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
  return (
    <div
      data-slot="setting-row"
      className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[var(--setting-label-width)_minmax(0,1fr)] md:gap-6"
      style={
        { "--setting-label-width": `${labelWidth}px` } as React.CSSProperties
      }
    >
      <Label render={<span />} className="kick">
        {label}
      </Label>
      <div className="w-full min-w-0">{children}</div>
    </div>
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
