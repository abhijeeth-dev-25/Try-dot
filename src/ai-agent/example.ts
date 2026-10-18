import "dotenv/config";
import chalk from "chalk";
import boxen from "boxen";
import { NativeMCPManager } from "./mcp/client/manager.ts";
import { mcpServersConfig } from "./mcp/config/servers.ts";

async function main() {
  console.log(
    boxen(
      chalk.bold.cyan("🚀 Native MCP Client Runner (TypeScript)\n") +
        chalk.gray("Testing connections, tool discovery & dispatch"),
      { padding: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );

  // Initialize the manager with our configurations
  const manager = new NativeMCPManager(mcpServersConfig);

  try {
    // 1. Connect to all enabled servers
    console.log(chalk.yellow("📡 Connecting to configured MCP servers..."));
    const { connected, failed } = await manager.connectAll();

    console.log(chalk.green(`\n✔ Successfully connected to: ${connected.join(", ") || "None"}`));
    if (failed.length > 0) {
      console.log(chalk.dim("ℹ Skipped/Failed unconfigured servers:"));
      failed.forEach((f) => console.log(chalk.dim(`  - ${f.name}: ${f.error}`)));
    }

    // 2. Discover all tools
    console.log(chalk.yellow("\n🔍 Discovering tools across connected servers..."));
    const tools = await manager.listAllTools();
    console.log(chalk.cyan(`Found ${tools.length} available tools:`));

    for (const tool of tools) {
      console.log(
        `  ${chalk.bold.hex("#FF7043")("• " + tool.name)} ${chalk.dim(`(${tool.serverName})`)}\n` +
          `    ${chalk.gray(tool.description.slice(0, 80))}...`
      );
    }

    // 3. Test a tool invocation if filesystem is available
    const fsTool = tools.find((t) => t.name === "filesystem__list_directory");
    if (fsTool) {
      console.log(chalk.yellow("\n⚡ Test executing 'filesystem__list_directory' on current directory..."));
      const result = await manager.callTool("filesystem__list_directory", {
        path: process.cwd(),
      });

      console.log(chalk.green("✔ Result received from MCP server:"));
      console.log(chalk.white(JSON.stringify(result, null, 2)));
    }
  } catch (error) {
    console.error(chalk.red("✖ MCP Execution Error:"), error);
  } finally {
    // 4. Clean shutdown
    console.log(chalk.yellow("\n🧹 Cleaning up transports and child processes..."));
    await manager.closeAll();
    console.log(chalk.green("✔ Done!\n"));
  }
}

main().catch(console.error);
