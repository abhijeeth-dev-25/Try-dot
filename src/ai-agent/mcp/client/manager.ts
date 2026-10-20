import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createStdioTransport } from "../transports/stdioTransport.ts";
import { createSSETransport } from "../transports/sseTransport.ts";
import { createHTTPTransport } from "../transports/httpTransport.ts";
import { validateServerConfig } from "../config/servers.ts";
import type {
  MCPServerConfig,
  MCPServersConfigMap,
  MCPToolItem,
  MCPToolRegistryEntry,
  MCPCallToolResult,
} from "../../types/index.ts";

export interface NativeMCPManagerOptions {
  clientName?: string;
  clientVersion?: string;
}

/**
 * Native Model Context Protocol (MCP) Manager.
 * Orchestrates multiple simultaneous local (stdio) and remote (sse) MCP servers.
 */
export class NativeMCPManager {
  private configs: MCPServersConfigMap;
  private clientName: string;
  private clientVersion: string;
  private clients: Map<string, Client> = new Map();
  private toolRegistry: Map<string, MCPToolRegistryEntry> = new Map();

  constructor(
    serverConfigs: MCPServersConfigMap = {},
    options: NativeMCPManagerOptions = {}
  ) {
    this.configs = serverConfigs;
    this.clientName = options.clientName || "native-mcp-client";
    this.clientVersion = options.clientVersion || "1.0.0";
  }

  /**
   * Connects to a single MCP server.
   */
  async connectServer(serverName: string, config: MCPServerConfig): Promise<Client> {
    const validation = validateServerConfig(serverName, config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.reason}`);
    }

    if (this.clients.has(serverName)) {
      console.warn(`[MCP] Server "${serverName}" is already connected. Reconnecting...`);
      await this.closeServer(serverName);
    }

    let transport: any;
    if (config.transport === "stdio") {
      transport = createStdioTransport({
        command: config.command,
        args: config.args || [],
        env: config.env || {},
      });
    } else if (config.transport === "sse") {
      transport = createSSETransport({
        url: config.url,
        headers: config.headers || {},
      });
    } else if (config.transport === "http" || config.transport === "streamable-http") {
      transport = createHTTPTransport({
        url: config.url,
        headers: config.headers || {},
      });
    } else {
      throw new Error(
        `Unsupported transport "${(config as any).transport}" for server "${serverName}".`
      );
    }

    const client = new Client(
      { name: `${this.clientName}-${serverName}`, version: this.clientVersion },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(serverName, client);
    return client;
  }

  /**
   * Connects to all enabled servers defined in the configuration.
   * Skips unconfigured or disabled servers gracefully without crashing the whole application.
   */
  async connectAll(configsToConnect: MCPServersConfigMap = this.configs): Promise<{
    connected: string[];
    failed: Array<{ name: string; error: string }>;
  }> {
    const connected: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const [serverName, config] of Object.entries(configsToConnect)) {
      if (config.enabled === false) {
        continue;
      }

      try {
        await this.connectServer(serverName, config);
        connected.push(serverName);
      } catch (err: any) {
        failed.push({ name: serverName, error: err?.message || String(err) });
      }
    }

    return { connected, failed };
  }

  /**
   * Discovers and aggregates all tools across every connected server.
   * Namespaces tools as `${serverName}__${toolName}` to avoid collision.
   */
  async listAllTools(): Promise<MCPToolItem[]> {
    this.toolRegistry.clear();
    const aggregated: MCPToolItem[] = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const { tools = [] } = await client.listTools();
        for (const tool of tools) {
          const namespacedName = `${serverName}__${tool.name}`;

          this.toolRegistry.set(namespacedName, {
            serverName,
            originalName: tool.name,
            tool,
          });

          aggregated.push({
            name: namespacedName,
            originalName: tool.name,
            serverName,
            description: `[${serverName}] ${tool.description || ""}`,
            inputSchema: (tool.inputSchema as Record<string, any>) || {},
          });
        }
      } catch (err: any) {
        console.error(`[MCP] Failed to retrieve tools from "${serverName}": ${err?.message || err}`);
      }
    }

    return aggregated;
  }

  /**
   * Dispatches a tool call to the matching MCP server and unwraps the result.
   */
  async callTool(
    namespacedName: string,
    args: Record<string, any> = {}
  ): Promise<MCPCallToolResult> {
    const entry = this.toolRegistry.get(namespacedName);
    if (!entry) {
      throw new Error(`Tool "${namespacedName}" is not registered across any connected MCP server.`);
    }

    const client = this.clients.get(entry.serverName);
    if (!client) {
      throw new Error(`MCP client for server "${entry.serverName}" is not active.`);
    }

    const result = await client.callTool({
      name: entry.originalName,
      arguments: args,
    });

    return result as MCPCallToolResult;
  }

  /**
   * Retrieves resources from a specific server.
   */
  async listResources(serverName: string): Promise<any[]> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server "${serverName}" is not connected.`);
    const { resources = [] } = await client.listResources();
    return resources;
  }

  /**
   * Reads a resource by URI from a specific server.
   */
  async readResource(serverName: string, uri: string): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server "${serverName}" is not connected.`);
    return client.readResource({ uri });
  }

  /**
   * Closes a single server's transport cleanly.
   */
  async closeServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      try {
        await client.close();
      } catch {}
      this.clients.delete(serverName);

      // Clean registry
      for (const [key, val] of this.toolRegistry.entries()) {
        if (val.serverName === serverName) {
          this.toolRegistry.delete(key);
        }
      }
    }
  }

  /**
   * Closes all active server transports and cleans up subprocesses.
   */
  async closeAll(): Promise<void> {
    for (const serverName of Array.from(this.clients.keys())) {
      await this.closeServer(serverName);
    }
  }
}
