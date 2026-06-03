import Handlebars from "handlebars";
import type { DocumentDefinition, TemplateOptions } from "../types.js";

export class TemplateEngine {
  renderDefinition(definition: DocumentDefinition, options: TemplateOptions = {}): DocumentDefinition {
    if (!options.data) return definition;

    const source = JSON.stringify(definition);
    const template = Handlebars.compile(source, {
      strict: options.strict ?? false,
      noEscape: true
    });
    return JSON.parse(template(options.data)) as DocumentDefinition;
  }

  renderString(source: string, data: Record<string, unknown> = {}, strict = false): string {
    return Handlebars.compile(source, { strict, noEscape: true })(data);
  }
}
