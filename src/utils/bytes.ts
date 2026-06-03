import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { BinaryInput } from "../types.js";
import { AuroraPdfError } from "../errors.js";

const DATA_URI_RE = /^data:([^;,]+)?(;base64)?,(.*)$/s;

export async function readBinary(input: BinaryInput): Promise<Uint8Array> {
  if (input instanceof URL) {
    return readFromUrl(input.toString());
  }

  if (typeof input === "string") {
    if (input.startsWith("data:")) return readDataUri(input);
    if (/^https?:\/\//i.test(input)) return readFromUrl(input);
    return new Uint8Array(await readFile(input));
  }

  if (Buffer.isBuffer(input)) return new Uint8Array(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  throw new AuroraPdfError("Unsupported binary input type.", "UNSUPPORTED_INPUT");
}

export async function ensureFileExists(path: string): Promise<void> {
  try {
    const info = await stat(path);
    if (!info.isFile()) {
      throw new AuroraPdfError(`Expected a file path but received ${path}.`, "INVALID_FILE");
    }
  } catch (error) {
    if (error instanceof AuroraPdfError) throw error;
    throw new AuroraPdfError(`File does not exist: ${path}`, "MISSING_FILE", error);
  }
}

export function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, toBuffer(bytes), { mode: 0o600 });
}

export function streamFromBytes(bytes: Uint8Array): Readable {
  return Readable.from(toBuffer(bytes));
}

export function fileStream(path: string): Readable {
  return createReadStream(path);
}

export async function streamToBytes(stream: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export async function writeStreamSecurely(path: string, stream: Readable): Promise<void> {
  const dir = await createSecureTempDir();
  const tempPath = join(dir.path, randomBytes(12).toString("hex"));
  try {
    await pipeline(stream, await import("node:fs").then((fs) => fs.createWriteStream(tempPath, { mode: 0o600 })));
    await import("node:fs/promises").then((fs) => fs.rename(tempPath, path));
  } finally {
    await dir.cleanup();
  }
}

export async function createSecureTempDir(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), "aurora-pdf-"));
  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true, maxRetries: 2 })
  };
}

async function readFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new AuroraPdfError(`Unable to fetch ${url}: HTTP ${response.status}`, "FETCH_FAILED");
  }
  return new Uint8Array(await response.arrayBuffer());
}

function readDataUri(uri: string): Uint8Array {
  const match = DATA_URI_RE.exec(uri);
  if (!match) throw new AuroraPdfError("Invalid data URI.", "INVALID_DATA_URI");
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const bytes = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  return new Uint8Array(bytes);
}
