import type { Readable } from "node:stream";

export type PdfByteSource = Uint8Array | ArrayBuffer | Buffer | string;
export type BinaryInput = Uint8Array | ArrayBuffer | Buffer | string | URL;
export type PagePreset = "A4" | "LETTER" | "LEGAL";
export type PageSize = PagePreset | [number, number];
export type Orientation = "portrait" | "landscape";
export type PdfColor = string;
export type TextAlign = "left" | "center" | "right" | "justify";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSetup {
  size?: PageSize;
  orientation?: Orientation;
  margin?: Partial<Margin> | number;
  bleed?: Partial<Margin> | number;
  dpi?: number;
  printReady?: boolean;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  language?: string;
}

export interface FontDefinition {
  name: string;
  path: string;
  boldPath?: string;
  italicPath?: string;
  boldItalicPath?: string;
}

export interface Theme {
  fontFamily?: string;
  headingFontFamily?: string;
  fontSize?: number;
  lineGap?: number;
  textColor?: PdfColor;
  mutedColor?: PdfColor;
  primaryColor?: PdfColor;
  borderColor?: PdfColor;
  tableHeaderFill?: PdfColor;
  tableStripeFill?: PdfColor;
  backgroundColor?: PdfColor;
}

export interface HeaderFooterDefinition {
  text?: string;
  html?: string;
  height?: number;
  align?: TextAlign;
  fontSize?: number;
  color?: PdfColor;
  showOnFirstPage?: boolean;
}

export interface PageNumberingOptions {
  enabled?: boolean;
  format?: "page" | "page-of-total";
  align?: "left" | "center" | "right";
  fontSize?: number;
  color?: PdfColor;
  startAt?: number;
}

export interface BaseBlock {
  id?: string;
  marginTop?: number;
  marginBottom?: number;
  bookmark?: string;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  text: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: PdfColor;
  align?: TextAlign;
  width?: number;
  link?: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  color?: PdfColor;
  align?: TextAlign;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
  fontSize?: number;
  color?: PdfColor;
  align?: TextAlign;
  link?: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: BinaryInput;
  width?: number;
  height?: number;
  fit?: [number, number];
  align?: "left" | "center" | "right";
  alt?: string;
  link?: string;
}

export interface TableCell {
  text: string | number | boolean | null | undefined;
  align?: TextAlign;
  bold?: boolean;
  color?: PdfColor;
  backgroundColor?: PdfColor;
  link?: string;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  headers?: Array<string | TableCell>;
  rows: Array<Array<string | number | boolean | TableCell | null | undefined>>;
  columnWidths?: number[];
  width?: number;
  fontSize?: number;
  headerFill?: PdfColor;
  borderColor?: PdfColor;
  stripe?: boolean;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  ordered?: boolean;
  items: Array<string | ParagraphBlock>;
}

export interface ColumnsBlock extends BaseBlock {
  type: "columns";
  gap?: number;
  columns: Array<{
    width?: number;
    content: ContentBlock[];
  }>;
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  height: number;
}

export interface PageBreakBlock extends BaseBlock {
  type: "pageBreak";
}

export interface ComponentBlock extends BaseBlock {
  type: "component";
  name: string;
  props?: Record<string, unknown>;
}

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | TableBlock
  | ListBlock
  | ColumnsBlock
  | SpacerBlock
  | PageBreakBlock
  | ComponentBlock;

export interface ComponentDefinition {
  content: ContentBlock[];
}

export interface AttachmentDefinition {
  name: string;
  description?: string;
  data: BinaryInput;
  mimeType?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export interface DocumentDefinition {
  page?: PageSetup;
  metadata?: PdfMetadata;
  theme?: Theme;
  fonts?: FontDefinition[];
  header?: HeaderFooterDefinition;
  footer?: HeaderFooterDefinition;
  pageNumbers?: PageNumberingOptions;
  components?: Record<string, ComponentDefinition>;
  attachments?: AttachmentDefinition[];
  content: ContentBlock[];
}

export interface TemplateOptions {
  data?: Record<string, unknown>;
  strict?: boolean;
}

export interface RenderOptions extends TemplateOptions {
  plugins?: AuroraPdfPlugin[];
  optimize?: OptimizeOptions;
  encryption?: EncryptOptions;
}

export interface HtmlRenderOptions {
  page?: PageSetup;
  metadata?: PdfMetadata;
  header?: HeaderFooterDefinition;
  footer?: HeaderFooterDefinition;
  pageNumbers?: PageNumberingOptions;
  printBackground?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeoutMs?: number;
  media?: "print" | "screen";
  baseUrl?: string;
  css?: string;
}

export interface MarkdownRenderOptions extends HtmlRenderOptions {
  title?: string;
  theme?: Theme;
}

export interface ImagePdfOptions {
  page?: PageSetup;
  metadata?: PdfMetadata;
  fit?: "contain" | "cover";
  backgroundColor?: PdfColor;
  quality?: number;
}

export interface MergeOptions {
  metadata?: PdfMetadata;
  optimize?: OptimizeOptions;
}

export interface SplitRange {
  from: number;
  to?: number;
}

export interface SplitOptions {
  ranges?: SplitRange[];
}

export interface OptimizeOptions {
  useObjectStreams?: boolean;
  stripMetadata?: boolean;
  removeJavaScript?: boolean;
}

export interface CompressionOptions extends OptimizeOptions {
  imageQuality?: number;
}

export interface EncryptOptions {
  userPassword: string;
  ownerPassword?: string;
  algorithm?: "AES-256" | "RC4";
  permissions?: {
    printing?: boolean;
    modifying?: boolean;
    copying?: boolean;
    annotating?: boolean;
    fillingForms?: boolean;
    extraction?: boolean;
    assembly?: boolean;
    highQualityPrint?: boolean;
  };
  protectMetadata?: boolean;
}

export interface WatermarkOptions {
  text?: string;
  image?: BinaryInput;
  opacity?: number;
  rotateDegrees?: number;
  fontSize?: number;
  color?: PdfColor;
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  everyPage?: boolean;
}

export interface LogoOptions {
  image: BinaryInput;
  width?: number;
  height?: number;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  margin?: number;
  everyPage?: boolean;
}

export interface BatchJob<TOptions = unknown> {
  kind: "html" | "url" | "markdown" | "definition" | "image" | "images";
  input: unknown;
  options?: TOptions;
  outputPath?: string;
}

export interface BatchOptions {
  concurrency?: number;
}

export interface StreamResult {
  stream: Readable;
  done: Promise<Uint8Array>;
}

export interface AuroraPdfPlugin {
  name: string;
  beforeRenderDefinition?(definition: DocumentDefinition, context: RenderContext): Promise<DocumentDefinition> | DocumentDefinition;
  afterRenderBytes?(bytes: Uint8Array, context: RenderContext): Promise<Uint8Array> | Uint8Array;
}

export interface RenderContext {
  data?: Record<string, unknown>;
  source: "definition" | "html" | "url" | "markdown" | "image" | "pdf";
}

export interface SaveOptions {
  path: string;
}
