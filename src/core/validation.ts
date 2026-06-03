import type { DocumentDefinition } from "../types.js";
import { InvalidDocumentError } from "../errors.js";

export function assertDocumentDefinition(definition: DocumentDefinition): void {
  if (!definition || typeof definition !== "object") {
    throw new InvalidDocumentError("Document definition must be an object.");
  }

  if (!Array.isArray(definition.content)) {
    throw new InvalidDocumentError("Document definition requires a content array.");
  }

  for (const [index, block] of definition.content.entries()) {
    if (!block || typeof block !== "object" || typeof block.type !== "string") {
      throw new InvalidDocumentError(`Content block at index ${index} is invalid.`);
    }
  }
}
