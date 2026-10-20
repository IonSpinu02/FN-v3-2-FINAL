"use client";

import { useCallback, useState } from "react";

export function CsvDropzone({
  label,
  onText,
  accept = ".csv",
}: {
  label: string;
  onText: (text: string) => void;
  accept?: string;
}) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = `csv-${label.replace(/\W+/g, "-")}`;

  const readFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Seleziona un file .csv");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        setName(file.name);
        onText(text);
      };
      reader.onerror = () => setError("Lettura file fallita");
      reader.readAsText(file, "UTF-8");
    },
    [onText],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="fn-label" htmlFor={inputId}>
        {label}
      </label>
      <div
        className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-fn-border bg-fn-surface px-4 py-8 text-center transition hover:border-fn-accent hover:bg-fn-accent-soft/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          id={inputId}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
          }}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm text-fn-text-muted">
          Trascina un CSV qui o{" "}
          <span className="font-semibold text-fn-accent">sfoglia</span>
        </label>
        {name && (
          <p className="mt-2 text-xs font-medium text-fn-accent">
            Caricato: {name}
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-fn-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
