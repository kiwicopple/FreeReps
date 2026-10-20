import { cn } from "@/lib/utils";
import PageSection from "../PageSection";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { uploadAlphaCSV } from "../../api";
import { formatNumber } from "../../utils/format";

function invalidateAllData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["workouts"] });
  queryClient.invalidateQueries({ queryKey: ["sleep"] });
  queryClient.invalidateQueries({ queryKey: ["timeseries"] });
  queryClient.invalidateQueries({ queryKey: ["front-page"] });
  queryClient.invalidateQueries({ queryKey: ["stats"] });
}

export default function ImportTab() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    sets_received: number;
    sets_inserted: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(file: File | null) {
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadAlphaCSV(selectedFile);
      setResult(res);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      invalidateAllData(queryClient);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFileSelect(file);
    }
  }

  return (
    <PageSection
      title="Import"
      description={
        <>
          Upload an Alpha Progression CSV export to bring in set, rep and weight
          data for strength sessions. Rows already stored are skipped.
        </>
      }
    >
      <div
        aria-label="CSV drop zone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "mt-5 max-w-xl rounded-lg border border-dashed p-6 text-center",
          (dragOver || selectedFile) && "border-primary",
          dragOver && "bg-accent",
        )}
      >
        <Input
          nativeInput
          ref={fileRef}
          type="file"
          aria-label="CSV file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
        />
        {selectedFile ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="break-all text-sm font-medium">
              {selectedFile.name}
            </span>
            <Button
              variant="ghost"
              type="button"

              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleFileSelect(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Drop a CSV file here</p>
        )}
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => fileRef.current?.click()}
        >
          Browse CSV files
        </Button>
      </div>

      {selectedFile ? (
        <Button
          variant="default"
          type="button"

          className="mt-4"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      ) : null}

      {error ? (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {result ? (
        <Alert variant="success" role="status" className="mt-4">
          <p className="text-sm font-medium">Upload complete</p>
          <p className="num mt-1.5 text-sm text-muted-foreground">
            {formatNumber(result.sets_received)} sets parsed ·{" "}
            {formatNumber(result.sets_inserted)} new ·{" "}
            {formatNumber(result.sets_received - result.sets_inserted)} already
            stored
          </p>
        </Alert>
      ) : null}
    </PageSection>
  );
}
