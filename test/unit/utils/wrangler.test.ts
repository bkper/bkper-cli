import { expect, getTestPaths } from "../helpers/test-setup.js";
import fs from "fs";
import path from "path";
import os from "os";

const { __dirname } = getTestPaths(import.meta.url);

// Import the functions to test
const { findWranglerConfig, parseWranglerConfig, extractBindingsForApi } = await import(
    "../../../src/utils/wrangler.js"
);

describe("Wrangler Config Utilities", function () {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(function () {
        // Create a temp directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wrangler-test-"));
        originalCwd = process.cwd();
        process.chdir(tempDir);
    });

    afterEach(function () {
        // Restore original cwd and cleanup
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe("findWranglerConfig", function () {
        it("should find monorepo events config", function () {
            // Setup monorepo structure for events
            fs.mkdirSync("packages/events", { recursive: true });
            fs.writeFileSync("packages/events/wrangler.jsonc", "{}");

            const result = findWranglerConfig("events");

            expect(result).to.not.be.null;
            expect(result).to.include("packages/events/wrangler.jsonc");
        });

        it("should find monorepo web config", function () {
            // Setup monorepo structure for web
            fs.mkdirSync("packages/web/server", { recursive: true });
            fs.writeFileSync("packages/web/server/wrangler.jsonc", "{}");

            const result = findWranglerConfig("web");

            expect(result).to.not.be.null;
            expect(result).to.include("packages/web/server/wrangler.jsonc");
        });

        it("should find simple project config for events", function () {
            // Setup simple project structure
            fs.writeFileSync("wrangler.jsonc", "{}");

            const result = findWranglerConfig("events");

            expect(result).to.not.be.null;
            expect(result).to.include("wrangler.jsonc");
        });

        it("should find simple project config for web", function () {
            // Setup simple project structure
            fs.writeFileSync("wrangler.jsonc", "{}");

            const result = findWranglerConfig("web");

            expect(result).to.not.be.null;
            expect(result).to.include("wrangler.jsonc");
        });

        it("should return null when no config found", function () {
            // Empty directory, no wrangler config
            const result = findWranglerConfig("events");

            expect(result).to.be.null;
        });

        it("should prefer monorepo config over simple project config", function () {
            // Setup both configs
            fs.mkdirSync("packages/events", { recursive: true });
            fs.writeFileSync("packages/events/wrangler.jsonc", '{"name": "monorepo"}');
            fs.writeFileSync("wrangler.jsonc", '{"name": "simple"}');

            const result = findWranglerConfig("events");

            expect(result).to.not.be.null;
            expect(result).to.include("packages/events/wrangler.jsonc");
        });

        it("should find .json config when .jsonc not present", function () {
            // Setup with .json extension
            fs.writeFileSync("wrangler.json", "{}");

            const result = findWranglerConfig("events");

            expect(result).to.not.be.null;
            expect(result).to.include("wrangler.json");
        });
    });

    describe("parseWranglerConfig", function () {
        it("should parse bindings correctly", function () {
            const configContent = JSON.stringify({
                name: "my-app",
                kv_namespaces: [{ binding: "CACHE", id: "abc123" }],
                r2_buckets: [{ binding: "STORAGE", bucket_name: "my-bucket" }],
                d1_databases: [{ binding: "DB", database_id: "xyz789" }],
            });
            const configPath = path.join(tempDir, "wrangler.json");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.kv_namespaces).to.have.length(1);
            expect(result.kv_namespaces![0].binding).to.equal("CACHE");
            expect(result.r2_buckets).to.have.length(1);
            expect(result.r2_buckets![0].binding).to.equal("STORAGE");
            expect(result.d1_databases).to.have.length(1);
            expect(result.d1_databases![0].binding).to.equal("DB");
        });

        it("should handle JSONC comments", function () {
            const configContent = `{
                // This is a single-line comment
                "name": "my-app",
                /* This is a
                   multi-line comment */
                "kv_namespaces": [{ "binding": "CACHE" }],
                "compatibility_date": "2025-01-15" // trailing comment
            }`;
            const configPath = path.join(tempDir, "wrangler.jsonc");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.kv_namespaces).to.have.length(1);
            expect(result.kv_namespaces![0].binding).to.equal("CACHE");
            expect(result.compatibility_date).to.equal("2025-01-15");
        });

        it("should handle missing bindings", function () {
            const configContent = JSON.stringify({
                name: "my-app",
                compatibility_date: "2025-01-15",
            });
            const configPath = path.join(tempDir, "wrangler.json");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.kv_namespaces).to.be.undefined;
            expect(result.r2_buckets).to.be.undefined;
            expect(result.d1_databases).to.be.undefined;
            expect(result.compatibility_date).to.equal("2025-01-15");
        });

        it("should parse compatibility flags", function () {
            const configContent = JSON.stringify({
                name: "my-app",
                compatibility_flags: ["nodejs_compat", "streams_enable_constructors"],
            });
            const configPath = path.join(tempDir, "wrangler.json");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.compatibility_flags).to.have.length(2);
            expect(result.compatibility_flags).to.include("nodejs_compat");
        });

        it("should parse multiple bindings of same type", function () {
            const configContent = JSON.stringify({
                kv_namespaces: [{ binding: "CACHE" }, { binding: "SESSIONS" }],
            });
            const configPath = path.join(tempDir, "wrangler.json");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.kv_namespaces).to.have.length(2);
            expect(result.kv_namespaces![0].binding).to.equal("CACHE");
            expect(result.kv_namespaces![1].binding).to.equal("SESSIONS");
        });

        it("should handle full bkper-app-template format", function () {
            const configContent = `{
                "$schema": "node_modules/wrangler/config-schema.json",
                "name": "my-app-events",
                "main": "src/index.ts",
                "compatibility_date": "2025-01-15",
                "compatibility_flags": ["nodejs_compat"],
                "kv_namespaces": [{ "binding": "CACHE" }],
                "r2_buckets": [{ "binding": "STORAGE" }],
                "d1_databases": [{ "binding": "DB" }]
            }`;
            const configPath = path.join(tempDir, "wrangler.jsonc");
            fs.writeFileSync(configPath, configContent);

            const result = parseWranglerConfig(configPath);

            expect(result.kv_namespaces![0].binding).to.equal("CACHE");
            expect(result.r2_buckets![0].binding).to.equal("STORAGE");
            expect(result.d1_databases![0].binding).to.equal("DB");
            expect(result.compatibility_date).to.equal("2025-01-15");
            expect(result.compatibility_flags).to.include("nodejs_compat");
        });
    });

    describe("extractBindingsForApi", function () {
        it("should extract binding names for API", function () {
            const config = {
                kv_namespaces: [{ binding: "CACHE" }],
                r2_buckets: [{ binding: "STORAGE" }],
                d1_databases: [{ binding: "DB" }],
            };

            const result = extractBindingsForApi(config);

            expect(result).to.not.be.undefined;
            expect(result!.kv).to.deep.equal(["CACHE"]);
            expect(result!.r2).to.deep.equal(["STORAGE"]);
            expect(result!.d1).to.deep.equal(["DB"]);
        });

        it("should return undefined when no bindings", function () {
            const config = {
                compatibility_date: "2025-01-15",
            };

            const result = extractBindingsForApi(config);

            expect(result).to.be.undefined;
        });

        it("should handle partial bindings", function () {
            const config = {
                kv_namespaces: [{ binding: "CACHE" }],
            };

            const result = extractBindingsForApi(config);

            expect(result).to.not.be.undefined;
            expect(result!.kv).to.deep.equal(["CACHE"]);
            expect(result!.r2).to.be.undefined;
            expect(result!.d1).to.be.undefined;
        });

        it("should handle empty binding arrays", function () {
            const config = {
                kv_namespaces: [],
                r2_buckets: [],
            };

            const result = extractBindingsForApi(config);

            expect(result).to.be.undefined;
        });
    });
});
