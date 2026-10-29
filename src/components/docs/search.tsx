"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";

export type DocsSearchItem = {
  href: string;
  title: string;
  section: string | null;
  text: string;
};

export function DocsSearch({ items }: { items: DocsSearchItem[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches =
    needle.length === 0
      ? []
      : items
          .filter((item) => `${item.title} ${item.section ?? ""} ${item.text}`.toLowerCase().includes(needle))
          .slice(0, 8);
  return (
    <div className="relative">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
        <input
          aria-label="Search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-full rounded-control border border-border bg-background pr-2 pl-8 text-sm outline-none focus:border-foreground"
        />
      </label>
      {needle.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-control border border-border bg-background shadow-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            matches.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setQuery("")}
                  className="block px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="block">{item.title}</span>
                  {item.section ? (
                    <span className="block text-xs text-muted-foreground">{item.section}</span>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
