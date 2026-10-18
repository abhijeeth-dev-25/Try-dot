import fs from "node:fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

export const readFile = tool(
  async ({ itemPath }: { itemPath: string }) => {
    try {
      const resolved = resolvePath(itemPath);

      let stats;
      try {
        stats = await fs.stat(resolved);
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          return `Path does not exist: ${resolved}`;
        }
        throw err;
      }

      if (stats.isDirectory()) {
        const items = await fs.readdir(resolved);
        return `Directory contents of ${resolved}:\n${
          items.length ? items.join("\n") : "(empty directory)"
        }`;
      } else {
        const content = await fs.readFile(resolved, "utf-8");
        return content;
      }
    } catch (error: any) {
      return `Failed to read path: ${error?.message || String(error)}`;
    }
  },
  {
    name: "read_file",
    description:
      "Read the text content of a file at the specified path (e.g. ~/Desktop/rahul/index.js).",
    schema: z.object({
      itemPath: z
        .string()
        .describe(
          "The file path to read, e.g. '~/Desktop/rahul/index.js' or './package.json'"
        ),
    }),
  }
);
