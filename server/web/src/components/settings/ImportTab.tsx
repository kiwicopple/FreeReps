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
        role="button"
        tabIndex={0}
        aria-label="Choose CSV file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver || selectedFile ? "var(--primary)" : "var(--border)"}`,
          background: dragOver ? "var(--success-soft)" : "transparent",
          padding: 30,
          textAlign: "center",
          cursor: "pointer",
          marginTop: 20,
          maxWidth: 620,
        }}
      >
        <Input
          nativeInput
          ref={fileRef}
          type="file"
          aria-label="CSV file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
        />
        {selectedFile ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <span style={{ font: "500 13.5px var(--font-body)" }}>
              {selectedFile.name}
            </span>
            <Button
              variant="ghost"
              type="button"

              style={{ fontSize: 12 }}
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
          <p
            style={{
              font: "400 13px var(--font-body)",
              color: "var(--muted-foreground)",
              margin: 0,
            }}
          >
            Drop a CSV file here, or click to browse
          </p>
        )}
      </div>

      {selectedFile ? (
        <Button
          variant="default"
          type="button"

          style={{ marginTop: 16 }}
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      ) : null}

      {error ? (
        <Alert
          variant="error"
          style={{
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {error}
        </Alert>
      ) : null}

      {result ? (
        <Alert variant="success" role="status" style={{ marginTop: 16 }}>
          <p style={{ font: "600 13.5px var(--font-body)", margin: 0 }}>
            Upload complete
          </p>
          <p
            className="num"
            style={{
              font: "400 12.5px var(--font-body)",
              color: "var(--muted-foreground)",
              margin: "6px 0 0",
            }}
          >
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
