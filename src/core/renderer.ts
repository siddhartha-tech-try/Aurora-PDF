import PDFDocument from "pdfkit";
import { PassThrough, type Readable } from "node:stream";
import type {
  ComponentDefinition,
  ContentBlock,
  DocumentDefinition,
  HeaderFooterDefinition,
  RenderOptions,
  StreamResult,
  TableCell,
  Theme
} from "../types.js";
import { pageSetupWithDefaults, resolvePageSize } from "../utils/page.js";
import { mergeTheme } from "./theme.js";
import { TemplateEngine } from "./template.js";
import { applyAfterBytesPlugins, applyBeforeDefinitionPlugins } from "./plugins.js";
import { assertDocumentDefinition } from "./validation.js";
import { PdfArtifact } from "./artifact.js";
import { normalizeHex } from "../utils/color.js";
import { normalizeImage } from "../adapters/image.js";
import { toBuffer, readBinary } from "../utils/bytes.js";
import { pdfKitInfo } from "../utils/metadata.js";
import { PdfModifier } from "../adapters/modifier.js";
import { encryptPdf } from "../security/encryption.js";
import { InvalidDocumentError } from "../errors.js";

type PdfKitDocument = PDFKit.PDFDocument;

interface RenderState {
  doc: PdfKitDocument;
  theme: Required<Theme>;
  definition: DocumentDefinition;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  components: Record<string, ComponentDefinition>;
}

export class DocumentRenderer {
  private readonly templateEngine = new TemplateEngine();
  private readonly modifier = new PdfModifier();

  async render(definition: DocumentDefinition, options: RenderOptions = {}): Promise<PdfArtifact> {
    const streamResult = await this.renderToStream(definition, options);
    streamResult.stream.resume();
    let bytes = await streamResult.done;

    if (definition.attachments?.length) {
      bytes = (await this.modifier.attachFiles(bytes, definition.attachments)).bytes;
    }
    if (options.optimize) {
      bytes = (await this.modifier.optimize(bytes, options.optimize)).bytes;
    }
    if (options.encryption) {
      bytes = (await encryptPdf(bytes, options.encryption)).bytes;
    }

    bytes = await applyAfterBytesPlugins(bytes, options.plugins, {
      data: options.data,
      source: "definition"
    });

    return new PdfArtifact(bytes, "definition");
  }

  async renderToStream(definition: DocumentDefinition, options: RenderOptions = {}): Promise<StreamResult> {
    const templated = this.templateEngine.renderDefinition(definition, options);
    const finalDefinition = await applyBeforeDefinitionPlugins(templated, options.plugins, {
      data: options.data,
      source: "definition"
    });
    assertDocumentDefinition(finalDefinition);

    const page = pageSetupWithDefaults(finalDefinition.page);
    const [pageWidth, pageHeight] = resolvePageSize(page.size, page.orientation);
    const theme = mergeTheme(finalDefinition.theme);
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      size: [pageWidth, pageHeight],
      layout: page.orientation,
      margins: page.margin,
      info: pdfKitInfo(finalDefinition.metadata)
    });

    this.registerFonts(doc, finalDefinition);
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const done = new Promise<Uint8Array>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      doc.on("error", reject);
      stream.on("error", reject);
    });
    doc.pipe(stream);

    const state: RenderState = {
      doc,
      theme,
      definition: finalDefinition,
      pageWidth,
      pageHeight,
      contentWidth: pageWidth - page.margin.left - page.margin.right,
      components: finalDefinition.components ?? {}
    };

    doc.addPage({ size: [pageWidth, pageHeight], margins: page.margin, layout: page.orientation });
    await this.renderBlocks(finalDefinition.content, state);
    this.renderHeadersFooters(state);
    doc.end();

    return { stream: stream as Readable, done };
  }

  private registerFonts(doc: PdfKitDocument, definition: DocumentDefinition): void {
    for (const font of definition.fonts ?? []) {
      doc.registerFont(font.name, font.path);
      if (font.boldPath) doc.registerFont(`${font.name}-Bold`, font.boldPath);
      if (font.italicPath) doc.registerFont(`${font.name}-Italic`, font.italicPath);
      if (font.boldItalicPath) doc.registerFont(`${font.name}-BoldItalic`, font.boldItalicPath);
    }
  }

  private async renderBlocks(blocks: ContentBlock[], state: RenderState): Promise<void> {
    for (const block of blocks) {
      if (block.marginTop) state.doc.moveDown(block.marginTop / lineHeight(state.theme));
      if (block.bookmark) this.addBookmark(state.doc, block.bookmark);
      await this.renderBlock(block, state);
      if (block.marginBottom) state.doc.moveDown(block.marginBottom / lineHeight(state.theme));
    }
  }

  private async renderBlock(block: ContentBlock, state: RenderState): Promise<void> {
    switch (block.type) {
      case "heading":
        this.renderHeading(block, state);
        break;
      case "text":
      case "paragraph":
        this.renderText(block, state);
        break;
      case "image":
        await this.renderImage(block, state);
        break;
      case "table":
        this.renderTable(block, state);
        break;
      case "list":
        this.renderList(block, state);
        break;
      case "columns":
        await this.renderColumns(block, state);
        break;
      case "spacer":
        state.doc.y += block.height;
        break;
      case "pageBreak":
        state.doc.addPage();
        break;
      case "component":
        await this.renderComponent(block.name, block.props ?? {}, state);
        break;
      default:
        assertNever(block);
    }
  }

  private renderHeading(block: Extract<ContentBlock, { type: "heading" }>, state: RenderState): void {
    const level = block.level ?? 1;
    const sizes = [28, 22, 18, 15, 13, 12];
    const size = sizes[level - 1] ?? 12;
    const doc = state.doc;
    this.ensureSpace(doc, size * 1.7);
    doc
      .font(state.theme.headingFontFamily)
      .fontSize(size)
      .fillColor(normalizeHex(block.color ?? state.theme.primaryColor))
      .text(block.text, {
        width: state.contentWidth,
        align: block.align ?? "left",
        lineGap: 2
      });
    doc.moveDown(level <= 2 ? 0.65 : 0.4);
  }

  private renderText(block: Extract<ContentBlock, { type: "text" | "paragraph" }>, state: RenderState): void {
    const doc = state.doc;
    const fontSize = block.fontSize ?? state.theme.fontSize;
    const isTextBlock = block.type === "text";
    this.ensureSpace(doc, fontSize * 2);
    doc
      .font(isTextBlock && block.bold ? `${state.theme.fontFamily}-Bold` : state.theme.fontFamily)
      .fontSize(fontSize)
      .fillColor(normalizeHex(block.color ?? state.theme.textColor))
      .text(block.text, {
        width: isTextBlock ? (block.width ?? state.contentWidth) : state.contentWidth,
        align: block.align ?? "left",
        lineGap: state.theme.lineGap,
        link: block.link,
        underline: Boolean(block.link)
      });
    if (block.type === "paragraph") doc.moveDown(0.6);
  }

  private async renderImage(block: Extract<ContentBlock, { type: "image" }>, state: RenderState): Promise<void> {
    const image = await normalizeImage(block.src);
    const doc = state.doc;
    const maxWidth = block.fit?.[0] ?? block.width ?? state.contentWidth;
    const maxHeight = block.fit?.[1] ?? block.height ?? state.pageHeight;
    const ratio = image.width / image.height;
    const drawWidth = block.width ?? Math.min(maxWidth, maxHeight * ratio);
    const drawHeight = block.height ?? drawWidth / ratio;
    this.ensureSpace(doc, drawHeight + 12);
    const x = alignX(doc.page.margins.left, state.contentWidth, drawWidth, block.align ?? "left");
    const y = doc.y;
    doc.image(toBuffer(image.bytes), x, y, { width: drawWidth, height: drawHeight, link: block.link });
    doc.y = y + drawHeight + 8;
  }

  private renderTable(block: Extract<ContentBlock, { type: "table" }>, state: RenderState): void {
    const doc = state.doc;
    const theme = state.theme;
    const tableWidth = block.width ?? state.contentWidth;
    const columnCount = Math.max(block.columnWidths?.length ?? 0, block.headers?.length ?? 0, ...block.rows.map((row) => row.length));
    const columnWidths = block.columnWidths ?? Array.from({ length: columnCount }, () => tableWidth / columnCount);
    const fontSize = block.fontSize ?? 9.5;
    const borderColor = normalizeHex(block.borderColor ?? theme.borderColor);
    const headerFill = normalizeHex(block.headerFill ?? theme.tableHeaderFill);
    const rows = block.headers ? [block.headers, ...block.rows] : block.rows;
    const hasHeader = Boolean(block.headers);

    for (const [rowIndex, row] of rows.entries()) {
      const cells = row.map(normalizeCell);
      const rowHeight = Math.max(
        24,
        ...cells.map((cell, index) => {
          const width = columnWidths[index] ?? tableWidth / columnCount;
          return doc.heightOfString(String(cell.text ?? ""), { width: width - 12, lineGap: 2 }) + 14;
        })
      );
      this.ensureSpace(doc, rowHeight + 2);
      const y = doc.y;
      let x = doc.page.margins.left;
      for (const [cellIndex, cell] of cells.entries()) {
        const width = columnWidths[cellIndex] ?? tableWidth / columnCount;
        const fill = cell.backgroundColor ?? (hasHeader && rowIndex === 0 ? headerFill : block.stripe !== false && rowIndex % 2 === 0 ? theme.tableStripeFill : "#ffffff");
        doc.rect(x, y, width, rowHeight).fillAndStroke(normalizeHex(fill), borderColor);
        doc
          .fillColor(normalizeHex(cell.color ?? theme.textColor))
          .font(cell.bold || (hasHeader && rowIndex === 0) ? `${theme.fontFamily}-Bold` : theme.fontFamily)
          .fontSize(fontSize)
          .text(String(cell.text ?? ""), x + 6, y + 7, {
            width: width - 12,
            align: cell.align ?? "left",
            lineGap: 2,
            link: cell.link
          });
        x += width;
      }
      doc.y = y + rowHeight;
    }
    doc.moveDown(0.75);
  }

  private renderList(block: Extract<ContentBlock, { type: "list" }>, state: RenderState): void {
    const doc = state.doc;
    doc.font(state.theme.fontFamily).fontSize(state.theme.fontSize).fillColor(normalizeHex(state.theme.textColor));
    block.items.forEach((item, index) => {
      const text = typeof item === "string" ? item : item.text;
      const marker = block.ordered ? `${index + 1}.` : "•";
      this.ensureSpace(doc, state.theme.fontSize * 2);
      const y = doc.y;
      doc.text(marker, doc.page.margins.left, y, { width: 28 });
      doc.text(text, doc.page.margins.left + 28, y, { width: state.contentWidth - 28, lineGap: state.theme.lineGap });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.4);
  }

  private async renderColumns(block: Extract<ContentBlock, { type: "columns" }>, state: RenderState): Promise<void> {
    const doc = state.doc;
    const gap = block.gap ?? 18;
    const available = state.contentWidth - gap * (block.columns.length - 1);
    const widths = block.columns.map((column) => column.width ?? available / block.columns.length);
    const startY = doc.y;
    const startX = doc.page.margins.left;
    const originalContentWidth = state.contentWidth;
    let maxY = startY;

    for (const [index, column] of block.columns.entries()) {
      doc.x = startX + widths.slice(0, index).reduce((sum, width) => sum + width, 0) + gap * index;
      doc.y = startY;
      state.contentWidth = widths[index] ?? available / block.columns.length;
      await this.renderBlocks(column.content, state);
      maxY = Math.max(maxY, doc.y);
    }

    state.contentWidth = originalContentWidth;
    doc.x = startX;
    doc.y = maxY + 8;
  }

  private async renderComponent(name: string, props: Record<string, unknown>, state: RenderState): Promise<void> {
    const component = state.components[name];
    if (!component) throw new InvalidDocumentError(`Unknown component: ${name}`);
    const source = JSON.stringify(component.content);
    const rendered = JSON.parse(new TemplateEngine().renderString(source, props)) as ContentBlock[];
    await this.renderBlocks(rendered, state);
  }

  private renderHeadersFooters(state: RenderState): void {
    const doc = state.doc;
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let index = 0; index < total; index++) {
      doc.switchToPage(index);
      const pageNumber = index + 1;
      this.renderHeaderFooterText(state, state.definition.header, "header", pageNumber, total);
      this.renderHeaderFooterText(state, state.definition.footer, "footer", pageNumber, total);
      if (state.definition.pageNumbers?.enabled) {
        this.renderPageNumber(state, pageNumber, total);
      }
    }
  }

  private renderHeaderFooterText(state: RenderState, definition: HeaderFooterDefinition | undefined, slot: "header" | "footer", pageNumber: number, total: number): void {
    if (!definition?.text) return;
    if (pageNumber === 1 && definition.showOnFirstPage === false) return;
    const doc = state.doc;
    const text = interpolatePageTokens(definition.text, pageNumber, total);
    const fontSize = definition.fontSize ?? 9;
    const y = slot === "header" ? Math.max(12, doc.page.margins.top - 26) : state.pageHeight - doc.page.margins.bottom - (definition.height ?? 20);
    doc
      .font(state.theme.fontFamily)
      .fontSize(fontSize)
      .fillColor(normalizeHex(definition.color ?? state.theme.mutedColor))
      .text(text, doc.page.margins.left, y, {
        width: state.contentWidth,
        align: definition.align ?? "center",
        lineBreak: false
      });
  }

  private renderPageNumber(state: RenderState, pageNumber: number, total: number): void {
    const options = state.definition.pageNumbers;
    if (!options?.enabled) return;
    const doc = state.doc;
    const startAt = options.startAt ?? 1;
    const visiblePage = pageNumber + startAt - 1;
    const label = options.format === "page" ? `${visiblePage}` : `${visiblePage} / ${total + startAt - 1}`;
    const fontSize = options.fontSize ?? 9;
    const align = options.align ?? "center";
    const width = state.contentWidth;
    const x = doc.page.margins.left;
    doc
      .font(state.theme.fontFamily)
      .fontSize(fontSize)
      .fillColor(normalizeHex(options.color ?? state.theme.mutedColor))
      .text(label, x, state.pageHeight - doc.page.margins.bottom - fontSize - 2, { width, align, lineBreak: false });
  }

  private ensureSpace(doc: PdfKitDocument, needed: number): void {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed > bottom) {
      doc.addPage();
    }
  }

  private addBookmark(doc: PdfKitDocument, title: string): void {
    const outline = (doc as unknown as { outline?: { addItem?: (title: string) => unknown } }).outline;
    outline?.addItem?.(title);
  }
}

function normalizeCell(cell: string | number | boolean | TableCell | null | undefined): TableCell {
  if (cell && typeof cell === "object" && "text" in cell) return cell;
  return { text: cell };
}

function lineHeight(theme: Required<Theme>): number {
  return theme.fontSize + theme.lineGap;
}

function alignX(left: number, contentWidth: number, drawWidth: number, align: "left" | "center" | "right"): number {
  if (align === "center") return left + (contentWidth - drawWidth) / 2;
  if (align === "right") return left + contentWidth - drawWidth;
  return left;
}

function interpolatePageTokens(text: string, page: number, total: number): string {
  return text.replace(/\{\{\s*page\s*\}\}/g, String(page)).replace(/\{\{\s*total\s*\}\}/g, String(total));
}

function assertNever(value: never): never {
  throw new InvalidDocumentError(`Unsupported content block: ${JSON.stringify(value)}`);
}
