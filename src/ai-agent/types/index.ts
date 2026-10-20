export type MCPTransportType = "stdio" | "sse" | "http" | "streamable-http";

export interface MCPStdioConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPSSEConfig {
  transport: "sse";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPHttpConfig {
  transport: "http" | "streamable-http";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export type MCPServerConfig = MCPStdioConfig | MCPSSEConfig | MCPHttpConfig;

export type MCPServersConfigMap = Record<string, MCPServerConfig>;

export interface MCPValidationResult {
  valid: boolean;
  reason?: string;
}

export interface MCPToolItem {
  name: string;
  originalName: string;
  serverName: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPToolRegistryEntry {
  serverName: string;
  originalName: string;
  tool: any;
}

export interface MCPCallToolResult {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  isError?: boolean;
  [key: string]: any;
}

export interface AgentCallbacks {
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string, args: Record<string, any>) => void;
  onToolEnd?: (toolName: string, result: string) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
}

export interface ChatSessionOptions {
  systemPrompt?: string;
  clientName?: string;
  clientVersion?: string;
  enableMcp?: boolean;
  serverConfigs?: MCPServersConfigMap;
}

export interface InitResult {
  connected: string[];
  failed?: Array<{ name: string; error: string }>;
  totalTools: number;
  error?: string;
}
