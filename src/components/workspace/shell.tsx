"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Eye,
  FileText,
  Globe,
  History,
  Menu,
  Palette,
  Settings,
  Wallet,
  ListTree,
} from "lucide-react";
import { OpentipMark } from "@/components/brand/logo";
import { UserMenu, type MenuUser } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";

type SwitchSite = { subdomain: string; owner: string; name: string };

const workspaceLinks = [
  { href: "", label: "Preview & chat", icon: Eye },
  { href: "/pages", label: "Pages", icon: FileText },
  { href: "/changelog", label: "Changelog", icon: ListTree },
  { href: "/builds", label: "Builds", icon: History },
];

const siteLinks = [
  { href: "/branding", label: "Branding", icon: Palette },
  { href: "/domain", label: "Domain", icon: Globe },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell({
  user,
  site,
  sites,
  counts,
  banner,
  children,
}: {
  user: MenuUser;
  site: {
    subdomain: string;
    name: string;
    owner: string;
    repo: string;
    host: string;
    status: "PENDING" | "ACTIVE" | "PAUSED";
    reviewMode: "AUTO_PUBLISH" | "REVIEW";
  };
  sites: SwitchSite[];
  counts: { pages: number; changelog: number };
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const base = `/dashboard/w/${site.subdomain}`;
  return (
    <div className="fixed inset-0 z-40 flex bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border md:flex">
        <div className="flex h-14 items-center px-4">
          <OpentipMark />
        </div>
        <WorkspaceNav base={base} counts={counts} />
        <Link href="/dashboard" className="mt-auto px-4 py-4 text-sm text-muted-foreground">
          All workspaces
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <MobileMenu base={base} counts={counts} site={site} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="max-w-[220px] truncate">
                    {site.owner} / {site.name}
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-64">
                {sites.map((item) => (
                  <DropdownMenuItem key={item.subdomain} render={<Link href={`/dashboard/w/${item.subdomain}`} />}>
                    {item.owner} / {item.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem render={<Link href="/dashboard/import" />}>Import repo</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard" />}>All workspaces</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span className={site.status === "ACTIVE" ? "size-1.5 rounded-full bg-live" : "size-1.5 rounded-full bg-muted-foreground"} />
              {site.status === "ACTIVE" ? "Live" : site.status === "PAUSED" ? "Paused" : "Pending"}
            </span>
            <span className="hidden rounded-control border border-border px-2 py-1 text-xs text-muted-foreground lg:inline">
              {site.reviewMode === "AUTO_PUBLISH" ? "Auto-publish" : "Review first"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{site.host}</span>
            <Button nativeButton={false} variant="outline" size="sm" render={<a href={`/sites/${site.subdomain}`} target="_blank" rel="noreferrer" />}>
              Open site
              <ArrowUpRight />
            </Button>
            <UserMenu user={user} />
          </div>
        </header>
        {banner}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function MobileMenu({
  base,
  counts,
  site,
}: {
  base: string;
  counts: { pages: number; changelog: number };
  site: { owner: string; name: string };
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" />}>
        <Menu />
        <span className="sr-only">Sections</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>
            {site.owner} / {site.name}
          </SheetTitle>
        </SheetHeader>
        <WorkspaceNav base={base} counts={counts} />
        <Link href="/dashboard" className="block px-4 py-3 text-sm text-muted-foreground">
          All workspaces
        </Link>
      </SheetContent>
    </Sheet>
  );
}

function WorkspaceNav({
  base,
  counts,
}: {
  base: string;
  counts: { pages: number; changelog: number };
}) {
  return (
    <nav className="flex flex-col gap-4 px-3 py-2">
      <div>
        <p className="px-3 py-1 text-[11px] tracking-widest text-muted-foreground">WORKSPACE</p>
        {workspaceLinks.map((item) => (
          <SectionLink
            key={item.label}
            href={`${base}${item.href}`}
            label={item.label}
            icon={item.icon}
            count={item.href === "/pages" ? counts.pages : item.href === "/changelog" ? counts.changelog : undefined}
            exact={item.href === ""}
          />
        ))}
      </div>
      <div>
        <p className="px-3 py-1 text-[11px] tracking-widest text-muted-foreground">SITE</p>
        {siteLinks.map((item) => (
          <SectionLink key={item.label} href={`${base}${item.href}`} label={item.label} icon={item.icon} />
        ))}
      </div>
    </nav>
  );
}

function SectionLink({
  href,
  label,
  icon: Icon,
  count,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-control px-3 py-2 text-sm",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="text-xs text-muted-foreground">{count}</span> : null}
    </Link>
  );
}
