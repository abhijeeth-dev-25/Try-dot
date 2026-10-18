import fs from "node:fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

export const deletePath = tool(
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
        await fs.rm(resolved, { recursive: true, force: true });
        return `Successfully deleted directory: ${resolved}`;
      } else {
        await fs.unlink(resolved);
        return `Successfully deleted file: ${resolved}`;
      }
    } catch (error: any) {
      return `Failed to delete path: ${error?.message || String(error)}`;
    }
  },
  {
    name: "delete_path",
    description:
      "Delete a file or an entire folder/directory at the specified path (supports relative paths, absolute paths, or ~/Desktop/folder).",
    schema: z.object({
      itemPath: z
        .string()
        .describe(
          "The path of the file or folder to delete, e.g. '~/Desktop/rahul' or './notes.txt'"
        ),
    }),
  }
);
