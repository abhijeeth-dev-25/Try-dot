# AI Agent & MCP Subsystem (TypeScript)

A modular, enterprise-grade AI Agent and Model Context Protocol (MCP) subsystem built in **TypeScript** using **LangChain** and **Mistral AI**.

---

## 🌟 Key Features

- **Multi-Turn Autonomous Agent**: Multi-turn conversation handling, automatic tool selection, iterative tool-calling loop, and real-time lifecycle event callbacks (`onStatusChange`, `onToolStart`, `onToolEnd`, `onToken`, `onError`).
- **Complete MCP Integration**:
  - **Local Stdio Transports**: Spawns CLI-based MCP servers (e.g., `@modelcontextprotocol/server-filesystem`, `@modelcontextprotocol/server-github`, `@modelcontextprotocol/server-memory`).
  - **Remote SSE Transports**: Connects to remote streaming endpoints with custom Bearer token, OAuth, and API key headers (e.g., Gmail, Google Sheets, Google Calendar, Custom Services).
  - **Dynamic LangChain Adapter**: Converts standard MCP JSON schemas into Zod schemas and LangChain `DynamicStructuredTool` instances.
  - **Namespace Isolation**: Discovers and namespaces tools as `${serverName}__${toolName}` to avoid collision.
  - **Graceful Fault Tolerance**: Skips offline or unconfigured MCP servers during initialization without crashing.
- **Local Desktop & Filesystem Capabilities**:
  - `create_directory`: Recursive folder creation.
  - `write_file`: File creation with automatic parent directory generation.
  - `read_file`: Content reading for files and directory inspection.
  - `update_file`: Append or overwrite file content.
  - `delete_path`: Safe file and recursive directory deletion.
  - `list_directory`: Directory listing with recursive traversal and macOS Finder AppleScript fallback for TCC-protected locations (`~/Desktop`, `~/Downloads`, `~/Documents`).
  - `run_file`: Script execution (`.js`, `.mjs`, `.cjs`, `.py`, `.sh`) with timeout.
  - `run_project`: Tech stack auto-detection (Node.js, Python, Rust, Go) and execution.
  - `convert_file`: File conversions (XLSX, CSV, JSON, Word/docx, PDF, Keynote, Pages, Numbers, Images via `sips`, textutil, cupsfilter).
  - `read_image`: Multimodal vision inspection using Mistral's `pixtral-12b-2409` with macOS TCC staging.
  - `get_current_time`: Real-time clock and date.
- **Gmail MCP Server & OAuth Tooling**:
  - Built-in SSE MCP Server with tools: `list_messages`, `read_message`, `send_email`, `create_draft`.
  - OAuth2 interactive token generator with automatic browser launching and `.env` updating.
- **CLI & UI Ready**:
  - Terminal interactive REPL (`npm run agent`).
  - Exported classes and interfaces ready for direct integration into React and Tauri frontends.

---

## 📁 Directory Structure

```text
src/ai-agent/
├── index.ts                     # Central barrel export
├── cli.ts                       # Terminal REPL interactive CLI
├── example.ts                   # MCP discovery & tool dispatch test runner
├── types/
│   └── index.ts                 # TypeScript types (Session, MCP, Tools, Callbacks)
├── agents/
│   ├── runner.ts                # ChatSession and runAgent implementations
│   └── prompts.ts               # System prompts and instructions
├── config/
│   ├── env.ts                   # Type-safe environment variable registry
│   └── model.ts                 # ChatMistralAI and vision model configurations
├── tools/
│   ├── pathUtils.ts             # Path resolution (~/Desktop, ~/Downloads, etc.)
│   ├── dateandtime.ts           # get_current_time tool
│   ├── directory.ts             # create_directory tool
│   ├── file.ts                  # write_file tool
│   ├── read.ts                  # read_file tool
│   ├── update.ts                # update_file tool
│   ├── delete.ts                # delete_path tool
│   ├── list.ts                  # list_directory tool with macOS Finder fallback
│   ├── runFile.ts               # run_file tool
│   ├── runProject.ts            # run_project tool with stack detector
│   ├── convertFile.ts           # convert_file tool (spreadsheets, docs, pdf, images)
│   ├── readImage.ts             # read_image tool (Pixtral vision model)
│   └── index.ts                 # Local tools registry
├── mcp/
│   ├── index.ts                 # MCP subsystem barrel export
│   ├── client/
│   │   └── manager.ts           # NativeMCPManager (multi-server coordinator)
│   ├── config/
│   │   └── servers.ts           # Server configurations & validator
│   ├── adapters/
│   │   └── langchainAdapter.ts  # MCP to LangChain StructuredTool adapter
│   ├── transports/
│   │   ├── stdioTransport.ts    # Stdio client transport
│   │   └── sseTransport.ts      # SSE client transport with auth headers
│   └── servers/
│       └── gmailServer.ts       # Standalone Gmail SSE MCP server
└── scripts/
    └── getGmailToken.ts         # OAuth2 authorization script for Gmail
```

---

## 🚀 Quick Start

### 1. Interactive CLI
```bash
npm run agent
```

### 2. Test MCP Connections & Discovery
```bash
npm run mcp:test
```

### 3. Start Gmail MCP Server
```bash
npm run server:gmail
```

### 4. Authorize Gmail OAuth (if needed)
```bash
npm run auth:gmail
```

---

## 💻 Programmatic Usage

### Multi-turn Conversation (`ChatSession`)

```typescript
import { ChatSession } from "./src/ai-agent/index.ts";

const session = new ChatSession({
  clientName: "my-app",
});

// Initialize MCP connections
const { connected, totalTools } = await session.init();
console.log(`Connected to MCP: ${connected.join(", ")}, Total tools: ${totalTools}`);

// Send a prompt with status callbacks
const reply = await session.ask("What is the current date and list files on my Desktop?", {
  onStatusChange: (status) => console.log("Status:", status),
  onToolStart: (tool, args) => console.log("Invoking:", tool, args),
  onToolEnd: (tool, result) => console.log("Result:", tool),
});

console.log(reply);

// Clean up connections when finished
await session.close();
```

### Single-shot Prompt (`runAgent`)

```typescript
import { runAgent } from "./src/ai-agent/index.ts";

const result = await runAgent("What time is it?");
console.log(result);
```
