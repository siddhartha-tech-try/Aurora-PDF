import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import type { EncryptOptions, PdfByteSource } from "../types.js";
import { readBinary } from "../utils/bytes.js";
import { PdfArtifact } from "../core/artifact.js";
import { AuroraPdfError } from "../errors.js";

export async function encryptPdf(input: PdfByteSource, options: EncryptOptions): Promise<PdfArtifact> {
  if (!options.userPassword) {
    throw new AuroraPdfError("A userPassword is required for PDF encryption.", "MISSING_PASSWORD");
  }

  const bytes = await readBinary(input);
  const encrypted = await encryptPDF(bytes, options.userPassword, {
    ownerPassword: options.ownerPassword,
    algorithm: options.algorithm ?? "AES-256",
    allowPrinting: options.permissions?.printing ?? true,
    allowModifying: options.permissions?.modifying ?? true,
    allowCopying: options.permissions?.copying ?? true,
    allowAnnotating: options.permissions?.annotating ?? true,
    allowFillingForms: options.permissions?.fillingForms ?? true,
    allowExtraction: options.permissions?.extraction ?? true,
    allowAssembly: options.permissions?.assembly ?? true,
    allowHighQualityPrint: options.permissions?.highQualityPrint ?? true
  });

  return new PdfArtifact(encrypted, "encrypted");
}
