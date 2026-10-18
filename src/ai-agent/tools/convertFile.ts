import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as XLSX from "xlsx";
import { resolvePath } from "./pathUtils.ts";

/**
 * Normalizes format names (e.g. 'word' -> 'docx', 'excel' -> 'xlsx', 'powerpoint' -> 'pptx')
 * @param fmt - Input format string
 * @returns Clean format extension
 */
function normalizeFormat(fmt: string): string {
  const clean = fmt.trim().toLowerCase().replace(/^\./, "");
  const aliases: Record<string, string> = {
    excel: "xlsx",
    word: "docx",
    powerpoint: "pptx",
    ppt: "pptx",
    keynote: "key",
    jpeg: "jpg",
    text: "txt",
    markdown: "md",
  };
  return aliases[clean] || clean;
}

/**
 * Checks if a path is in a macOS TCC-protected folder (~/Desktop, ~/Downloads, ~/Documents)
 * @param targetPath - Path to check
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
 * Copies a file via macOS Finder to bypass TCC permissions if direct copy is blocked.
 * @param fromPath - Source path
 * @param toDir - Destination directory
 */
function copyViaFinder(fromPath: string, toDir: string): void {
  const script = `tell application "Finder" to duplicate (POSIX file "${fromPath}" as alias) to (POSIX file "${toDir}" as alias) with replacing`;
  execSync(`osascript -e '${script}'`, { stdio: ["pipe", "pipe", "ignore"] });
}

export const convertFile = tool(
  async ({
    filePath,
    targetFormat,
    outputPath,
  }: {
    filePath: string;
    targetFormat: string;
    outputPath?: string;
  }) => {
    let tmpDir: string | null = null;
    try {
      const resolvedInput = resolvePath(filePath);

      // Verify file exists
      let fileAccessible = false;
      try {
        fileAccessible = fs.existsSync(resolvedInput);
      } catch {
        fileAccessible = false;
      }

      if (!fileAccessible && !isProtectedMacPath(resolvedInput)) {
        return `Source file does not exist: ${resolvedInput}`;
      }

      const sourceExt = path.extname(resolvedInput).toLowerCase().replace(/^\./, "");
      const targetExt = normalizeFormat(targetFormat);

      if (sourceExt === targetExt) {
        return `Source file is already in ${targetExt} format.`;
      }

      const finalOutputPath = outputPath
        ? resolvePath(outputPath)
        : path.join(
            path.dirname(resolvedInput),
            `${path.basename(resolvedInput, path.extname(resolvedInput))}.${targetExt}`
          );

      // Check if staging is needed for protected macOS folders
      const needsStaging =
        isProtectedMacPath(resolvedInput) || isProtectedMacPath(finalOutputPath);

      let workingInput = resolvedInput;
      let workingOutput = finalOutputPath;

      if (needsStaging) {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ai-conv-"));
        const baseName = path.basename(resolvedInput);
        const stagedSrc = path.join(tmpDir, baseName);

        try {
          fs.copyFileSync(resolvedInput, stagedSrc);
        } catch {
          copyViaFinder(resolvedInput, tmpDir);
        }

        workingInput = stagedSrc;
        workingOutput = path.join(
          tmpDir,
          `${path.basename(resolvedInput, path.extname(resolvedInput))}.${targetExt}`
        );
      } else {
        fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
      }

      // --- CONVERSION ENGINE ROUTING ---

      // 1. SPREADSHEETS & DATA (xlsx, xls, csv, tsv, json)
      const dataFormats = ["xlsx", "xls", "csv", "tsv", "json"];
      if (dataFormats.includes(sourceExt) && dataFormats.includes(targetExt)) {
        if (sourceExt === "json") {
          const raw = fs.readFileSync(workingInput, "utf-8");
          const jsonData = JSON.parse(raw);
          const sheet = Array.isArray(jsonData)
            ? XLSX.utils.json_to_sheet(jsonData)
            : XLSX.utils.json_to_sheet([jsonData]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");

          if (targetExt === "csv") {
            fs.writeFileSync(workingOutput, XLSX.utils.sheet_to_csv(sheet), "utf-8");
          } else {
            XLSX.writeFile(wb, workingOutput);
          }
        } else {
          const buf = fs.readFileSync(workingInput);
          const wb = XLSX.read(buf, { type: "buffer" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];

          if (targetExt === "json") {
            const jsonOutput = XLSX.utils.sheet_to_json(firstSheet);
            fs.writeFileSync(
              workingOutput,
              JSON.stringify(jsonOutput, null, 2),
              "utf-8"
            );
          } else if (targetExt === "csv") {
            fs.writeFileSync(workingOutput, XLSX.utils.sheet_to_csv(firstSheet), "utf-8");
          } else {
            XLSX.writeFile(wb, workingOutput);
          }
        }
      }

      // 2. TEXT/DOCX TO PDF
      else if (
        (sourceExt === "txt" || sourceExt === "md" || sourceExt === "html" || sourceExt === "docx") &&
        targetExt === "pdf"
      ) {
        let textSource = workingInput;
        let cleanupIntermediate = false;

        if (sourceExt === "docx") {
          textSource = workingInput.replace(/\.docx$/i, ".txt");
          execSync(`textutil -convert txt "${workingInput}" -output "${textSource}"`);
          cleanupIntermediate = true;
        }

        execSync(`/usr/sbin/cupsfilter "${textSource}" > "${workingOutput}" 2>/dev/null`);

        if (cleanupIntermediate && fs.existsSync(textSource)) {
          fs.unlinkSync(textSource);
        }
      }

      // 3. MARKDOWN TO DOCX
      else if (sourceExt === "md" && targetExt === "docx") {
        const tempHtml = workingInput.replace(/\.md$/i, ".html");
        const rawMd = fs.readFileSync(workingInput, "utf-8");
        fs.writeFileSync(tempHtml, `<!DOCTYPE html><html><body><pre>${rawMd}</pre></body></html>`, "utf-8");
        execSync(`textutil -convert docx "${tempHtml}" -output "${workingOutput}"`);
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
      }

      // 4. DOCUMENT TO DOCUMENT (docx, doc, txt, html, rtf, odt) via macOS textutil
      else if (
        ["docx", "doc", "txt", "html", "rtf", "rtfd", "odt"].includes(sourceExt) &&
        ["docx", "doc", "txt", "html", "rtf", "rtfd", "odt"].includes(targetExt)
      ) {
        execSync(`textutil -convert "${targetExt}" "${workingInput}" -output "${workingOutput}"`);
      }

      // 5. KEYNOTE (.key -> .pdf, .pptx)
      else if (sourceExt === "key" && (targetExt === "pdf" || targetExt === "pptx")) {
        const exportAs = targetExt === "pdf" ? "PDF" : "Microsoft PowerPoint";
        const script = `
          tell application "Keynote"
            set doc to open (POSIX file "${workingInput}")
            export doc to (POSIX file "${workingOutput}") as ${exportAs}
            close doc saving no
          end tell
        `;
        execSync(`osascript -e '${script}'`);
      }

      // 6. PAGES (.pages -> .pdf, .docx)
      else if (sourceExt === "pages" && (targetExt === "pdf" || targetExt === "docx")) {
        const exportAs = targetExt === "pdf" ? "PDF" : "Microsoft Word";
        const script = `
          tell application "Pages"
            set doc to open (POSIX file "${workingInput}")
            export doc to (POSIX file "${workingOutput}") as ${exportAs}
            close doc saving no
          end tell
        `;
        execSync(`osascript -e '${script}'`);
      }

      // 7. NUMBERS (.numbers -> .pdf, .xlsx, .csv)
      else if (
        sourceExt === "numbers" &&
        (targetExt === "pdf" || targetExt === "xlsx" || targetExt === "csv")
      ) {
        const exportAs =
          targetExt === "pdf"
            ? "PDF"
            : targetExt === "xlsx"
            ? "Microsoft Excel"
            : "CSV";
        const script = `
          tell application "Numbers"
            set doc to open (POSIX file "${workingInput}")
            export doc to (POSIX file "${workingOutput}") as ${exportAs}
            close doc saving no
          end tell
        `;
        execSync(`osascript -e '${script}'`);
      }

      // 8. IMAGE & PDF CONVERSIONS via macOS sips
      else if (
        ["png", "jpg", "jpeg", "tiff", "gif", "bmp", "pdf", "heic", "webp"].includes(sourceExt) &&
        ["png", "jpg", "jpeg", "tiff", "gif", "bmp", "pdf"].includes(targetExt)
      ) {
        const sipsFormat = targetExt === "jpg" ? "jpeg" : targetExt;
        execSync(`sips -s format ${sipsFormat} "${workingInput}" --out "${workingOutput}"`);
      } else {
        return `Conversion from '.${sourceExt}' to '.${targetExt}' is not supported yet.`;
      }

      // Deliver final output if staged
      if (needsStaging && fs.existsSync(workingOutput)) {
        const targetDir = path.dirname(finalOutputPath);
        try {
          fs.copyFileSync(workingOutput, finalOutputPath);
        } catch {
          copyViaFinder(workingOutput, targetDir);
        }
      }

      return `Successfully converted ${sourceExt.toUpperCase()} to ${targetExt.toUpperCase()} at: ${finalOutputPath}`;
    } catch (error: any) {
      return `Failed to convert file: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }
  },
  {
    name: "convert_file",
    description:
      "Convert a file between formats (PDF, Word/docx, Excel/xlsx, CSV, JSON, Keynote/key, PPT/pptx, Images/png/jpg, HTML, TXT).",
    schema: z.object({
      filePath: z
        .string()
        .describe(
          "The path of the input file to convert, e.g. '~/Desktop/sahoo.png' or '~/Desktop/data.csv'"
        ),
      targetFormat: z
        .string()
        .describe(
          "Desired output format extension (e.g. 'pdf', 'docx', 'xlsx', 'csv', 'json', 'pptx', 'png', 'jpg')"
        ),
      outputPath: z
        .string()
        .optional()
        .describe("Optional custom destination path for the converted file."),
    }),
  }
);
