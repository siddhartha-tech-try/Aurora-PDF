import type { AuroraPdfPlugin, DocumentDefinition, RenderContext } from "../types.js";

export async function applyBeforeDefinitionPlugins(
  definition: DocumentDefinition,
  plugins: AuroraPdfPlugin[] = [],
  context: RenderContext
): Promise<DocumentDefinition> {
  let current = definition;
  for (const plugin of plugins) {
    if (plugin.beforeRenderDefinition) {
      current = await plugin.beforeRenderDefinition(current, context);
    }
  }
  return current;
}

export async function applyAfterBytesPlugins(bytes: Uint8Array, plugins: AuroraPdfPlugin[] = [], context: RenderContext): Promise<Uint8Array> {
  let current = bytes;
  for (const plugin of plugins) {
    if (plugin.afterRenderBytes) {
      current = await plugin.afterRenderBytes(current, context);
    }
  }
  return current;
}
