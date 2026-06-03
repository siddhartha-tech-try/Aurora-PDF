#!/usr/bin/env node
import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AuroraPDF } from "../api.js";

const program = new Command();

program.name("aurora-pdf").description("Generate and manipulate PDFs from HTML, Markdown, images, and document definitions.").version("0.1.0");

program
  .command("html")
  .argument("<input>", "HTML file path, raw HTML string, or URL")
  .argument("<output>", "Output PDF path")
  .option("--landscape", "Render in landscape orientation")
  .action(async (input: string, output: string, flags: { landscape?: boolean }) => {
    const options = { page: { orientation: flags.landscape ? "landscape" : "portrait" } as const };
    const artifact = /^https?:\/\//i.test(input)
      ? await AuroraPDF.fromUrl(input, options)
      : input.trim().startsWith("<")
        ? await AuroraPDF.fromHtml(input, options)
        : await AuroraPDF.fromHtmlFile(input, options);
    await artifact.save(output);
  });

program
  .command("markdown")
  .argument("<input>", "Markdown file path")
  .argument("<output>", "Output PDF path")
  .action(async (input: string, output: string) => {
    const artifact = await AuroraPDF.fromMarkdownFile(input);
    await artifact.save(output);
  });

program
  .command("images")
  .argument("<output>", "Output PDF path")
  .argument("<images...>", "Image paths")
  .action(async (output: string, images: string[]) => {
    const artifact = await AuroraPDF.fromImages(images);
    await artifact.save(output);
  });

program
  .command("merge")
  .argument("<output>", "Output PDF path")
  .argument("<pdfs...>", "Input PDF paths")
  .action(async (output: string, pdfs: string[]) => {
    const artifact = await AuroraPDF.merge(pdfs);
    await artifact.save(output);
  });

program
  .command("split")
  .argument("<input>", "Input PDF path")
  .argument("<outDir>", "Directory for split pages")
  .action(async (input: string, outDir: string) => {
    await mkdir(outDir, { recursive: true });
    const pages = await AuroraPDF.split(input);
    await Promise.all(pages.map((page, index) => page.save(join(outDir, `page-${index + 1}.pdf`))));
  });

program
  .command("encrypt")
  .argument("<input>", "Input PDF path")
  .argument("<output>", "Output PDF path")
  .requiredOption("--user-password <password>", "Password required to open the PDF")
  .option("--owner-password <password>", "Password required to change permissions")
  .option("--no-printing", "Disallow printing")
  .option("--no-copying", "Disallow copying")
  .option("--no-modifying", "Disallow modification")
  .action(async (input: string, output: string, flags: Record<string, string | boolean>) => {
    const artifact = await AuroraPDF.encrypt(input, {
      userPassword: String(flags.userPassword),
      ownerPassword: flags.ownerPassword ? String(flags.ownerPassword) : undefined,
      permissions: {
        printing: flags.printing !== false,
        copying: flags.copying !== false,
        modifying: flags.modifying !== false
      }
    });
    await artifact.save(output);
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
