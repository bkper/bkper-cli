#!/usr/bin/env node

import { App } from "bkper-js";
import program from "commander";
import fs from "fs";
import * as YAML from "yaml";
import { login, logout } from "./auth/local-auth-service.js";

import dotenv from "dotenv";
import { setupBkper } from "./mcp/bkper-factory.js";
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
    .action((todo) => {
        logout();
    });

program
    .command("app")
    .description("Create/Update an App")
    .option("-u, --update", "Update the App")
    .option("-c, --create", "Create a new App")
    .action(async (options) => {
        try {
            setupBkper();

            let json: bkper.App;

            if (fs.existsSync("./bkperapp.json")) {
                json = JSON.parse(fs.readFileSync("./bkperapp.json", "utf8"));
            } else if (fs.existsSync("./bkperapp.yaml")) {
                json = YAML.parse(fs.readFileSync("./bkperapp.yaml", "utf8"));
            } else {
                throw new Error("bkperapp.json or bkperapp.yaml not found");
            }

            let app = new App(json)
                .setReadme(fs.readFileSync("./README.md", "utf8"))
                .setClientSecret(process.env.BKPER_CLIENT_SECRET)
                .setDeveloperEmail(process.env.BKPER_DEVELOPER_EMAIL)
                .setUserEmails(process.env.BKPER_USER_EMAILS);
            if (options.update) {
                app = await app.update();
                console.log(`Updated ${app.getId()} sucessfully.`);
            } else if (options.create) {
                app = await app.create();
                console.log(`Created ${app.getId()} sucessfully.`);
            }
        } catch (err) {
            console.log(err);
        }
    });

const mcpCommand = program.command("mcp").description("Bkper MCP server commands");

mcpCommand
    .command("start")
    .description("Start Bkper MCP server")
    .action(async () => {
        try {
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

