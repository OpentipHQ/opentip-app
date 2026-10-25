import { describe, expect, it } from "vitest";
import { decideProxy, resolveHost } from "@/lib/sites/host";

const options = {
  appHosts: ["beta.opentip.tech", "localhost"],
  docsRootDomain: "opentip.tech",
};

describe("docs host routing", () => {
  it("keeps the app host and sends a subdomain to the docs renderer", () => {
    expect(resolveHost("beta.opentip.tech", options)).toEqual({ kind: "app" });
    expect(resolveHost("ledger.opentip.tech", options)).toEqual({
      kind: "docs",
      subdomain: "ledger",
    });
    expect(resolveHost("ledger.beta.opentip.tech", options)).toEqual({
      kind: "docs",
      subdomain: "ledger",
    });
    expect(resolveHost("docs.customer.com", options)).toEqual({
      kind: "custom",
      host: "docs.customer.com",
    });
  });

  it("rewrites a docs host and protects the dashboard", () => {
    expect(
      decideProxy({
        host: "ledger.opentip.tech",
        pathname: "/guides/push",
        ...options,
      }),
    ).toEqual({
      kind: "rewrite",
      pathname: "/sites/ledger/guides/push",
      publicHost: "ledger.opentip.tech",
    });
    expect(
      decideProxy({
        host: "beta.opentip.tech",
        pathname: "/admin/usage",
        ...options,
      }),
    ).toEqual({ kind: "protect", area: "admin" });
    expect(
      decideProxy({
        host: "ledger.opentip.tech",
        pathname: "/api/og",
        ...options,
      }),
    ).toEqual({ kind: "next" });
  });

  it("protects the profile page", () => {
    expect(
      decideProxy({
        host: "beta.opentip.tech",
        pathname: "/profile",
        ...options,
      }),
    ).toEqual({ kind: "protect", area: "profile" });
  });
});
