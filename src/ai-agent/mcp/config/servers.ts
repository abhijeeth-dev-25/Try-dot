import { env } from "../../config/env.ts";
import type {
  MCPServerConfig,
  MCPServersConfigMap,
  MCPValidationResult,
} from "../../types/index.ts";

/**
 * Standard configuration registry for any Model Context Protocol (MCP) server.
 * Supports:
 *  - "stdio": Spawns local CLI processes (npx, uvx, python, docker, binary) with environment-based auth.
 *  - "sse": Connects to remote HTTP/SSE streaming endpoints with Header/Bearer/OAuth-based auth.
 */
export const mcpServersConfig: MCPServersConfigMap = {
  // =========================================================================
  // 1. LOCAL STDIO SERVERS (CLI processes authenticated via Environment Vars)
  // =========================================================================

  // Local filesystem access
  filesystem: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", env.ALLOWED_DIR],
    enabled: true,
  },

  // GitHub MCP server (requires Personal Access Token)
  github: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: env.GITHUB_TOKEN,
    },
    enabled: Boolean(env.GITHUB_TOKEN),
  },

  // Memory/Knowledge Graph server
  memory: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    enabled: false,
  },

  // =========================================================================
  // 2. REMOTE SSE SERVERS (HTTP streaming authenticated via Headers/Bearer)
  // =========================================================================

  // Google Sheets MCP endpoint
  googleSheets: {
    transport: "sse",
    url: env.GOOGLE_SHEETS_MCP_URL || "https://sheets-mcp.example.com/sse",
    headers: {
      Authorization: `Bearer ${env.GOOGLE_WORKSPACE_TOKEN}`,
    },
    enabled: Boolean(env.GOOGLE_WORKSPACE_TOKEN && env.GOOGLE_SHEETS_MCP_URL),
  },

  // Google Calendar MCP endpoint
  googleCalendar: {
    transport: "sse",
    url: env.GOOGLE_CALENDAR_MCP_URL || "https://calendar-mcp.example.com/sse",
    headers: {
      Authorization: `Bearer ${env.GOOGLE_WORKSPACE_TOKEN}`,
    },
    enabled: Boolean(env.GOOGLE_WORKSPACE_TOKEN && env.GOOGLE_CALENDAR_MCP_URL),
  },

  // Gmail MCP endpoint
  gmail: {
    transport: "sse",
    url: env.GMAIL_MCP_URL || "http://localhost:3001/sse",
    headers: {
      Authorization: `Bearer ${env.GMAIL_TOKEN}`,
      "X-User-Email": env.GMAIL_USER_EMAIL,
    },
    enabled: Boolean(env.GMAIL_TOKEN && env.GMAIL_MCP_URL),
  },

  // Generic custom remote server with API Key
  customService: {
    transport: "sse",
    url: env.CUSTOM_MCP_URL || "https://api.example.com/mcp/sse",
    headers: {
      "X-API-Key": env.CUSTOM_API_KEY,
    },
    enabled: Boolean(env.CUSTOM_API_KEY && env.CUSTOM_MCP_URL),
  },
};

/**
 * Validates whether a server's required credentials and paths are supplied.
 */
export function validateServerConfig(
  serverName: string,
  config: MCPServerConfig
): MCPValidationResult {
  if (!config.transport) {
    return {
      valid: false,
      reason: `Server "${serverName}" is missing "transport" property ("stdio" or "sse").`,
    };
  }

  if (config.transport === "stdio") {
    if (!config.command) {
      return {
        valid: false,
        reason: `Stdio server "${serverName}" is missing "command".`,
      };
    }
    if (config.env) {
      for (const [key, val] of Object.entries(config.env)) {
        if (!val || val.trim() === "") {
          return {
            valid: false,
            reason: `Missing required environment variable "${key}" for stdio server "${serverName}".`,
          };
        }
      }
    }
  }

  if (config.transport === "sse") {
    if (!config.url) {
      return {
        valid: false,
        reason: `SSE server "${serverName}" is missing "url".`,
      };
    }
    if (
      config.headers?.Authorization &&
      (config.headers.Authorization.includes("undefined") ||
        config.headers.Authorization.trim() === "Bearer")
    ) {
      return {
        valid: false,
        reason: `Missing required Authorization token for SSE server "${serverName}".`,
      };
    }
  }

  return { valid: true };
}
