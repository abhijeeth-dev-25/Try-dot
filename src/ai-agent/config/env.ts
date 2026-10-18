import "dotenv/config";

export const env = {
  // LLM API Keys
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "",

  // MCP: Local Stdio Servers
  ALLOWED_DIR: process.env.ALLOWED_DIR || process.cwd(),
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",

  // Google Workspace & OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_WORKSPACE_TOKEN: process.env.GOOGLE_WORKSPACE_TOKEN || "",
  GOOGLE_SHEETS_MCP_URL: process.env.GOOGLE_SHEETS_MCP_URL || "",
  GOOGLE_CALENDAR_MCP_URL: process.env.GOOGLE_CALENDAR_MCP_URL || "",

  // Gmail MCP Server
  GMAIL_TOKEN: process.env.GMAIL_TOKEN || "",
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || "",
  GMAIL_USER_EMAIL: process.env.GMAIL_USER_EMAIL || "",
  GMAIL_MCP_URL: process.env.GMAIL_MCP_URL || "http://localhost:3001/sse",
  GMAIL_SERVER_PORT: Number(process.env.GMAIL_SERVER_PORT) || 3001,

  // Custom Remote Servers
  CUSTOM_MCP_URL: process.env.CUSTOM_MCP_URL || "",
  CUSTOM_API_KEY: process.env.CUSTOM_API_KEY || "",
};
