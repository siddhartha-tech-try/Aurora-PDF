import type { Theme } from "../types.js";

export const DEFAULT_THEME: Required<Theme> = {
  fontFamily: "Helvetica",
  headingFontFamily: "Helvetica-Bold",
  fontSize: 11,
  lineGap: 4,
  textColor: "#111827",
  mutedColor: "#6b7280",
  primaryColor: "#2563eb",
  borderColor: "#d1d5db",
  tableHeaderFill: "#eff6ff",
  tableStripeFill: "#f9fafb",
  backgroundColor: "#ffffff"
};

export function mergeTheme(theme?: Theme): Required<Theme> {
  return {
    ...DEFAULT_THEME,
    ...(theme ?? {})
  };
}
