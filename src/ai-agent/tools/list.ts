import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { resolvePath } from "./pathUtils.ts";

/**
 * Fallback to macOS Finder AppleScript for directories protected by macOS TCC privacy (Desktop, Downloads, Documents, etc.)
 * @param resolvedPath - Resolved absolute path
 * @returns Formatted contents or null
 */
function listItemsViaFinder(resolvedPath: string): string | null {
  if (process.platform === "darwin") {
    try {
      const foldersOut = execSync(
        `osascript -e 'tell application "Finder" to get name of every folder of (POSIX file "${resolvedPath}" as alias)'`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      ).trim();

      const filesOut = execSync(
        `osascript -e 'tell application "Finder" to get name of every file of (POSIX file "${resolvedPath}" as alias)'`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      ).trim();

      const folders = foldersOut ? foldersOut.split(", ").filter(Boolean) : [];
      const files = filesOut ? filesOut.split(", ").filter(Boolean) : [];

      const formattedFolders = folders.map((f) => `[Folder] ${f}`);
      const formattedFiles = files.map((f) => `[File] ${f}`);
      const all = [...formattedFolders, ...formattedFiles];

      return (
        `Contents of ${resolvedPath}:\n` +
        (all.length ? all.join("\n") : "(empty directory)")
      );
    } catch {
      return null;
    }
  }
  return null;
}

export const listDirectory = tool(
  async ({ dirPath, recursive = false }: { dirPath: string; recursive?: boolean }) => {
    try {
      const resolvedPath = resolvePath(dirPath);

      // Check if standard POSIX readdirSync works
      try {
        if (!fs.existsSync(resolvedPath)) {
          // If node can't see it due to permissions, try Finder
          const finderResult = listItemsViaFinder(resolvedPath);
          if (finderResult) return finderResult;
          return `Path does not exist: ${resolvedPath}`;
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory()) {
          return `Specified path is a file, not a directory: ${resolvedPath}`;
        }

        if (recursive) {
          const walk = (currentPath: string): string[] => {
            let results: string[] = [];
            const list = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const item of list) {
              const fullPath = path.join(currentPath, item.name);
              if (item.isDirectory()) {
                results.push(`[Folder] ${fullPath}`);
                results = results.concat(walk(fullPath));
              } else {
                results.push(`[File] ${fullPath}`);
              }
            }
            return results;
          };

          const allItems = walk(resolvedPath);
          return (
            `Recursive contents of ${resolvedPath}:\n` +
            (allItems.length ? allItems.join("\n") : "(empty directory)")
          );
        } else {
          const list = fs.readdirSync(resolvedPath, { withFileTypes: true });
          const items = list.map((item) =>
            item.isDirectory() ? `[Folder] ${item.name}` : `[File] ${item.name}`
          );
          return (
            `Contents of ${resolvedPath}:\n` +
            (items.length ? items.join("\n") : "(empty directory)")
          );
        }
      } catch (innerErr: any) {
        // If macOS blocks readdirSync with EPERM, fallback to Finder
        if (innerErr?.code === "EPERM") {
          const finderResult = listItemsViaFinder(resolvedPath);
          if (finderResult) return finderResult;
        }
        throw innerErr;
      }
    } catch (error: any) {
      const resolvedPath = resolvePath(dirPath);

      // Final fallback to macOS Finder
      const finderResult = listItemsViaFinder(resolvedPath);
      if (finderResult) return finderResult;

      return `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "list_directory",
    description:
      "List all files and folders in a specified directory path (e.g. 'Downloads', '~/Downloads', 'Desktop', '~/Desktop', or any folder path), with optional recursive listing.",
    schema: z.object({
      dirPath: z
        .string()
        .describe(
          "The target directory path, e.g. 'Downloads', '~/Downloads', 'Desktop', '~/Desktop', or './src'"
        ),
      recursive: z
        .boolean()
        .default(false)
        .describe("Whether to list nested subdirectories recursively"),
    }),
  }
);
