export class AuroraPdfError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AuroraPdfError";
  }
}

export class UnsupportedFeatureError extends AuroraPdfError {
  constructor(message: string, cause?: unknown) {
    super(message, "UNSUPPORTED_FEATURE", cause);
    this.name = "UnsupportedFeatureError";
  }
}

export class InvalidDocumentError extends AuroraPdfError {
  constructor(message: string, cause?: unknown) {
    super(message, "INVALID_DOCUMENT", cause);
    this.name = "InvalidDocumentError";
  }
}

export class RenderingError extends AuroraPdfError {
  constructor(message: string, cause?: unknown) {
    super(message, "RENDERING_ERROR", cause);
    this.name = "RenderingError";
  }
}
