import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocsMarkdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-[15px] leading-7">{children}</p>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-(--docs-primary) underline underline-offset-4">
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-7">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-7">{children}</ol>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl border border-border bg-white p-4 font-mono text-[13px] leading-6">
              {children}
            </pre>
          ),
          h2: ({ children }) => <h2 className="pt-2 text-xl tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="pt-2 text-lg tracking-tight">{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
