"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Menu } from "lucide-react";
import { BuiltWithOpentip } from "@/components/docs/built-with";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "cn";

export type DocsNavItem = {
  href: string;
  title: string;
  section: string | null;
  slug: string;
};

export function DocsChrome({
  name,
  theme,
  appearance,
  primaryColor,
  logoLightUrl,
  logoDarkUrl,
  logoHref,
  items,
  currentSlug,
  section,
  title,
  description,
  children,
}: {
  name: string;
  theme: "LEDGER" | "MINIMAL";
  appearance: "SYSTEM" | "LIGHT" | "DARK";
  primaryColor: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoHref: string | null;
  items: DocsNavItem[];
  currentSlug: string;
  section: string | null;
  title: string;
  description: string | null;
  children: React.ReactNode;
}) {
  const systemDark = useSyncExternalStore(
    subscribeToColorScheme,
    prefersDark,
    () => false,
  );
  const dark = appearance === "DARK" || (appearance === "SYSTEM" && systemDark);

  const logo = dark ? logoDarkUrl || logoLightUrl : logoLightUrl || logoDarkUrl;
  const sections = groupSections(items);

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", dark && "dark")}
      style={{ "--docs-primary": primaryColor } as React.CSSProperties}
    >
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-white md:flex dark:bg-card">
          <Brand name={name} logo={logo} logoHref={logoHref} />
          <DocsNav sections={sections} currentSlug={currentSlug} />
        </aside>
        <div className="md:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-white px-4 md:hidden dark:bg-card">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" size="icon" />}>
                <Menu />
                <span className="sr-only">Open sections</span>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>{name}</SheetTitle>
                </SheetHeader>
                <DocsNav sections={sections} currentSlug={currentSlug} />
              </SheetContent>
            </Sheet>
            <span className="text-sm">{name}</span>
          </header>
          <article
            className={cn(
              "mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 pb-24 md:px-10 md:py-12",
              theme === "LEDGER" && "md:border-l md:border-border",
            )}
          >
            {theme === "LEDGER" && section ? (
              <p className="font-mono text-xs tracking-widest text-(--docs-primary) uppercase">
                {section}
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl tracking-tight md:text-4xl">{title}</h1>
              {description ? (
                <p className="text-base leading-7 text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {children}
          </article>
        </div>
        <BuiltWithOpentip />
      </div>
    </div>
  );
}

function Brand({
  name,
  logo,
  logoHref,
}: {
  name: string;
  logo: string | null;
  logoHref: string | null;
}) {
  const mark = logo ? (
    // Customer logos are arbitrary https URLs, so this stays a plain image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={`${name} logo`} className="h-7 w-auto" />
  ) : (
    <span className="text-sm">{name}</span>
  );
  return (
    <div className="flex h-14 items-center px-5">
      {logoHref ? <a href={logoHref}>{mark}</a> : mark}
    </div>
  );
}

function DocsNav({
  sections,
  currentSlug,
}: {
  sections: Array<{ section: string; items: DocsNavItem[] }>;
  currentSlug: string;
}) {
  return (
    <nav className="flex flex-col gap-5 overflow-y-auto px-3 py-4">
      {sections.map((group) => (
        <div key={group.section} className="flex flex-col gap-1">
          <p className="px-3 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            {group.section}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.slug || "home"}
              href={item.href}
              className={cn(
                "rounded-control px-3 py-1.5 text-sm",
                item.slug === currentSlug
                  ? "bg-accent text-(--docs-primary)"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function subscribeToColorScheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function groupSections(items: DocsNavItem[]) {
  const groups: Array<{ section: string; items: DocsNavItem[] }> = [];
  for (const item of items) {
    const section = item.section || "Docs";
    const last = groups[groups.length - 1];
    if (!last || last.section !== section) {
      groups.push({ section, items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return groups;
}
