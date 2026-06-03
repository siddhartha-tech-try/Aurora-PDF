import MarkdownIt from "markdown-it";
import type { MarkdownRenderOptions } from "../types.js";
import { readFile } from "node:fs/promises";
import { HtmlRenderer } from "./html.js";
import { normalizeHex } from "../utils/color.js";
import { mergeTheme } from "../core/theme.js";
import type { PdfArtifact } from "../core/artifact.js";

export class MarkdownRenderer {
  private readonly markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  constructor(private readonly htmlRenderer = new HtmlRenderer()) {}

  async fromMarkdown(markdown: string, options: MarkdownRenderOptions = {}): Promise<PdfArtifact> {
    const body = this.markdown.render(markdown);
    return this.htmlRenderer.fromHtml(this.wrap(body, options), {
      ...options,
      css: `${this.css(options)}\n${options.css ?? ""}`
    });
  }

  async fromMarkdownFile(path: string, options: MarkdownRenderOptions = {}): Promise<PdfArtifact> {
    const markdown = await readFile(path, "utf8");
    return this.fromMarkdown(markdown, options);
  }

  private wrap(body: string, options: MarkdownRenderOptions): string {
    const title = options.title ?? options.metadata?.title ?? "Document";
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><main>${body}</main></body></html>`;
  }

  private css(options: MarkdownRenderOptions): string {
    const theme = mergeTheme(options.theme);
    return `
      @page { margin: 0; }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: ${normalizeHex(theme.textColor)};
        background: ${normalizeHex(theme.backgroundColor)};
        font-size: ${theme.fontSize + 1}px;
        line-height: 1.58;
      }
      main { max-width: 760px; margin: 0 auto; padding: 0; }
      h1, h2, h3 { color: ${normalizeHex(theme.primaryColor)}; line-height: 1.2; margin: 0 0 12px; page-break-after: avoid; }
      h1 { font-size: 32px; }
      h2 { font-size: 24px; margin-top: 28px; }
      h3 { font-size: 18px; margin-top: 20px; }
      p, ul, ol, table { margin: 0 0 14px; }
      a { color: ${normalizeHex(theme.primaryColor)}; text-decoration: none; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; page-break-inside: auto; }
      th, td { border: 1px solid ${normalizeHex(theme.borderColor)}; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: ${normalizeHex(theme.tableHeaderFill)}; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
      pre { background: #111827; color: #f9fafb; padding: 14px; overflow-wrap: anywhere; white-space: pre-wrap; }
      img { max-width: 100%; height: auto; }
    `;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
