import { rgb, type RGB } from "pdf-lib";

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706"
};

export function normalizeHex(color = "#111827"): string {
  const named = NAMED[color.toLowerCase()];
  const source = named ?? color;
  if (/^#[0-9a-f]{6}$/i.test(source)) return source;
  if (/^#[0-9a-f]{3}$/i.test(source)) {
    const [, r, g, b] = source;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#111827";
}

export function hexToRgbNumber(color = "#111827"): [number, number, number] {
  const hex = normalizeHex(color).slice(1);
  const value = Number.parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function hexToPdfRgb(color = "#111827"): RGB {
  const [r, g, b] = hexToRgbNumber(color);
  return rgb(r / 255, g / 255, b / 255);
}

export function contrastTextColor(background = "#ffffff"): string {
  const [r, g, b] = hexToRgbNumber(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}
