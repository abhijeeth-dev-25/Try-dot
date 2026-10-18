import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { NativeMCPManager } from "../client/manager.ts";

/**
 * Converts a standard MCP JSON Schema object into a Zod schema
 * so LangChain LLMs (Mistral, OpenAI, Anthropic) can perform structured tool calling.
 */
export function jsonSchemaToZod(schema: Record<string, any>): z.ZodObject<any> {
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set<string>(schema.required || []);

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    let field: z.ZodTypeAny;

    if (prop.type === "string") {
      field = z.string();
    } else if (prop.type === "number" || prop.type === "integer") {
      field = z.number();
    } else if (prop.type === "boolean") {
      field = z.boolean();
    } else if (prop.type === "array") {
      field = z.array(z.any());
    } else {
      field = z.any();
    }

    if (prop.description) {
      field = field.describe(prop.description);
    }

    if (!required.has(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape);
}

/**
 * Converts Native MCP tools from a NativeMCPManager instance into LangChain-compatible Structured Tools.
 * Enables zero-friction integration with existing LangChain/LangGraph agents.
 */
export async function toLangChainTools(
  manager: NativeMCPManager
): Promise<DynamicStructuredTool[]> {
  const mcpTools = await manager.listAllTools();

  return mcpTools.map((mcpTool) => {
    return new DynamicStructuredTool({
      name: mcpTool.name.replace(/-/g, "_"),
      description: mcpTool.description || `Tool from MCP server ${mcpTool.serverName}`,
      schema: jsonSchemaToZod(mcpTool.inputSchema),
      func: async (args: any) => {
        try {
          const result = await manager.callTool(mcpTool.name, args || {});
          if (Array.isArray(result?.content)) {
            return result.content
              .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
              .join("\n");
          }
          return typeof result === "string" ? result : JSON.stringify(result);
        } catch (error: any) {
          return `Tool execution failed: ${error?.message || String(error)}`;
        }
      },
    });
  });
}
