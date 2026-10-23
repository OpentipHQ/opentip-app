import { describe, expect, it } from "vitest";
import {
  buildOgImagePath,
  parseOgParams,
  signOgPayload,
  verifyOgSignature,
  type OgParams,
} from "@/lib/og/sign";

const SECRET = "og-signing-secret";

const params: OgParams = {
  siteName: "Sample",
  section: "Guides",
  title: "Updates on every push",
  description: "Opentip rewrites the page when the repo changes.",
  primary: "#2A2AD6",
  logo: "https://example.com/logo.png",
  background: "",
};

describe("signed OG images", () => {
  it("accepts a signature for the same params and secret", () => {
    const signature = signOgPayload(params, SECRET);
    expect(verifyOgSignature(params, signature, SECRET)).toBe(true);
  });

  it("rejects a tampered title, a wrong secret, and a missing signature", () => {
    const signature = signOgPayload(params, SECRET);
    expect(
      verifyOgSignature({ ...params, title: "Something else" }, signature, SECRET),
    ).toBe(false);
    expect(verifyOgSignature(params, signature, "other-secret")).toBe(false);
    expect(verifyOgSignature(params, null, SECRET)).toBe(false);
    expect(verifyOgSignature(params, signature.slice(0, 8), SECRET)).toBe(false);
  });

  it("rejects colors and logo URLs that are not safe to render", () => {
    expect(parseOgParams({ ...queryOf(params), primary: "red" }).ok).toBe(false);
    expect(
      parseOgParams({ ...queryOf(params), logo: "http://example.com/logo.png" }).ok,
    ).toBe(false);
    expect(parseOgParams({ ...queryOf(params), title: "" }).ok).toBe(false);
    const parsed = parseOgParams(queryOf(params));
    expect(parsed.ok).toBe(true);
  });

  it("puts the signature on the image path", () => {
    const path = buildOgImagePath(params, SECRET);
    const url = new URL(path, "https://beta.opentip.tech");
    expect(url.pathname).toBe("/api/og");
    expect(url.searchParams.get("title")).toBe(params.title);
    expect(url.searchParams.get("sig")).toBe(signOgPayload(params, SECRET));
  });
});

function queryOf(value: OgParams) {
  return {
    siteName: value.siteName,
    section: value.section,
    title: value.title,
    description: value.description,
    primary: value.primary,
    logo: value.logo,
    background: value.background,
  };
}
