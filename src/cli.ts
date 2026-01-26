#!/usr/bin/env node

import program from "commander";
import { login, logout } from "./auth/local-auth-service.js";
import { setupBkper } from "./bkper-factory.js";
import { listApps, syncApp, deployApp, undeployApp, statusApp, initApp } from "./commands/apps.js";
import { updateSkills } from "./commands/skills.js";

import dotenv from "dotenv";
dotenv.config();

program
    .command("login")
    .description("Login Bkper")
    .action(async () => {
        await login();
    });

program
    .command("logout")
    .description("Logout Bkper")
    .action(() => {
        logout();
    });

// New 'apps' command group (plural, standard)
const appsCommand = program.command("apps").description("Manage Bkper Apps");

appsCommand
    .command("init <name>")
    .description("Create a new Bkper app from template")
    .action(async (name: string) => {
        try {
            await initApp(name);
        } catch (err) {
            console.error("Error initializing app:", err);
            process.exit(1);
        }
    });

appsCommand
    .command("list")
    .description("List all apps you have access to")
    .action(async () => {
        try {
            setupBkper();
            const apps = await listApps();

            if (apps.length === 0) {
                console.log("No apps found.");
                return;
            }

            // Table-style output
            console.log("\nApps:\n");
            console.log("ID".padEnd(25) + "Name".padEnd(30) + "Published");
            console.log("-".repeat(65));

            for (const app of apps) {
                const id = (app.id || "").padEnd(25);
                const name = (app.name || "").padEnd(30);
                const published = app.published ? "Yes" : "No";
                console.log(`${id}${name}${published}`);
            }

            console.log(`\nTotal: ${apps.length} app(s)`);
        } catch (err) {
            console.error("Error listing apps:", err);
            process.exit(1);
        }
    });

appsCommand
    .command("sync")
    .description("Sync app config to Bkper (creates if new, updates if exists)")
    .action(async () => {
        try {
            setupBkper();
            const result = await syncApp();
            console.log(`Synced ${result.id} (${result.action})`);
        } catch (err) {
            console.error("Error syncing app:", err);
            process.exit(1);
        }
    });

appsCommand
    .command("deploy")
    .description("Deploy app to Bkper Platform")
    .option("--dev", "Deploy to development environment")
    .option("--events", "Deploy events handler instead of web handler")
    .option("--sync", "Sync app config before deploying")
    .action(async (options) => {
        try {
            await deployApp(options);
        } catch (err) {
            console.error("Error deploying app:", err);
            process.exit(1);
        }
    });

appsCommand
    .command("undeploy")
    .description("Remove app from Bkper Platform")
    .option("--dev", "Remove from development environment")
    .option("--events", "Remove events handler instead of web handler")
    .action(async (options) => {
        try {
            await undeployApp(options);
        } catch (err) {
            console.error("Error undeploying app:", err);
            process.exit(1);
        }
    });

appsCommand
    .command("status")
    .description("Show deployment status for all handlers")
    .action(async () => {
        try {
            await statusApp();
        } catch (err) {
            console.error("Error getting app status:", err);
            process.exit(1);
        }
    });

const mcpCommand = program.command("mcp").description("Bkper MCP server commands");

mcpCommand
    .command("start")
    .description("Start Bkper MCP server")
    .action(async () => {
        try {
            // Sync global skills before starting
            await updateSkills();

            // Import and start the MCP server directly
            const { BkperMcpServer } = await import("./mcp/server.js");
            const server = new BkperMcpServer();
            await server.run();
        } catch (err) {
            console.error("Error starting MCP server:", err);
            process.exit(1);
        }
    });

program.parse(process.argv);
