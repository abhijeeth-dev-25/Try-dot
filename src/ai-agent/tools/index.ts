import { getCurrentTime } from "./dateandtime.ts";
import { createDirectory } from "./directory.ts";
import { writeFile } from "./file.ts";
import { readFile } from "./read.ts";
import { updateFile } from "./update.ts";
import { deletePath } from "./delete.ts";
import { listDirectory } from "./list.ts";
import { runFile } from "./runFile.ts";
import { runProject } from "./runProject.ts";
import { convertFile } from "./convertFile.ts";
import { readImage } from "./readImage.ts";

export const tools = [
  getCurrentTime,
  createDirectory,
  writeFile,
  readFile,
  updateFile,
  deletePath,
  listDirectory,
  runFile,
  runProject,
  convertFile,
  readImage,
];

export const toolsByName: Record<string, any> = {
  [getCurrentTime.name]: getCurrentTime,
  [createDirectory.name]: createDirectory,
  [writeFile.name]: writeFile,
  [readFile.name]: readFile,
  [updateFile.name]: updateFile,
  [deletePath.name]: deletePath,
  [listDirectory.name]: listDirectory,
  [runFile.name]: runFile,
  [runProject.name]: runProject,
  [convertFile.name]: convertFile,
  [readImage.name]: readImage,
};

export {
  getCurrentTime,
  createDirectory,
  writeFile,
  readFile,
  updateFile,
  deletePath,
  listDirectory,
  runFile,
  runProject,
  convertFile,
  readImage,
};
