"use client";

import { useState } from "react";
import { LiveRefresh } from "@/components/sites/live-refresh";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendChatEditAction } from "@/app/(product)/dashboard/sites/[id]/actions";
import { discardDraftAction, publishDraftAction } from "@/app/(product)/dashboard/w/[site]/actions";
import { cn } from "cn";

type PageOption = { id: string; slug: string; title: string; pending: boolean };

export function PreviewChat({
  siteId,
  subdomain,
  host,
  pages,
  pendingCount,
  chats,
  running,
}: {
  siteId: string;
  subdomain: string;
  host: string;
  pages: PageOption[];
  pendingCount: number;
  chats: Array<{ id: string; instruction: string; createdAt: string; status: string | null; error: string | null }>;
  running: boolean;
}) {
  const [panel, setPanel] = useState<"preview" | "chat">("preview");
  const [slug, setSlug] = useState(pages.find((page) => page.pending)?.slug ?? pages[0]?.slug ?? "");
  const page = pages.find((item) => item.slug === slug) ?? pages[0];
  const path = slug ? `/${slug}` : "/";
  const src = `/preview/${subdomain}${slug ? `/${slug}` : ""}`;
  const back = `/dashboard/w/${subdomain}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LiveRefresh active={running} />
      <div className="flex gap-2 border-b border-border p-2 md:hidden">
        {(["preview", "chat"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPanel(item)}
            className={cn(
              "flex-1 rounded-control border px-3 py-2 text-sm",
              panel === item ? "border-meter text-link" : "border-border text-muted-foreground",
            )}
          >
            {item === "preview" ? "Preview" : "Chat"}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <section className={cn("min-w-0 flex-1 flex-col", panel === "chat" ? "hidden md:flex" : "flex")}>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <select
              value={page?.slug ?? ""}
              onChange={(event) => setSlug(event.target.value)}
              className="h-8 rounded-control border border-border bg-background px-2 text-sm"
              aria-label="Page"
            >
              {pages.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {host}
              {path}
            </span>
            {pendingCount > 0 ? (
              <span className="rounded-control border border-meter px-2 py-0.5 text-xs text-link">Draft preview</span>
            ) : (
              <span className="rounded-control border border-border px-2 py-0.5 text-xs text-muted-foreground">Live</span>
            )}
          </div>
          <iframe title="Docs preview" src={src} className="min-h-0 w-full flex-1 bg-white" />
        </section>
        <aside className={cn("w-full flex-col border-border md:flex md:w-80 md:border-l", panel === "preview" ? "hidden" : "flex")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm">Agent</p>
            <span className="text-xs text-muted-foreground">Whole site</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            {chats.map((chat) => (
              <div key={chat.id} className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{chat.createdAt.slice(0, 16).replace("T", " ")}</p>
                <div className="rounded-control bg-muted px-3 py-2 text-sm">{chat.instruction}</div>
                {chat.error ? <p className="text-sm text-destructive">{chat.error}</p> : null}
                {chat.status === "QUEUED" || chat.status === "RUNNING" ? (
                  <p className="text-sm text-muted-foreground">Editing</p>
                ) : null}
              </div>
            ))}
            {pendingCount > 0 ? (
              <div className="mt-auto flex flex-col gap-3 rounded-control border border-border p-3">
                <p className="text-sm">
                  <span className="mr-2 inline-block size-1.5 rounded-full bg-live" />
                  Draft ready
                </p>
                <div className="flex justify-end gap-2">
                  <form action={discardDraftAction}>
                    <input type="hidden" name="siteId" value={siteId} />
                    <input type="hidden" name="subdomain" value={subdomain} />
                    <SubmitButton variant="outline" size="sm">
                      Discard
                    </SubmitButton>
                  </form>
                  <form action={publishDraftAction}>
                    <input type="hidden" name="siteId" value={siteId} />
                    <input type="hidden" name="subdomain" value={subdomain} />
                    <SubmitButton size="sm">Publish changes</SubmitButton>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
          <form action={sendChatEditAction} className="border-t border-border p-3">
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="returnTo" value={back} />
            <input type="hidden" name="pageId" value={page?.id ?? ""} />
            <label className="flex flex-col gap-2">
              <span className="sr-only">Edit</span>
              <textarea
                name="instruction"
                required
                rows={3}
                placeholder="Ask for an edit"
                className="w-full resize-none rounded-control border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{page ? `@ ${page.title}` : "@ page"}</span>
                <Button type="submit" size="sm">
                  Send
                </Button>
              </div>
            </label>
          </form>
        </aside>
      </div>
    </div>
  );
}
