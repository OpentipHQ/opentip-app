"use client";

import { useState } from "react";
import { highlight } from "@/components/docs/highlight";

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const html = highlight(code, language);
  return (
    <div className="my-1 overflow-hidden rounded-control border border-border bg-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          {language}
        </span>
        <button
          type="button"
          className="text-xs text-foreground"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
