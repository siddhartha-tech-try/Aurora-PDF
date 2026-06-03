import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import type {
  AttachmentDefinition,
  CompressionOptions,
  LogoOptions,
  MergeOptions,
  OptimizeOptions,
  PdfByteSource,
  PdfMetadata,
  SplitOptions,
  WatermarkOptions
} from "../types.js";
import { PdfArtifact } from "../core/artifact.js";
import { readBinary } from "../utils/bytes.js";
import { hexToPdfRgb } from "../utils/color.js";
import { normalizeImage } from "./image.js";
import { encryptPdf } from "../security/encryption.js";

export class PdfModifier {
  async merge(inputs: PdfByteSource[], options: MergeOptions = {}): Promise<PdfArtifact> {
    const target = await PDFDocument.create();
    for (const input of inputs) {
      const source = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
      const pages = await target.copyPages(source, source.getPageIndices());
      pages.forEach((page) => target.addPage(page));
    }
    applyMetadata(target, options.metadata);
    return new PdfArtifact(await target.save({ useObjectStreams: options.optimize?.useObjectStreams ?? true }), "merged");
  }

  async split(input: PdfByteSource, options: SplitOptions = {}): Promise<PdfArtifact[]> {
    const source = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    const pageCount = source.getPageCount();
    const ranges = options.ranges?.length ? options.ranges : Array.from({ length: pageCount }, (_, index) => ({ from: index + 1, to: index + 1 }));
    const artifacts: PdfArtifact[] = [];

    for (const range of ranges) {
      const from = Math.max(1, range.from);
      const to = Math.min(pageCount, range.to ?? range.from);
      const indices = Array.from({ length: to - from + 1 }, (_, index) => from - 1 + index);
      const target = await PDFDocument.create();
      const copied = await target.copyPages(source, indices);
      copied.forEach((page) => target.addPage(page));
      artifacts.push(new PdfArtifact(await target.save({ useObjectStreams: true }), `split-${from}-${to}`));
    }

    return artifacts;
  }

  async setMetadata(input: PdfByteSource, metadata: PdfMetadata): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    applyMetadata(doc, metadata);
    return new PdfArtifact(await doc.save({ useObjectStreams: true }), "metadata");
  }

  async addWatermark(input: PdfByteSource, options: WatermarkOptions): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = options.everyPage === false ? [doc.getPage(0)] : doc.getPages();
    const rotate = degrees(options.rotateDegrees ?? -32);
    const opacity = options.opacity ?? 0.18;

    let image: Awaited<ReturnType<typeof embedImage>> | undefined;
    if (options.image) {
      image = await embedImage(doc, options.image);
    }

    for (const page of pages) {
      const { width, height } = page.getSize();
      const position = resolvePosition(options.position ?? "center", width, height, 72);
      if (image) {
        const scale = Math.min(width / image.width, height / image.height, 0.45);
        page.drawImage(image.ref, {
          x: position.x - (image.width * scale) / 2,
          y: position.y - (image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
          opacity,
          rotate
        });
      }
      if (options.text) {
        const fontSize = options.fontSize ?? 54;
        const textWidth = font.widthOfTextAtSize(options.text, fontSize);
        page.drawText(options.text, {
          x: position.x - textWidth / 2,
          y: position.y,
          font,
          size: fontSize,
          color: hexToPdfRgb(options.color ?? "#6b7280"),
          opacity,
          rotate
        });
      }
    }

    return new PdfArtifact(await doc.save({ useObjectStreams: true }), "watermarked");
  }

  async insertLogo(input: PdfByteSource, options: LogoOptions): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    const image = await embedImage(doc, options.image);
    const pages = options.everyPage === false ? [doc.getPage(0)] : doc.getPages();
    const margin = options.margin ?? 36;
    const width = options.width ?? 96;
    const height = options.height ?? (image.height / image.width) * width;

    for (const page of pages) {
      const size = page.getSize();
      const position = cornerPosition(options.position ?? "top-right", size.width, size.height, width, height, margin);
      page.drawImage(image.ref, { ...position, width, height });
    }

    return new PdfArtifact(await doc.save({ useObjectStreams: true }), "logo");
  }

  async attachFiles(input: PdfByteSource, attachments: AttachmentDefinition[]): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    for (const attachment of attachments) {
      await doc.attach(await readBinary(attachment.data), attachment.name, {
        mimeType: attachment.mimeType,
        description: attachment.description,
        creationDate: attachment.creationDate,
        modificationDate: attachment.modificationDate
      });
    }
    return new PdfArtifact(await doc.save({ useObjectStreams: true }), "attachments");
  }

  async addPageNumbers(input: PdfByteSource, options: { format?: "page" | "page-of-total"; color?: string; fontSize?: number } = {}): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;

    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const label = options.format === "page" ? `${index + 1}` : `${index + 1} / ${total}`;
      const size = options.fontSize ?? 9;
      const textWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: width / 2 - textWidth / 2,
        y: 24,
        size,
        font,
        color: hexToPdfRgb(options.color ?? "#6b7280")
      });
    });

    return new PdfArtifact(await doc.save({ useObjectStreams: true }), "numbered");
  }

  async optimize(input: PdfByteSource, options: OptimizeOptions = {}): Promise<PdfArtifact> {
    const doc = await PDFDocument.load(await readBinary(input), { ignoreEncryption: true, updateMetadata: !options.stripMetadata });
    if (options.stripMetadata) applyMetadata(doc, { title: "", author: "", subject: "", keywords: [], creator: "", producer: "" });
    return new PdfArtifact(await doc.save({ useObjectStreams: options.useObjectStreams ?? true, addDefaultPage: false }), "optimized");
  }

  async compress(input: PdfByteSource, options: CompressionOptions = {}): Promise<PdfArtifact> {
    return this.optimize(input, options);
  }

  async encrypt(input: PdfByteSource, options: Parameters<typeof encryptPdf>[1]): Promise<PdfArtifact> {
    return encryptPdf(input, options);
  }
}

function applyMetadata(doc: PDFDocument, metadata?: PdfMetadata): void {
  if (!metadata) return;
  if (metadata.title !== undefined) doc.setTitle(metadata.title);
  if (metadata.author !== undefined) doc.setAuthor(metadata.author);
  if (metadata.subject !== undefined) doc.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) doc.setKeywords(metadata.keywords);
  if (metadata.creator !== undefined) doc.setCreator(metadata.creator);
  if (metadata.producer !== undefined) doc.setProducer(metadata.producer);
  if (metadata.creationDate !== undefined) doc.setCreationDate(metadata.creationDate);
  if (metadata.modificationDate !== undefined) doc.setModificationDate(metadata.modificationDate);
  if (metadata.language !== undefined) doc.setLanguage(metadata.language);
}

async function embedImage(doc: PDFDocument, input: Parameters<typeof normalizeImage>[0]) {
  const image = await normalizeImage(input);
  const ref = image.format === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
  return { ref, width: ref.width, height: ref.height };
}

function resolvePosition(position: NonNullable<WatermarkOptions["position"]>, width: number, height: number, margin: number): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: margin, y: height - margin };
    case "top-right":
      return { x: width - margin, y: height - margin };
    case "bottom-left":
      return { x: margin, y: margin };
    case "bottom-right":
      return { x: width - margin, y: margin };
    default:
      return { x: width / 2, y: height / 2 };
  }
}

function cornerPosition(
  position: NonNullable<LogoOptions["position"]>,
  pageWidth: number,
  pageHeight: number,
  width: number,
  height: number,
  margin: number
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: margin, y: pageHeight - margin - height };
    case "bottom-left":
      return { x: margin, y: margin };
    case "bottom-right":
      return { x: pageWidth - margin - width, y: margin };
    default:
      return { x: pageWidth - margin - width, y: pageHeight - margin - height };
  }
}
