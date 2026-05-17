import { useRef, useState, useCallback } from "react";
import { Upload, FileCheck2, Loader2, AlertTriangle } from "lucide-react";

interface DocumentDropzoneProps {
  busy: boolean;
  filename?: string;
  error?: string;
  onUpload: (file: File) => void;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg,image/webp";

export function DocumentDropzone({ busy, filename, error, onUpload }: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onUpload(files[0]);
    },
    [onUpload],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!busy) setDrag(true);
  };
  const onDragLeave = () => setDrag(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (busy) return;
    handleFiles(e.dataTransfer.files);
  };

  const stateClass = drag
    ? "border-primary bg-primary/5"
    : error
      ? "border-red-300 bg-red-50/50"
      : filename
        ? "border-emerald-300 bg-emerald-50/50"
        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30";

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-4 text-center transition-colors cursor-pointer ${stateClass}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {busy ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Reading {filename || "document"}…</p>
        </>
      ) : error ? (
        <>
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-xs text-red-600 font-medium">{error}</p>
          <p className="text-[10px] text-muted-foreground">Click or drop to retry</p>
        </>
      ) : filename ? (
        <>
          <FileCheck2 className="h-5 w-5 text-emerald-600" />
          <p className="text-xs text-emerald-700 font-medium truncate max-w-full">{filename}</p>
          <p className="text-[10px] text-muted-foreground">Click to replace</p>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs font-medium">Upload supplier invoice (optional)</p>
          <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG · auto-fills the form</p>
        </>
      )}
    </div>
  );
}
