"use client";

import { useCallback, useRef, useState } from "react";

interface CSVUploaderProps {
  onEmailsParsed: (emails: string[]) => void;
  emails: string[];
}

export default function CSVUploader({ onEmailsParsed, emails }: CSVUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseEmails = useCallback(
    (text: string) => {
      setParseError(null);

      // Try to extract emails from CSV/text content
      // Supports: one email per line, comma-separated, or CSV with email column
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = text.match(emailRegex);

      if (!matches || matches.length === 0) {
        setParseError("No valid email addresses found in the file");
        return;
      }

      // Deduplicate and lowercase
      const uniqueEmails = [...new Set(matches.map((e) => e.toLowerCase()))];
      onEmailsParsed(uniqueEmails);
    },
    [onEmailsParsed]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(csv|txt|text)$/i)) {
        setParseError("Please upload a .csv or .txt file");
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseEmails(text);
      };
      reader.readAsText(file);
    },
    [parseEmails]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        Recipients
      </label>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragging
              ? "border-violet-500 bg-violet-500/10"
              : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />

        <svg
          className="w-8 h-8 text-slate-500 mx-auto mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {fileName ? (
          <p className="text-sm text-slate-300">
            <span className="font-medium text-violet-400">{fileName}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Drop a <span className="text-slate-400">.csv</span> or{" "}
            <span className="text-slate-400">.txt</span> file here, or{" "}
            <span className="text-violet-400 underline">browse</span>
          </p>
        )}
      </div>

      {/* Parsed count */}
      {emails.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-sm text-emerald-400">
            {emails.length} email{emails.length !== 1 ? "s" : ""} detected
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEmailsParsed([]);
              setFileName(null);
            }}
            className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Error */}
      {parseError && (
        <p className="mt-2 text-xs text-red-400">{parseError}</p>
      )}

      {/* Manual input hint */}
      <p className="mt-2 text-xs text-slate-600">
        Or paste comma-separated emails in the text area below
      </p>

      {/* Manual text input for emails */}
      <textarea
        placeholder="email1@example.com, email2@example.com, ..."
        value={emails.join(", ")}
        onChange={(e) => {
          const text = e.target.value;
          if (text.trim() === "") {
            onEmailsParsed([]);
            return;
          }
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const matches = text.match(emailRegex);
          if (matches) {
            onEmailsParsed([...new Set(matches.map((e) => e.toLowerCase()))]);
          }
        }}
        rows={3}
        className="mt-2 w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200 text-sm resize-y"
      />
    </div>
  );
}
