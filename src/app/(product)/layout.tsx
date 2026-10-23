import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    images: [{ url: "/brand/og.png", width: 1200, height: 630 }],
  },
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
