import os from "node:os";
import path from "node:path";

/**
 * Robust path resolver:
 * - Expands ~ to home directory
 * - Resolves 'Desktop', 'Desktop/folder', 'Downloads', 'Documents' to user home subfolders
 * - Standardizes relative and absolute paths
 * @param targetPath - Path string to resolve
 * @returns Fully resolved absolute path
 */
export function resolvePath(targetPath: string): string {
  const clean = targetPath.trim();
  if (clean.startsWith("~")) {
    return path.join(os.homedir(), clean.slice(1));
  }

  const knownFolders = [
    "desktop",
    "downloads",
    "documents",
    "pictures",
    "movies",
    "music",
  ];

  for (const folder of knownFolders) {
    const capitalized = folder.charAt(0).toUpperCase() + folder.slice(1);
    if (clean.toLowerCase() === folder) {
      return path.join(os.homedir(), capitalized);
    }
    if (
      clean.toLowerCase().startsWith(folder + "/") ||
      clean.toLowerCase().startsWith(folder + "\\")
    ) {
      const rest = clean.slice(folder.length + 1);
      return path.join(os.homedir(), capitalized, rest);
    }
  }

  return path.resolve(clean);
}
