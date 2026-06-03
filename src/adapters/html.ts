import { chromium, type Browser } from "playwright";
import type { HeaderFooterDefinition, HtmlRenderOptions, Margin } from "../types.js";
import { ensureFileExists } from "../utils/bytes.js";
import { normalizeMargin, pageSizeToCss } from "../utils/page.js";
import { PdfArtifact } from "../core/artifact.js";
import { RenderingError } from "../errors.js";

export class HtmlRenderer {
  async fromHtml(html: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    const browser = await this.launch();
    try {
      const page = await browser.newPage();
      if (options.media) await page.emulateMedia({ media: options.media });
      const content = this.wrapHtml(html, options);
      await page.setContent(content, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeoutMs ?? 30_000
      });
      const bytes = await page.pdf(this.toPlaywrightPdfOptions(options));
      return new PdfArtifact(new Uint8Array(bytes), "html");
    } catch (error) {
      throw new RenderingError("Failed to render HTML to PDF.", error);
    } finally {
      await browser.close();
    }
  }

  async fromHtmlFile(path: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    await ensureFileExists(path);
    const url = new URL(`file://${path.replace(/\\/g, "/")}`);
    return this.fromUrl(url.toString(), options);
  }

  async fromUrl(url: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    const browser = await this.launch();
    try {
      const page = await browser.newPage();
      if (options.media) await page.emulateMedia({ media: options.media });
      await page.goto(url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeoutMs ?? 30_000
      });
      if (options.css) await page.addStyleTag({ content: options.css });
      const bytes = await page.pdf(this.toPlaywrightPdfOptions(options));
      return new PdfArtifact(new Uint8Array(bytes), "url");
    } catch (error) {
      throw new RenderingError(`Failed to render URL to PDF: ${url}`, error);
    } finally {
      await browser.close();
    }
  }

  private async launch(): Promise<Browser> {
    return chromium.launch({ headless: true });
  }

  private wrapHtml(html: string, options: HtmlRenderOptions): string {
    const base = options.baseUrl ? `<base href="${escapeHtml(options.baseUrl)}">` : "";
    const css = options.css ? `<style>${options.css}</style>` : "";
    if (/<!doctype html|<html[\s>]/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${base}${css}`);
    }
    return `<!doctype html><html><head>${base}${css}<meta charset="utf-8"></head><body>${html}</body></html>`;
  }

  private toPlaywrightPdfOptions(options: HtmlRenderOptions): Parameters<import("playwright").Page["pdf"]>[0] {
    const page = options.page ?? {};
    const margin = normalizeMargin(page.margin);
    const size = pageSizeToCss(page.size ?? "A4", page.orientation ?? "portrait");
    const numbering = options.pageNumbers?.enabled
      ? this.pageNumberTemplate(options.footer, options.pageNumbers.format ?? "page-of-total")
      : options.footer?.html ?? this.textHeaderFooter(options.footer);

    return {
      printBackground: options.printBackground ?? true,
      preferCSSPageSize: true,
      landscape: page.orientation === "landscape",
      format: size.format,
      width: size.width,
      height: size.height,
      margin: this.toCssMargin(margin),
      displayHeaderFooter: Boolean(options.header || options.footer || options.pageNumbers?.enabled),
      headerTemplate: options.header?.html ?? this.textHeaderFooter(options.header),
      footerTemplate: numbering
    };
  }

  private toCssMargin(margin: Margin): { top: string; right: string; bottom: string; left: string } {
    return {
      top: `${Number((margin.top / 72).toFixed(4))}in`,
      right: `${Number((margin.right / 72).toFixed(4))}in`,
      bottom: `${Number((margin.bottom / 72).toFixed(4))}in`,
      left: `${Number((margin.left / 72).toFixed(4))}in`
    };
  }

  private textHeaderFooter(definition?: HeaderFooterDefinition): string {
    if (!definition?.text) return "<span></span>";
    return `<div style="width:100%;font-size:${definition.fontSize ?? 9}pt;color:${definition.color ?? "#6b7280"};text-align:${definition.align ?? "center"};padding:0 24pt;">${escapeHtml(definition.text)}</div>`;
  }

  private pageNumberTemplate(definition: HeaderFooterDefinition | undefined, format: "page" | "page-of-total"): string {
    const prefix = definition?.text ? `${escapeHtml(definition.text)} · ` : "";
    const body =
      format === "page-of-total"
        ? `${prefix}<span class="pageNumber"></span> / <span class="totalPages"></span>`
        : `${prefix}<span class="pageNumber"></span>`;
    return `<div style="width:100%;font-size:${definition?.fontSize ?? 9}pt;color:${definition?.color ?? "#6b7280"};text-align:${definition?.align ?? "center"};padding:0 24pt;">${body}</div>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
