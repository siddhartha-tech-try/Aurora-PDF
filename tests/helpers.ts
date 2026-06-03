import { PDFDocument } from "pdf-lib";
import type { DocumentDefinition } from "../src/index.js";

export const redSquareSvg =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
      <rect width="240" height="160" fill="#ffffff"/>
      <rect x="20" y="20" width="200" height="120" rx="8" fill="#2563eb"/>
      <circle cx="120" cy="80" r="34" fill="#f97316"/>
    </svg>`
  ).toString("base64");

export function sampleDefinition(): DocumentDefinition {
  return {
    metadata: {
      title: "Aurora Test Document",
      author: "Aurora PDF"
    },
    page: {
      size: "A4",
      margin: 48
    },
    theme: {
      primaryColor: "#0f766e",
      tableHeaderFill: "#ccfbf1"
    },
    header: {
      text: "Aurora PDF",
      align: "left"
    },
    footer: {
      text: "Confidential"
    },
    pageNumbers: {
      enabled: true,
      format: "page-of-total"
    },
    components: {
      metric: {
        content: [
          {
            type: "paragraph",
            text: "{{label}}: {{value}}",
            fontSize: 12
          }
        ]
      }
    },
    content: [
      {
        type: "heading",
        text: "{{title}}",
        level: 1,
        bookmark: "Introduction"
      },
      {
        type: "paragraph",
        text: "Aurora PDF renders structured document definitions, tables, images, links, components, headers, footers, and page numbering."
      },
      {
        type: "component",
        name: "metric",
        props: {
          label: "Pages under test",
          value: "multiple"
        }
      },
      {
        type: "table",
        headers: ["Feature", "Status", "Notes"],
        rows: [
          ["Structured rendering", "ready", "PDFKit streaming backend"],
          ["Modification", "ready", "pdf-lib backend"],
          ["Encryption", "ready", "AES-256 adapter"]
        ]
      },
      {
        type: "image",
        src: redSquareSvg,
        width: 180,
        align: "center"
      }
    ]
  };
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-";
}
