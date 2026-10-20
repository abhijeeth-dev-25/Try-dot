import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface HTTPTransportOptions {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Creates and configures a Streamable HTTP client transport for a remote MCP server.
 * This modern transport connects to endpoints (like Tavily) supporting POST-based
 * JSON-RPC streaming and optional SSE response streams.
 */
export function createHTTPTransport({
  url,
  headers = {},
}: HTTPTransportOptions): StreamableHTTPClientTransport {
  if (!url) {
    throw new Error("Cannot create HTTP transport: 'url' is required.");
  }

  const parsedUrl = new URL(url);

  return new StreamableHTTPClientTransport(parsedUrl, {
    requestInit: {
      headers: {
        ...headers,
      },
    },
  });
}
