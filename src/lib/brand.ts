export const OPENTIP_BLUE = "#2A2AD6";
export const OPENTIP_BACKGROUND = "#FAFAFA";
export const OPENTIP_HAIRLINE = "#EBEBEB";
export const OPENTIP_INK = "#171717";
export const OPENTIP_MUTED = "#6B6B6B";
export const MARKETING_URL = "https://opentip.tech";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeColor(value: string | null | undefined): string {
  if (value && HEX.test(value)) return value;
  return OPENTIP_BLUE;
}
