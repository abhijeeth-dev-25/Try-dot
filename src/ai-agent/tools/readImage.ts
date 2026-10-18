import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { visionModel } from "../config/model.ts";
import { resolvePath } from "./pathUtils.ts";

/**
 * Checks if a path is in a macOS protected folder (~/Desktop, ~/Downloads, ~/Documents)
 * @param targetPath - Path to inspect
 * @returns boolean
 */
function isProtectedMacPath(targetPath: string): boolean {
  if (process.platform !== "darwin") return false;
  const home = os.homedir();
  const protectedDirs = [
    path.join(home, "Desktop"),
    path.join(home, "Downloads"),
    path.join(home, "Documents"),
  ];
  return protectedDirs.some(
    (dir) => targetPath === dir || targetPath.startsWith(dir + path.sep)
  );
}

/**
 * Stages a protected file into a temporary directory using Finder AppleScript if needed.
 * @param srcPath - Source file path
 * @param destDir - Destination directory
 */
function copyViaFinder(srcPath: string, destDir: string): void {
  const script = `tell application "Finder" to duplicate (POSIX file "${srcPath}" as alias) to (POSIX file "${destDir}" as alias) with replacing`;
  execSync(`osascript -e '${script}'`, { stdio: ["pipe", "pipe", "ignore"] });
}

export const readImage = tool(
  async ({ imagePath, prompt }: { imagePath: string; prompt?: string }) => {
    let tmpDir: string | null = null;
    try {
      const resolved = resolvePath(imagePath);

      // Verify file existence
      let exists = false;
      try {
        exists = fs.existsSync(resolved);
      } catch {
        exists = false;
      }

      if (!exists && !isProtectedMacPath(resolved)) {
        return `Image file does not exist: ${resolved}`;
      }

      let readTarget = resolved;

      // Handle macOS TCC protected folder staging
      if (isProtectedMacPath(resolved)) {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ai-vision-"));
        const stagedPath = path.join(tmpDir, path.basename(resolved));

        try {
          fs.copyFileSync(resolved, stagedPath);
        } catch {
          copyViaFinder(resolved, tmpDir);
        }
        readTarget = stagedPath;
      }

      if (!fs.existsSync(readTarget)) {
        return `Failed to access image file: ${resolved}`;
      }

      const ext = path.extname(readTarget).toLowerCase().replace(/^\./, "");
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
      };

      const mimeType = mimeTypes[ext] || "image/png";
      const imageBuffer = fs.readFileSync(readTarget);
      const base64Data = imageBuffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const userInstruction =
        prompt && prompt.trim()
          ? prompt.trim()
          : "Describe this image in detail, identify everything in it, and extract any visible text, code, or UI elements.";

      // Send to Pixtral multimodal model
      const response = await visionModel.invoke([
        new HumanMessage({
          content: [
            { type: "text", text: userInstruction },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        }),
      ]);

      return typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    } catch (error: any) {
      return `Failed to analyze image: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }
  },
  {
    name: "read_image",
    description:
      "Read, inspect, and identify what is inside an image or screenshot (extracts text, code, objects, diagrams, UI elements).",
    schema: z.object({
      imagePath: z
        .string()
        .describe(
          "The path to the image or screenshot file, e.g. '~/Desktop/sahoo.png' or './photo.jpg'"
        ),
      prompt: z
        .string()
        .optional()
        .describe(
          "Optional specific question about the image, e.g. 'Extract all text' or 'What error is shown?'"
        ),
    }),
  }
);
