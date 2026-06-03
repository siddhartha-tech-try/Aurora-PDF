import { readFile } from "node:fs/promises";
import { PdfArtifact } from "./core/artifact.js";
import { DocumentRenderer } from "./core/renderer.js";
import { HtmlRenderer } from "./adapters/html.js";
import { MarkdownRenderer } from "./adapters/markdown.js";
import { imagesToPdf } from "./adapters/image.js";
import { PdfModifier } from "./adapters/modifier.js";
import type {
  BatchJob,
  BatchOptions,
  BinaryInput,
  CompressionOptions,
  DocumentDefinition,
  EncryptOptions,
  HtmlRenderOptions,
  ImagePdfOptions,
  MarkdownRenderOptions,
  MergeOptions,
  OptimizeOptions,
  PdfByteSource,
  PdfMetadata,
  RenderOptions,
  SplitOptions,
  WatermarkOptions,
  LogoOptions,
  AttachmentDefinition
} from "./types.js";
import { encryptPdf } from "./security/encryption.js";

export class AuroraPDF {
  private static readonly documentRenderer = new DocumentRenderer();
  private static readonly htmlRenderer = new HtmlRenderer();
  private static readonly markdownRenderer = new MarkdownRenderer(AuroraPDF.htmlRenderer);
  private static readonly modifier = new PdfModifier();

  static async fromDefinition(definition: DocumentDefinition, options: RenderOptions = {}): Promise<PdfArtifact> {
    return this.documentRenderer.render(definition, options);
  }

  static async streamDefinition(definition: DocumentDefinition, options: RenderOptions = {}) {
    return this.documentRenderer.renderToStream(definition, options);
  }

  static async fromHtml(html: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    return this.htmlRenderer.fromHtml(html, options);
  }

  static async fromHtmlFile(path: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    return this.htmlRenderer.fromHtmlFile(path, options);
  }

  static async fromUrl(url: string, options: HtmlRenderOptions = {}): Promise<PdfArtifact> {
    return this.htmlRenderer.fromUrl(url, options);
  }

  static async fromMarkdown(markdown: string, options: MarkdownRenderOptions = {}): Promise<PdfArtifact> {
    return this.markdownRenderer.fromMarkdown(markdown, options);
  }

  static async fromMarkdownFile(path: string, options: MarkdownRenderOptions = {}): Promise<PdfArtifact> {
    return this.markdownRenderer.fromMarkdownFile(path, options);
  }

  static async fromImage(image: BinaryInput, options: ImagePdfOptions = {}): Promise<PdfArtifact> {
    return imagesToPdf([image], options);
  }

  static async fromImages(images: BinaryInput[], options: ImagePdfOptions = {}): Promise<PdfArtifact> {
    return imagesToPdf(images, options);
  }

  static async fromExistingPdf(path: string): Promise<PdfArtifact> {
    return new PdfArtifact(new Uint8Array(await readFile(path)), "existing");
  }

  static async merge(inputs: PdfByteSource[], options: MergeOptions = {}): Promise<PdfArtifact> {
    return this.modifier.merge(inputs, options);
  }

  static async split(input: PdfByteSource, options: SplitOptions = {}): Promise<PdfArtifact[]> {
    return this.modifier.split(input, options);
  }

  static async compress(input: PdfByteSource, options: CompressionOptions = {}): Promise<PdfArtifact> {
    return this.modifier.compress(input, options);
  }

  static async optimize(input: PdfByteSource, options: OptimizeOptions = {}): Promise<PdfArtifact> {
    return this.modifier.optimize(input, options);
  }

  static async encrypt(input: PdfByteSource, options: EncryptOptions): Promise<PdfArtifact> {
    return encryptPdf(input, options);
  }

  static async protect(input: PdfByteSource, options: EncryptOptions): Promise<PdfArtifact> {
    return this.encrypt(input, options);
  }

  static async setMetadata(input: PdfByteSource, metadata: PdfMetadata): Promise<PdfArtifact> {
    return this.modifier.setMetadata(input, metadata);
  }

  static async watermark(input: PdfByteSource, options: WatermarkOptions): Promise<PdfArtifact> {
    return this.modifier.addWatermark(input, options);
  }

  static async insertLogo(input: PdfByteSource, options: LogoOptions): Promise<PdfArtifact> {
    return this.modifier.insertLogo(input, options);
  }

  static async attachFiles(input: PdfByteSource, attachments: AttachmentDefinition[]): Promise<PdfArtifact> {
    return this.modifier.attachFiles(input, attachments);
  }

  static async addPageNumbers(input: PdfByteSource, options: { format?: "page" | "page-of-total"; color?: string; fontSize?: number } = {}): Promise<PdfArtifact> {
    return this.modifier.addPageNumbers(input, options);
  }

  static async batch(jobs: BatchJob[], options: BatchOptions = {}): Promise<PdfArtifact[]> {
    const concurrency = Math.max(1, options.concurrency ?? 2);
    const results: PdfArtifact[] = new Array(jobs.length);
    let cursor = 0;

    async function worker(): Promise<void> {
      while (cursor < jobs.length) {
        const index = cursor++;
        const job = jobs[index];
        if (!job) continue;
        const artifact = await AuroraPDF.runBatchJob(job);
        if (job.outputPath) await artifact.save(job.outputPath);
        results[index] = artifact;
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
    return results;
  }

  private static async runBatchJob(job: BatchJob): Promise<PdfArtifact> {
    switch (job.kind) {
      case "html":
        return this.fromHtml(String(job.input), job.options as HtmlRenderOptions);
      case "url":
        return this.fromUrl(String(job.input), job.options as HtmlRenderOptions);
      case "markdown":
        return this.fromMarkdown(String(job.input), job.options as MarkdownRenderOptions);
      case "definition":
        return this.fromDefinition(job.input as DocumentDefinition, job.options as RenderOptions);
      case "image":
        return this.fromImage(job.input as BinaryInput, job.options as ImagePdfOptions);
      case "images":
        return this.fromImages(job.input as BinaryInput[], job.options as ImagePdfOptions);
    }
  }
}
