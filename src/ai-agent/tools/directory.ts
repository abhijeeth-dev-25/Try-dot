import fs from "node:fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

export const createDirectory = tool(
  async ({ dirPath }: { dirPath: string }) => {
    try {
      const resolved = resolvePath(dirPath);
      await fs.mkdir(resolved, { recursive: true });
      return `Successfully created directory at: ${resolved}`;
    } catch (error: any) {
      return `Failed to create directory: ${error?.message || String(error)}`;
    }
  },
  {
    name: "create_directory",
    description:
      "Create a new folder or directory at the specified location (supports absolute paths, relative paths, or ~/Desktop/my-folder).",
    schema: z.object({
      dirPath: z
        .string()
        .describe(
          "The path where the new directory should be created, e.g. '~/Desktop/projects' or './new-folder'"
        ),
    }),
  }
);
