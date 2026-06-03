import { PDFDocument } from "pdf-lib";
import { Readable } from "node:stream";
import { streamFromBytes, writeBytes } from "../utils/bytes.js";

export class PdfArtifact {
  constructor(public readonly bytes: Uint8Array, public readonly source = "generated") {}

  get byteLength(): number {
    return this.bytes.byteLength;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
  }

  toUint8Array(): Uint8Array {
    return this.bytes;
  }

  stream(): Readable {
    return streamFromBytes(this.bytes);
  }

  async save(path: string): Promise<void> {
    await writeBytes(path, this.bytes);
  }

  async pageCount(): Promise<number> {
    const doc = await PDFDocument.load(this.bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  }
}
