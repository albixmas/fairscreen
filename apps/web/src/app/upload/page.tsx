"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UploadResult {
  filename: string;
  cvFileId?: string;
  status?: string;
  error?: string;
}

interface FileRecord {
  id: string;
  filename: string;
  fileType: string;
  parseStatus: string;
  createdAt: string;
  candidate?: {
    id: string;
    fullName: string;
    axisScore?: { eduScore: number; careerScore: number };
    zoneAssignments?: Array<{ zone: string }>;
  };
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/upload");
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Failed to fetch files:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList: FileList | File[]) => {
    setUploading(true);
    setResults([]);

    const formData = new FormData();
    for (const file of Array.from(fileList)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(data.results || []);
      fetchFiles();
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
          Upload CVs
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Drag and drop PDF or DOCX files to begin screening
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "drop-zone relative flex flex-col items-center justify-center py-20 px-8 cursor-pointer",
          isDragging && "active",
          uploading && "opacity-60 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />

        <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <p className="text-[15px] font-medium text-foreground">
          {uploading ? "Uploading..." : "Drop CVs here or click to browse"}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          PDF and DOCX files supported. Up to 1,000+ files at once.
        </p>
      </div>

      {/* Upload results */}
      {results.length > 0 && (
        <div className="apple-card p-6">
          <h3 className="text-[15px] font-semibold mb-3">Upload Results</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                <span className="text-[13px] font-medium truncate max-w-[300px]">{r.filename}</span>
                <span className={cn(
                  "text-[12px] font-medium px-2 py-0.5 rounded-full",
                  r.error
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-600"
                )}>
                  {r.error || r.status || "Queued"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      <div className="apple-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30">
          <h3 className="text-[15px] font-semibold">Processing Queue</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {files.length} files uploaded
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            No files uploaded yet. Drop some CVs above to get started.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {files.slice(0, 50).map((f) => (
              <div key={f.id} className="flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-smooth">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {f.fileType}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{f.filename}</p>
                    {f.candidate && (
                      <p className="text-[11px] text-muted-foreground">
                        {f.candidate.fullName}
                        {f.candidate.axisScore && (
                          <> — E: {f.candidate.axisScore.eduScore.toFixed(1)} / C: {f.candidate.axisScore.careerScore.toFixed(1)}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={f.parseStatus} zone={f.candidate?.zoneAssignments?.[0]?.zone} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, zone }: { status: string; zone?: string }) {
  if (zone) {
    const colors: Record<string, string> = {
      STRONG_YES: "bg-emerald-50 text-emerald-700",
      YES: "bg-green-50 text-green-700",
      MAYBE: "bg-amber-50 text-amber-700",
      NO: "bg-red-50 text-red-600",
      PRESCREEN_FAIL: "bg-gray-100 text-gray-500",
    };
    const labels: Record<string, string> = {
      STRONG_YES: "Strong Yes",
      YES: "Yes",
      MAYBE: "Maybe",
      NO: "No",
      PRESCREEN_FAIL: "Pre-screen Fail",
    };
    return (
      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", colors[zone] || "bg-gray-100 text-gray-500")}>
        {labels[zone] || zone}
      </span>
    );
  }

  const colors: Record<string, string> = {
    QUEUED: "bg-blue-50 text-blue-600",
    RUNNING: "bg-amber-50 text-amber-600",
    SUCCEEDED: "bg-green-50 text-green-600",
    FAILED: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", colors[status] || "bg-gray-100 text-gray-500")}>
      {status}
    </span>
  );
}
