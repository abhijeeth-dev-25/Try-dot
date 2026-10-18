import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

export const updateFile = tool(
  async ({
    filePath,
    content,
    mode = "append",
  }: {
    filePath: string;
    content: string;
    mode?: "append" | "overwrite";
  }) => {
    try {
      const resolved = resolvePath(filePath);
      const directory = path.dirname(resolved);

      await fs.mkdir(directory, { recursive: true });

      if (mode === "append") {
        await fs.appendFile(resolved, content, "utf-8");
        return `Successfully appended content to file at: ${resolved}`;
      } else {
        await fs.writeFile(resolved, content, "utf-8");
        return `Successfully updated (overwritten) file at: ${resolved}`;
      }
    } catch (error: any) {
      return `Failed to update file: ${error?.message || String(error)}`;
    }
  },
  {
    name: "update_file",
    description:
      "Update an existing file by appending text content to the end or replacing/overwriting its content (supports ~/Desktop paths).",
    schema: z.object({
      filePath: z
        .string()
        .describe("The path of the file to update, e.g. '~/Desktop/rahul/script.js'"),
      content: z.string().describe("The text or code content to add or write."),
      mode: z
        .enum(["append", "overwrite"])
        .default("append")
        .describe(
          "Choose 'append' to add to the end of the file, or 'overwrite' to replace content."
        ),
    }),
  }
);
