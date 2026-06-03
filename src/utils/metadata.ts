import type { PdfMetadata } from "../types.js";

export function pdfKitInfo(metadata?: PdfMetadata): Record<string, string | Date> {
  const info: Record<string, string | Date | undefined> = {
    Title: metadata?.title,
    Author: metadata?.author,
    Subject: metadata?.subject,
    Keywords: metadata?.keywords?.join(", "),
    Creator: metadata?.creator ?? "Aurora PDF",
    Producer: metadata?.producer,
    CreationDate: metadata?.creationDate ?? new Date(),
    ModDate: metadata?.modificationDate
  };

  return Object.fromEntries(Object.entries(info).filter(([, value]) => value !== undefined)) as Record<string, string | Date>;
}
