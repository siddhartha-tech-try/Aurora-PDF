import sharp from "sharp";
import type { BinaryInput, ImagePdfOptions } from "../types.js";
import { readBinary, toBuffer } from "../utils/bytes.js";
import { resolvePageSize, pageSetupWithDefaults } from "../utils/page.js";
import { normalizeHex } from "../utils/color.js";
import { pdfKitInfo } from "../utils/metadata.js";
import PDFDocument from "pdfkit";
import { PdfArtifact } from "../core/artifact.js";
import { RenderingError } from "../errors.js";

export interface NormalizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: "jpeg" | "png";
}

export async function normalizeImage(input: BinaryInput, options: { quality?: number; maxWidthPx?: number; maxHeightPx?: number } = {}): Promise<NormalizedImage> {
  const source = await readBinary(input);
  const image = sharp(toBuffer(source), { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new RenderingError("Unable to determine image dimensions.");
  }

  const shouldResize = Boolean(options.maxWidthPx || options.maxHeightPx);
  const pipeline = shouldResize
    ? image.resize({
        width: options.maxWidthPx,
        height: options.maxHeightPx,
        fit: "inside",
        withoutEnlargement: true
      })
    : image;

  const output = metadata.hasAlpha
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({ quality: options.quality ?? 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(output.data),
    width: output.info.width,
    height: output.info.height,
    format: output.info.format === "png" ? "png" : "jpeg"
  };
}

export async function imagesToPdf(images: BinaryInput[], options: ImagePdfOptions = {}): Promise<PdfArtifact> {
  const page = pageSetupWithDefaults(options.page);
  const [pageWidth, pageHeight] = resolvePageSize(page.size, page.orientation);
  const margin = page.margin;
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [pageWidth, pageHeight],
    layout: page.orientation,
    margins: margin,
    info: pdfKitInfo(options.metadata)
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
  });

  for (const input of images) {
    const image = await normalizeImage(input, {
      quality: options.quality,
      maxWidthPx: Math.round((pageWidth / 72) * page.dpi),
      maxHeightPx: Math.round((pageHeight / 72) * page.dpi)
    });
    doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
    doc.rect(0, 0, pageWidth, pageHeight).fill(normalizeHex(options.backgroundColor ?? "#ffffff"));

    const boxX = margin.left;
    const boxY = margin.top;
    const boxWidth = pageWidth - margin.left - margin.right;
    const boxHeight = pageHeight - margin.top - margin.bottom;
    const imageRatio = image.width / image.height;
    const boxRatio = boxWidth / boxHeight;
    const cover = options.fit === "cover";
    const width = cover ? (imageRatio > boxRatio ? boxHeight * imageRatio : boxWidth) : imageRatio > boxRatio ? boxWidth : boxHeight * imageRatio;
    const height = cover ? (imageRatio > boxRatio ? boxHeight : boxWidth / imageRatio) : imageRatio > boxRatio ? boxWidth / imageRatio : boxHeight;
    const x = boxX + (boxWidth - width) / 2;
    const y = boxY + (boxHeight - height) / 2;

    doc.image(toBuffer(image.bytes), x, y, { width, height });
  }

  doc.end();
  return new PdfArtifact(await done, "images");
}
