import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import boxen from "boxen";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { ChatSession } from "./agents/runner.ts";

// Configure terminal markdown rendering
marked.setOptions({
  renderer: new TerminalRenderer({
    reflowText: true,
    width: 80,
  }) as any,
});

async function main() {
  const rl = readline.createInterface({ input, output });
  const session = new ChatSession();

  // Welcome banner
  console.log(
    boxen(
      `${chalk.bold.hex("#FF7043")("🤖 TypeScript AI Agent (Full MCP Integrated)")}\n` +
        `${chalk.gray("Ready to chat, manage files & connect to services!")}\n\n` +
        `${chalk.dim("Type your message or ")}${chalk.yellow.bold("exit")}${chalk.dim(" to quit.")}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 0 },
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );

  // Initialize tools and services (including MCP if enabled)
  process.stdout.write(chalk.dim("⚡ Initializing tools & MCP services...\r"));
  const { connected } = await session.init();
  process.stdout.write("\r\x1b[K"); // Clear initializing line

  if (connected && connected.length > 0) {
    console.log(chalk.green(`✔ Connected MCP Services: ${chalk.bold(connected.join(", "))}\n`));
  }

  rl.on("SIGINT", async () => {
    console.log(`\n\n${chalk.yellow("👋 Goodbye! Have a wonderful day ahead!")}\n`);
    await session.close();
    process.exit(0);
  });

  while (true) {
    let userInput: string;
    try {
      userInput = await rl.question(`\n${chalk.cyan.bold("You")} ${chalk.dim("›")} `);
    } catch (err: any) {
      if (err?.code === "ABORT_ERR" || err?.code === "ERR_USE_AFTER_CLOSE") break;
      throw err;
    }

    const trimmedInput = userInput.trim();

    if (!trimmedInput) continue;

    if (["exit", "quit", "q"].includes(trimmedInput.toLowerCase())) {
      console.log(`\n${chalk.yellow("👋 Goodbye! Have a wonderful day ahead!")}\n`);
      await session.close();
      break;
    }

    try {
      process.stdout.write(chalk.dim("⏳ Thinking...\r"));

      const response = await session.ask(trimmedInput, {
        onStatusChange: (status) => {
          process.stdout.write(`\r\x1b[K${chalk.dim("⏳ " + status)}\r`);
        },
        onToolStart: (toolName) => {
          process.stdout.write(`\r\x1b[K${chalk.yellow("⚡ Executing " + toolName + "...\r")}`);
        },
      });

      process.stdout.write("\r\x1b[K"); // Clear thinking line

      console.log(`\n${chalk.hex("#FF7043").bold("🤖 Agent:")}`);
      const rendered = await marked(response);
      console.log(rendered.trim());
    } catch (error: any) {
      process.stdout.write("\r\x1b[K");
      console.error(`\n${chalk.red.bold("✖ Error:")} ${chalk.red(error?.message || error)}`);
    }
  }

  rl.close();
}

main().catch((err: any) => {
  if (err?.code !== "ABORT_ERR") console.error(err);
});
