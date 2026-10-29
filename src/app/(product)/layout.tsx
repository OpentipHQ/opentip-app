import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppToaster } from "@/components/ui/app-toaster";
import { normalizeTheme, THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        url: "/favicon-dark.ico",
        sizes: "any",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon-32-dark.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icons/icon-192-dark.png",
        sizes: "192x192",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icons/icon-512-dark.png",
        sizes: "512x512",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "/icons/apple-touch-icon-dark.png",
        sizes: "180x180",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
  openGraph: {
    description: "Hosted docs and a Changelog for GitHub repos.",
    images: [{ url: "/brand/og.png", width: 1200, height: 630 }],
  },
};

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <ThemeProvider initialTheme={theme}>
      {children}
      <Suspense fallback={null}>
        <AppToaster />
      </Suspense>
    </ThemeProvider>
  );
}
