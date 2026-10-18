import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

export const writeFile = tool(
  async ({ filePath, content = "" }: { filePath: string; content?: string }) => {
    try {
      const resolved = resolvePath(filePath);
      const directory = path.dirname(resolved);

      // Ensure target directory exists
      await fs.mkdir(directory, { recursive: true });

      // Write content to the file
      await fs.writeFile(resolved, content, "utf-8");

      return `Successfully wrote file to: ${resolved}`;
    } catch (error: any) {
      return `Failed to write file: ${error?.message || String(error)}`;
    }
  },
  {
    name: "write_file",
    description:
      "Write or create a file with text/code content at a specified path and format (e.g., .txt, .json, .js, .py, .md, .html). Automatically creates parent folders if needed.",
    schema: z.object({
      filePath: z
        .string()
        .describe(
          "The destination file path including filename and extension, e.g. '~/Desktop/notes.txt' or './data.json'"
        ),
      content: z
        .string()
        .describe("The text or code content to write inside the file."),
    }),
  }
);
