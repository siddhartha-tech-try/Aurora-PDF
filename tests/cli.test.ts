import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("CLI", () => {
  it("prints help", async () => {
    const result = await execFileAsync("node", ["dist/cli/index.js", "--help"]);
    expect(result.stdout).toContain("aurora-pdf");
    expect(result.stdout).toContain("markdown");
  });
});
