import type { Margin, PageSetup, PageSize } from "../types.js";

export const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  LETTER: [612, 792],
  LEGAL: [612, 1008]
};

export const DEFAULT_MARGIN: Margin = {
  top: 54,
  right: 54,
  bottom: 54,
  left: 54
};

export function resolvePageSize(size: PageSize = "A4", orientation: "portrait" | "landscape" = "portrait"): [number, number] {
  const fallback = PAGE_SIZES.A4 as [number, number];
  const resolved = Array.isArray(size) ? size : (PAGE_SIZES[size.toUpperCase()] ?? fallback);
  const [width, height] = resolved;
  if (orientation === "landscape") return [Math.max(width, height), Math.min(width, height)];
  return [Math.min(width, height), Math.max(width, height)];
}

export function normalizeMargin(margin?: Partial<Margin> | number): Margin {
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }

  return {
    ...DEFAULT_MARGIN,
    ...(margin ?? {})
  };
}

export function pageSetupWithDefaults(page: PageSetup = {}): Required<Pick<PageSetup, "size" | "orientation" | "dpi" | "printReady">> & {
  margin: Margin;
  bleed: Margin;
} {
  return {
    size: page.size ?? "A4",
    orientation: page.orientation ?? "portrait",
    margin: normalizeMargin(page.margin),
    bleed: normalizeMargin(page.bleed ?? 0),
    dpi: page.dpi ?? 300,
    printReady: page.printReady ?? false
  };
}

export function pointsToCss(value: number): string {
  return `${Number((value / 72).toFixed(4))}in`;
}

export function pageSizeToCss(size: PageSize, orientation: "portrait" | "landscape" = "portrait"): { width?: string; height?: string; format?: "A4" | "Letter" | "Legal" } {
  if (!Array.isArray(size)) {
    const upper = size.toUpperCase();
    if (upper === "A4") return { format: "A4" };
    if (upper === "LETTER") return { format: "Letter" };
    if (upper === "LEGAL") return { format: "Legal" };
  }
  const [width, height] = resolvePageSize(size, orientation);
  return { width: pointsToCss(width), height: pointsToCss(height) };
}
