import type { ShellItem } from "@/components/shell/app-shell";

export const dashboardNav: ShellItem[] = [
  { href: "/dashboard", label: "Import" },
  { href: "/dashboard/sites", label: "Sites" },
  { href: "/dashboard/worklog", label: "Changelog" },
  { href: "/dashboard/usage", label: "Usage" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/profile", label: "Profile" },
];

export const adminNav: ShellItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/installs", label: "Installs" },
  { href: "/admin/tips", label: "Tips" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/alerts", label: "Spend alerts" },
  { href: "/admin/activity", label: "Activity" },
];
