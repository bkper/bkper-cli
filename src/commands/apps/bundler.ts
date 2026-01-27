import * as esbuild from "esbuild";
import fs from "fs";
import type { HandlerType } from "./types.js";

/**
 * Finds the entry point for bundling based on deploy type.
 * Supports both monorepo (bkper-app-template) and simple project structures.
 */
export function findEntryPoint(type: HandlerType): string | null {
    // Monorepo candidates (for bkper-app-template structure)
    const monorepoWebCandidates = [
        "./packages/web/server/src/index.ts",
        "./packages/web/server/src/index.js",
        "./packages/web/src/index.ts",
        "./packages/web/src/index.js",
    ];

    const monorepoEventsCandidates = [
        "./packages/events/src/index.ts",
        "./packages/events/src/index.js",
    ];

    // Simple project candidates (for single worker projects)
    const simpleCandidates = [
        "./src/index.ts",
        "./src/index.js",
        "./index.ts",
        "./index.js",
    ];

    // Check monorepo first based on type, then fall back to simple
    const candidates =
        type === "events"
            ? [...monorepoEventsCandidates, ...simpleCandidates]
            : [...monorepoWebCandidates, ...simpleCandidates];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

/**
 * Bundles the project using esbuild.
 *
 * @param type - The deploy type ('web' or 'events')
 * @returns Bundled JavaScript code as a Buffer
 */
export async function bundleProject(type: HandlerType): Promise<Buffer> {
    const entryPoint = findEntryPoint(type);
    if (!entryPoint) {
        const expectedPaths =
            type === "events"
                ? "packages/events/src/index.ts or src/index.ts"
                : "packages/web/server/src/index.ts or src/index.ts";
        throw new Error(
            `No entry point found for ${type} handler. Expected: ${expectedPaths}`
        );
    }

    console.log(`  Entry point: ${entryPoint}`);

    const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        format: "esm",
        platform: "neutral",
        target: "es2020",
        minify: true,
        write: false,
        external: [],
        conditions: ["workerd", "worker", "browser"],
        mainFields: ["browser", "module", "main"],
    });

    if (result.errors.length > 0) {
        const errorMessages = result.errors.map((e) => e.text).join("\n");
        throw new Error(`Bundle failed:\n${errorMessages}`);
    }

    if (!result.outputFiles || result.outputFiles.length === 0) {
        throw new Error("Bundle produced no output");
    }

    return Buffer.from(result.outputFiles[0].contents);
}
