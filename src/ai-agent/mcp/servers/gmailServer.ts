import "dotenv/config";
import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import chalk from "chalk";
import boxen from "boxen";
import { env } from "../../config/env.ts";

const app = express();
app.use(express.json());
const PORT = env.GMAIL_SERVER_PORT || 3001;

// Initialize OAuth2 client with auto-refresh support
const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);

if (env.GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: env.GMAIL_REFRESH_TOKEN,
    access_token: env.GMAIL_TOKEN,
  });
}

function getGmailClient(bearerToken?: string) {
  if (bearerToken) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: bearerToken });
    return google.gmail({ version: "v1", auth });
  }
  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Helper to decode Gmail message body
function extractMessageBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
  }

  return "(No readable text body found)";
}

// Factory function to create a new MCP server instance per client connection
function createGmailMcpServer(bearerToken?: string): Server {
  const server = new Server(
    { name: "gmail-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Register Tool Definitions
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_messages",
          description:
            "List or search Gmail messages matching a query (e.g., 'GATE', 'is:unread', 'from:alice', 'newer_than:7d', 'subject:update').",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Gmail search query filter (e.g. 'GATE', 'is:unread', 'from:GATE')",
              },
              maxResults: {
                type: "number",
                description: "Maximum number of messages to return (default: 5, max: 20)",
              },
            },
          },
        },
        {
          name: "read_message",
          description: "Read the full email body and details of a specific email by its message ID.",
          inputSchema: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The unique ID of the message to read.",
              },
            },
            required: ["messageId"],
          },
        },
        {
          name: "send_email",
          description: "Send a new email to a recipient.",
          inputSchema: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Subject line of the email" },
              body: { type: "string", description: "Body text / message content" },
            },
            required: ["to", "subject", "body"],
          },
        },
        {
          name: "create_draft",
          description: "Create a draft email without sending it immediately.",
          inputSchema: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Subject line" },
              body: { type: "string", description: "Body content" },
            },
            required: ["to", "subject", "body"],
          },
        },
      ],
    };
  });

  // Tool Call Execution Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const gmail = getGmailClient(bearerToken || env.GMAIL_TOKEN);

    try {
      if (name === "list_messages") {
        const query = (args?.query as string) || "";
        console.log(chalk.cyan(`[Gmail MCP] Executing list_messages query: "${query}"`));

        const res = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: Math.min(Number(args?.maxResults) || 10, 20),
        });

        const messages = res.data.messages || [];
        if (messages.length === 0) {
          return { content: [{ type: "text", text: `No messages found in Gmail matching query: "${query}".` }] };
        }

        const summaries = await Promise.all(
          messages.map(async (item) => {
            const detail = await gmail.users.messages.get({
              userId: "me",
              id: item.id!,
              format: "metadata",
              metadataHeaders: ["Subject", "From", "Date"],
            });

            const headers = detail.data.payload?.headers || [];
            const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
            const from = headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";
            const date = headers.find((h) => h.name === "Date")?.value || "";

            return `• ID: ${item.id}\n  From: ${from}\n  Date: ${date}\n  Subject: ${subject}\n  Snippet: ${detail.data.snippet}`;
          })
        );

        return {
          content: [{ type: "text", text: summaries.join("\n\n") }],
        };
      }

      if (name === "read_message") {
        const messageId = args?.messageId as string;
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const from = headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";
        const to = headers.find((h) => h.name === "To")?.value || "";
        const date = headers.find((h) => h.name === "Date")?.value || "";
        const body = extractMessageBody(detail.data.payload);

        const formatted = `=== EMAIL DETAILS ===\nID: ${detail.data.id}\nFrom: ${from}\nTo: ${to}\nDate: ${date}\nSubject: ${subject}\n\n=== BODY ===\n${body}`;

        return {
          content: [{ type: "text", text: formatted }],
        };
      }

      if (name === "send_email") {
        const to = args?.to as string;
        const subject = args?.subject as string;
        const body = args?.body as string;

        const rawMessage = [
          `To: ${to}`,
          `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
          "Content-Type: text/plain; charset=utf-8",
          "",
          body,
        ].join("\n");

        const encoded = Buffer.from(rawMessage).toString("base64url");
        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encoded },
        });

        return {
          content: [{ type: "text", text: `✔ Email successfully sent to ${to} (Message ID: ${res.data.id})` }],
        };
      }

      if (name === "create_draft") {
        const to = args?.to as string;
        const subject = args?.subject as string;
        const body = args?.body as string;

        const rawMessage = [
          `To: ${to}`,
          `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
          "Content-Type: text/plain; charset=utf-8",
          "",
          body,
        ].join("\n");

        const encoded = Buffer.from(rawMessage).toString("base64url");
        const res = await gmail.users.drafts.create({
          userId: "me",
          requestBody: {
            message: { raw: encoded },
          },
        });

        return {
          content: [{ type: "text", text: `✔ Draft created successfully (Draft ID: ${res.data.id})` }],
        };
      }

      throw new Error(`Unknown tool "${name}"`);
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error executing ${name}: ${error?.message || String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

// Map of active transports by sessionId
const transports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let bearerToken = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.replace("Bearer ", "").trim();
  }

  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  const server = createGmailMcpServer(bearerToken);
  await server.connect(transport);
  console.log(chalk.green(`📡 [SSE] Client connected to Gmail MCP Server (Session: ${transport.sessionId})`));
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId] || Object.values(transports)[0];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No active SSE transport found.");
  }
});

export function startGmailMcpServer(port = PORT) {
  return app.listen(port, () => {
    console.log(
      boxen(
        chalk.bold.hex("#FF7043")("📬 Gmail HTTP/SSE MCP Server Online\n") +
        chalk.cyan(`Listening endpoint: `) + chalk.white.bold(`http://localhost:${port}/sse\n`) +
        chalk.dim(`Ready for native MCP client connections!`),
        { padding: 1, borderStyle: "round", borderColor: "green" }
      )
    );
  });
}

// If run directly as a script
if (process.argv[1] && process.argv[1].endsWith("gmailServer.ts")) {
  startGmailMcpServer();
}
