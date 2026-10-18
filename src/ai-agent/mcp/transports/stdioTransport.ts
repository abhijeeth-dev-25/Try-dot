import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Creates and configures a Stdio client transport for a local CLI MCP server.
 * Handles environment variable merging and command execution.
 */
export function createStdioTransport({
  command,
  args = [],
  env = {},
}: StdioTransportOptions): StdioClientTransport {
  if (!command) {
    throw new Error("Cannot create Stdio transport: 'command' is required.");
  }

  // Merge process.env with custom environment variables cleanly
  const mergedEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) mergedEnv[k] = v;
  }
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) mergedEnv[k] = v;
  }

  return new StdioClientTransport({
    command,
    args,
    env: mergedEnv,
  });
}
