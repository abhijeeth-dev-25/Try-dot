import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
  type AIMessage,
} from "@langchain/core/messages";
import { model as defaultModel } from "../config/model.ts";
import { tools as localTools, toolsByName as localToolsByName } from "../tools/index.ts";
import { NativeMCPManager } from "../mcp/client/manager.ts";
import { mcpServersConfig } from "../mcp/config/servers.ts";
import { toLangChainTools } from "../mcp/adapters/langchainAdapter.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts.ts";
import type {
  AgentCallbacks,
  ChatSessionOptions,
  InitResult,
  MCPServersConfigMap,
} from "../types/index.ts";

/**
 * Manages conversation history, multi-turn tool calling, and MCP server integrations.
 */
export class ChatSession {
  public systemPrompt: string;
  public messages: BaseMessage[];
  public tools: any[];
  public toolsByName: Record<string, any>;
  public modelWithTools: any;
  public mcpManager: NativeMCPManager | null = null;
  public isMcpInitialized = false;

  private clientName: string;
  private clientVersion: string;
  private serverConfigs: MCPServersConfigMap;
  private enableMcp: boolean;

  constructor(options: ChatSessionOptions = {}) {
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.clientName = options.clientName || "project-agent-client";
    this.clientVersion = options.clientVersion || "1.0.0";
    this.serverConfigs = options.serverConfigs || mcpServersConfig;
    this.enableMcp = options.enableMcp ?? true;

    this.messages = [new SystemMessage(this.systemPrompt)];

    // Initialize with local filesystem & utility tools
    this.tools = [...localTools];
    this.toolsByName = { ...localToolsByName };
    this.modelWithTools = defaultModel.bindTools(this.tools);
  }

  /**
   * Initializes MCP connections without blocking startup if a remote server is offline.
   */
  async init(): Promise<InitResult> {
    if (this.isMcpInitialized || !this.enableMcp) {
      return { connected: [], totalTools: this.tools.length };
    }

    try {
      this.mcpManager = new NativeMCPManager(this.serverConfigs, {
        clientName: this.clientName,
        clientVersion: this.clientVersion,
      });

      const { connected, failed } = await this.mcpManager.connectAll();

      if (connected.length > 0) {
        const mcpTools = await toLangChainTools(this.mcpManager);

        for (const mcpTool of mcpTools) {
          this.tools.push(mcpTool);
          this.toolsByName[mcpTool.name] = mcpTool;
        }

        // Rebind model with complete local + MCP toolset
        this.modelWithTools = defaultModel.bindTools(this.tools);
      }

      this.isMcpInitialized = true;
      return { connected, failed, totalTools: this.tools.length };
    } catch (error: any) {
      // Gracefully fall back to local tools if MCP discovery encounters an issue
      this.isMcpInitialized = true;
      return {
        connected: [],
        totalTools: this.tools.length,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Sends user prompt to the agent and loops through any tool calls.
   * Supports real-time status and lifecycle callbacks for UI/CLI integration.
   */
  async ask(inputPrompt: string, callbacks?: AgentCallbacks): Promise<string> {
    this.messages.push(new HumanMessage(inputPrompt));
    callbacks?.onStatusChange?.("Thinking...");

    let response: AIMessage = await this.modelWithTools.invoke(this.messages);
    this.messages.push(response);

    // Execute tool calls if requested by the model
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        const selectedTool = this.toolsByName[toolCall.name];
        if (!selectedTool) {
          const err = new Error(`Tool "${toolCall.name}" not found.`);
          callbacks?.onError?.(err);
          throw err;
        }

        callbacks?.onStatusChange?.(`Executing tool: ${toolCall.name}...`);
        callbacks?.onToolStart?.(toolCall.name, toolCall.args);

        let toolResultStr = "";
        try {
          const toolResult = await selectedTool.invoke(toolCall.args);
          toolResultStr =
            typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
          callbacks?.onToolEnd?.(toolCall.name, toolResultStr);
        } catch (toolError: any) {
          toolResultStr = `Tool execution error: ${toolError?.message || String(toolError)}`;
          callbacks?.onToolEnd?.(toolCall.name, toolResultStr);
        }

        this.messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id || "",
            content: toolResultStr,
          })
        );
      }

      callbacks?.onStatusChange?.("Processing tool outputs...");
      response = await this.modelWithTools.invoke(this.messages);
      this.messages.push(response);
    }

    callbacks?.onStatusChange?.("Completed");
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return content;
  }

  /**
   * Clears conversational history while keeping system prompt and bound tools.
   */
  clearHistory(): void {
    this.messages = [new SystemMessage(this.systemPrompt)];
  }

  /**
   * Returns current conversation history.
   */
  getHistory(): BaseMessage[] {
    return [...this.messages];
  }

  /**
   * Safely terminates any active MCP client transports and child processes.
   */
  async close(): Promise<void> {
    if (this.mcpManager) {
      try {
        await this.mcpManager.closeAll();
      } catch {}
      this.mcpManager = null;
    }
  }
}

/**
 * Single-shot runner for simple queries.
 */
export async function runAgent(
  inputPrompt: string,
  session: ChatSession = new ChatSession()
): Promise<string> {
  await session.init();
  try {
    return await session.ask(inputPrompt);
  } finally {
    await session.close();
  }
}
