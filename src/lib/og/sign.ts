import { createHmac, timingSafeEqual } from "node:crypto";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type OgParams = {
  siteName: string;
  section: string;
  title: string;
  description: string;
  primary: string;
  logo: string;
  background: string;
};

export type OgParseResult =
  | { ok: true; params: OgParams }
  | { ok: false; error: string };

function limited(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  return trimmed;
}

function optionalUrl(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > max) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function parseOgParams(input: {
  siteName?: string | null;
  section?: string | null;
  title?: string | null;
  description?: string | null;
  primary?: string | null;
  logo?: string | null;
  background?: string | null;
}): OgParseResult {
  const siteName = limited(input.siteName ?? "", 80);
  const section = limited(input.section ?? "", 80);
  const title = limited(input.title ?? "", 140);
  const description = limited(input.description ?? "", 300);
  const primary = (input.primary ?? "").trim();
  const logo = optionalUrl(input.logo ?? "", 500);
  const background = optionalUrl(input.background ?? "", 500);
  if (
    siteName === null ||
    section === null ||
    title === null ||
    description === null ||
    logo === null ||
    background === null
  ) {
    return { ok: false, error: "param_too_long" };
  }
  if (!title || !siteName) return { ok: false, error: "missing_param" };
  if (!HEX.test(primary)) return { ok: false, error: "invalid_color" };
  return {
    ok: true,
    params: {
      siteName,
      section,
      title,
      description,
      primary,
      logo,
      background,
    },
  };
}

export function canonicalOgPayload(params: OgParams): string {
  return [
    "v1",
    params.siteName,
    params.section,
    params.title,
    params.description,
    params.primary,
    params.logo,
    params.background,
  ].join("\n");
}

export function signOgPayload(params: OgParams, secret: string): string {
  return createHmac("sha256", secret)
    .update(canonicalOgPayload(params))
    .digest("base64url");
}

export function verifyOgSignature(
  params: OgParams,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret || !signature) return false;
  const expected = signOgPayload(params, secret);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export function buildOgImagePath(params: OgParams, secret: string): string {
  const query = new URLSearchParams({
    site: params.siteName,
    section: params.section,
    title: params.title,
    description: params.description,
    primary: params.primary,
    sig: signOgPayload(params, secret),
  });
  if (params.logo) query.set("logo", params.logo);
  if (params.background) query.set("background", params.background);
  return `/api/og?${query.toString()}`;
}
