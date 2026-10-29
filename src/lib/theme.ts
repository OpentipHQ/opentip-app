export const THEME_COOKIE = "opentip-theme";

export type Theme = "dark" | "light" | "system";

export function normalizeTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "system" ? value : "dark";
}
