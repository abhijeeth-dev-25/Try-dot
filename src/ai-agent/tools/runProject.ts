import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { resolvePath } from "./pathUtils.ts";

const execAsync = promisify(exec);

export const runProject = tool(
  async ({ projectPath, script }: { projectPath: string; script?: string }) => {
    try {
      const resolved = resolvePath(projectPath);

      if (!fs.existsSync(resolved)) {
        return `Project directory does not exist: ${resolved}`;
      }

      const stats = fs.statSync(resolved);
      if (!stats.isDirectory()) {
        return `"${resolved}" is a file. Use run_file to execute individual files.`;
      }

      let cmd = "";
      let detectedStack = "";

      // 1. Node.js (package.json)
      const packageJsonPath = path.join(resolved, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        detectedStack = "Node.js";
        let pkg: any = {};
        try {
          pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        } catch {}

        const scripts = pkg.scripts || {};

        if (script && scripts[script]) {
          cmd = `npm run ${script}`;
        } else if (scripts.start) {
          cmd = "npm start";
        } else if (scripts.dev) {
          cmd = "npm run dev";
        } else if (pkg.main && fs.existsSync(path.join(resolved, pkg.main))) {
          cmd = `node "${pkg.main}"`;
        } else if (fs.existsSync(path.join(resolved, "index.js"))) {
          cmd = "node index.js";
        } else {
          return `Found Node.js project, but no start script or entry file found in package.json.`;
        }
      }

      // 2. Python (requirements.txt, pyproject.toml, main.py, app.py)
      else if (
        fs.existsSync(path.join(resolved, "requirements.txt")) ||
        fs.existsSync(path.join(resolved, "pyproject.toml")) ||
        fs.existsSync(path.join(resolved, "main.py")) ||
        fs.existsSync(path.join(resolved, "app.py"))
      ) {
        detectedStack = "Python";
        if (fs.existsSync(path.join(resolved, "main.py"))) {
          cmd = "python3 main.py";
        } else if (fs.existsSync(path.join(resolved, "app.py"))) {
          cmd = "python3 app.py";
        } else {
          cmd = "python3 -m unittest";
        }
      }

      // 3. Rust (Cargo.toml)
      else if (fs.existsSync(path.join(resolved, "Cargo.toml"))) {
        detectedStack = "Rust";
        cmd = "cargo run";
      }

      // 4. Go (go.mod)
      else if (fs.existsSync(path.join(resolved, "go.mod"))) {
        detectedStack = "Go";
        cmd = "go run .";
      } else {
        return `Could not detect tech stack in "${resolved}". Supported: Node.js (package.json), Python (main.py, requirements.txt), Rust (Cargo.toml), Go (go.mod).`;
      }

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: resolved,
        timeout: 30000, // 30s timeout
      });

      const output = (stdout || stderr || "Project executed with no console output.").trim();
      return `[${detectedStack} Project Executed: ${cmd}]\n${output}`;
    } catch (error: any) {
      return `Failed to run project: ${error?.message || String(error)}`;
    }
  },
  {
    name: "run_project",
    description:
      "Run an entire project by auto-detecting its tech stack (Node.js/npm, Python, Rust, Go) and running its main start/dev command.",
    schema: z.object({
      projectPath: z
        .string()
        .describe(
          "The directory path of the project to run, e.g. '~/Desktop/rahul' or './'"
        ),
      script: z
        .string()
        .optional()
        .describe("Optional npm script to run (e.g. 'start', 'dev', 'test')"),
    }),
  }
);
