import { EventSource } from "eventsource";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Ensure global EventSource is polyfilled in Node.js runtime for custom header support
if (typeof (globalThis as any).EventSource === "undefined") {
  (globalThis as any).EventSource = EventSource;
}

export interface SSETransportOptions {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Creates and configures an SSE client transport for a remote MCP server.
 * Injects custom authentication headers (Bearer, API Keys) into both:
 * 1. The initial GET stream request (via eventSourceInit.fetch)
 * 2. Outgoing JSON-RPC message POST requests (via requestInit.headers)
 */
export function createSSETransport({ url, headers = {} }: SSETransportOptions): SSEClientTransport {
  if (!url) {
    throw new Error("Cannot create SSE transport: 'url' is required.");
  }

  const parsedUrl = new URL(url);

  return new SSEClientTransport(parsedUrl, {
    // Applied to outgoing POST requests (callTool, listTools JSON-RPC payload)
    requestInit: {
      headers: {
        ...headers,
      },
    },

    // Applied to the incoming GET SSE stream connection
    eventSourceInit: {
      fetch: (input: any, init?: any) => {
        const mergedHeaders = new Headers(init?.headers || {});
        for (const [key, val] of Object.entries(headers)) {
          mergedHeaders.set(key, val);
        }
        return fetch(input, { ...init, headers: mergedHeaders });
      },
    },
  });
}
