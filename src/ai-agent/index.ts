// Central Entry Point for AI Agent & MCP Subsystem (TypeScript)

// Agents & Runners
export { ChatSession, runAgent } from "./agents/runner.ts";
export { DEFAULT_SYSTEM_PROMPT } from "./agents/prompts.ts";

// Config & Models
export { model, visionModel, createChatModel } from "./config/model.ts";
export { env } from "./config/env.ts";

// Tools
export {
  tools,
  toolsByName,
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
} from "./tools/index.ts";
export { resolvePath } from "./tools/pathUtils.ts";

// MCP Subsystem
export {
  NativeMCPManager,
  mcpServersConfig,
  validateServerConfig,
  toLangChainTools,
  createStdioTransport,
  createSSETransport,
  startGmailMcpServer,
} from "./mcp/index.ts";

// Types
export type * from "./types/index.ts";
export type { StdioTransportOptions } from "./mcp/transports/stdioTransport.ts";
export type { SSETransportOptions } from "./mcp/transports/sseTransport.ts";
export type { NativeMCPManagerOptions } from "./mcp/client/manager.ts";
export type { ModelOptions } from "./config/model.ts";
