import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { resolvePath } from "./pathUtils.ts";

const execAsync = promisify(exec);

export const runFile = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      const resolved = resolvePath(filePath);

      if (!fs.existsSync(resolved)) {
        return `File does not exist: ${resolved}`;
      }

      const stats = fs.statSync(resolved);
      if (stats.isDirectory()) {
        return `"${resolved}" is a directory, not a file. Use run_project to run a project directory.`;
      }

      const ext = path.extname(resolved).toLowerCase();
      let cmd = "";

      switch (ext) {
        case ".js":
        case ".mjs":
        case ".cjs":
          cmd = `node "${resolved}"`;
          break;
        case ".py":
          cmd = `python3 "${resolved}"`;
          break;
        case ".sh":
          cmd = `bash "${resolved}"`;
          break;
        default:
          return `Unsupported file extension "${ext}". Supported: .js, .mjs, .cjs, .py, .sh`;
      }

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: path.dirname(resolved),
        timeout: 30000, // 30s timeout
      });

      if (stderr && !stdout) {
        return `Execution Error:\n${stderr}`;
      }

      return stdout ? stdout.trim() : "File executed successfully with no output.";
    } catch (error: any) {
      return `Failed to run file: ${error?.message || String(error)}`;
    }
  },
  {
    name: "run_file",
    description:
      "Run an individual script file (e.g. .js, .py, .sh) in the terminal and return its output.",
    schema: z.object({
      filePath: z
        .string()
        .describe(
          "The file path to execute, e.g. '~/Desktop/rahul/index.js' or './test.py'"
        ),
    }),
  }
);
