import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { google } from "googleapis";
import chalk from "chalk";
import boxen from "boxen";
import { env } from "../config/env.ts";

const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const PORT = 3000;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(chalk.red("✖ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env"));
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // Force refresh_token return
});

console.log(
  boxen(
    chalk.bold.hex("#FF7043")("🔐 Gmail OAuth 2.0 Authorization\n") +
      chalk.gray("Follow these steps to authorize your chatbot:"),
    { padding: 1, borderStyle: "round", borderColor: "cyan" }
  )
);

console.log(chalk.yellow("1. Opening Google sign-in page in your browser..."));
console.log(chalk.dim("If it doesn't open automatically, click or paste this URL into your browser:\n"));
console.log(chalk.cyan.underline(authUrl));
console.log("\n" + chalk.gray("Waiting for authorization..."));

// Automatically open browser on macOS
if (process.platform === "darwin") {
  exec(`open "${authUrl}"`);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url && req.url.startsWith("/oauth2callback")) {
      const urlParams = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const code = urlParams.searchParams.get("code");
      const error = urlParams.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Authorization Error: ${error}</h2>`);
        console.error(chalk.red(`\n✖ Authorization failed: ${error}`));
        server.close();
        process.exit(1);
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>No code returned.</h2>");
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Fetch user profile email
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const userEmail = profile.data.emailAddress || "";

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1 style="color: #2e7d32;">✔ Authorization Successful!</h1>
          <p>Connected to <b>${userEmail}</b></p>
          <p style="color: #666;">You can close this window now and return to your terminal.</p>
        </div>
      `);

      // Update .env file
      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

      const updates: Record<string, string> = {
        GMAIL_TOKEN: tokens.access_token || "",
        GMAIL_REFRESH_TOKEN: tokens.refresh_token || "",
        GMAIL_USER_EMAIL: userEmail,
      };

      for (const [key, value] of Object.entries(updates)) {
        if (!value) continue;
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");

      console.log(chalk.green(`\n✔ Successfully authorized email: ${chalk.bold(userEmail)}`));
      console.log(chalk.green("✔ Saved GMAIL_TOKEN and GMAIL_REFRESH_TOKEN to .env"));
      console.log(chalk.cyan("\nYou are all set! You can now start the Gmail MCP server.\n"));

      server.close();
      process.exit(0);
    }
  } catch (err: any) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Internal Error: ${err?.message || String(err)}</h2>`);
    console.error(chalk.red("✖ Token exchange error:"), err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
