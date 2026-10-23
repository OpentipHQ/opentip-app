import { OPENTIP_BLUE } from "@/lib/brand";
import type { DocsSite } from "@/lib/sites/types";

export const SAMPLE_SUBDOMAIN = "sample";

export function sampleSite(): DocsSite {
  return {
    id: "preview_sample",
    name: "Sample",
    description: "Preview docs rendered by Opentip when a database is not connected.",
    subdomain: SAMPLE_SUBDOMAIN,
    customDomain: null,
    customDomainStatus: null,
    status: "ACTIVE",
    pausedReason: null,
    theme: "LEDGER",
    appearance: "LIGHT",
    primaryColor: OPENTIP_BLUE,
    logoLightUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    logoHref: null,
    ogBackgroundUrl: null,
    ogImageUrl: null,
    source: "preview",
    pages: [
      {
        slug: "",
        section: "Overview",
        title: "Sample docs",
        description: "A preview of a hosted Opentip docs site.",
        navOrder: 0,
        published: true,
        noindex: false,
        handEdited: false,
        ogImageUrl: null,
        content: [
          "This site is preview data. It is what a customer docs site looks like before a Neon database is connected.",
          "Opentip writes the docs for a GitHub repo and updates them on every push. The Opentip GitHub App signs people in and receives those pushes.",
          "Connect a repository, pick a subdomain, and set a logo, favicon, and primary color. Free sites can use the Ledger or Minimal theme.",
        ].join("\n\n"),
      },
      {
        slug: "guides/push-updates",
        section: "Guides",
        title: "Updates on every push",
        description: "A push to the connected repo queues a small docs update.",
        navOrder: 1,
        published: true,
        noindex: false,
        handEdited: false,
        ogImageUrl: null,
        content: [
          "A push webhook is checked, then stored once. If GitHub delivers the same event again, Opentip does not queue a second job.",
          "Small updates run on Groq gpt-oss-120b. A first full build runs on xAI grok-build-0.1. If those keys are missing in development, a fake provider is used.",
          "Pages a customer edited by hand are marked and are not overwritten silently.",
        ].join("\n\n"),
      },
      {
        slug: "guides/branding",
        section: "Guides",
        title: "Logo, color, and favicon",
        description: "Each site carries its own logo, favicon, primary color, and theme.",
        navOrder: 2,
        published: true,
        noindex: false,
        handEdited: false,
        ogImageUrl: null,
        content: [
          "A site can store a light logo, a dark logo, a favicon, and one primary color. That color tints links, the active section, and the generated social image.",
          "Every published page gets a signed 1200 by 630 image with the logo, section, title, and description. A bad signature is rejected.",
          "The corner pill on this page links back to opentip.tech.",
        ].join("\n\n"),
      },
    ],
  };
}
