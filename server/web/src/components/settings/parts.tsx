import { Button } from "../ui/button";
import { Field, FieldLabel, FieldDescription, FieldError } from "../ui/field";
import { Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useId, useState, type ReactNode } from "react";

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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <Field invalid={!!error} className="mt-4 max-w-xl">
      <FieldLabel htmlFor={inputId}>Redirect URI</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Input
          id={inputId}
          className="min-w-0 flex-1 font-mono text-xs"
          readOnly
          value={uri}
          onClick={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          aria-label="Copy redirect URI"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(uri);
              setCopied(true);
              setError("");
            } catch {
              setCopied(false);
              setError("Copy failed. Select the address and copy it manually.");
            }
          }}
        >
          <Copy />
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <FieldDescription>
        Register this exact value with the provider. It follows the address you
        reach Protocol on; configure <code>server.base_url</code> to pin it.
      </FieldDescription>
      {error && <FieldError match={true}>{error}</FieldError>}
    </Field>
  );
}
