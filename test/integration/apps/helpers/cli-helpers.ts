import { type ChildProcess } from 'child_process';
import { TestConfig, determinePlatformUrl } from '../../helpers.js';
import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { runCommand, spawnTracked } from './process.js';

export { runCommand, stopProcess } from './process.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const CLI_PATH = path.join(REPO_ROOT, 'lib', 'cli.js');
const API_URL = process.env.BKPER_API_URL || 'https://api-dev.bkper.app';

// Dynamic platform URL - set during test setup
let dynamicPlatformUrl: string | null = null;

/**
 * Initialize the platform URL for tests (tries localhost, falls back to dev)
 */
export async function initializePlatformUrl(): Promise<string | null> {
    dynamicPlatformUrl = await determinePlatformUrl();
    return dynamicPlatformUrl;
}

/**
 * Get the currently configured platform URL
 */
export function getPlatformUrl(): string {
    if (!dynamicPlatformUrl) {
        throw new Error('Platform URL not initialized. Call initializePlatformUrl() first.');
    }
    return dynamicPlatformUrl;
}

/**
 * Run a CLI command and wait for completion
 */
export async function runCli(
    args: string[],
    cwd: string,
    envOverrides?: Record<string, string>
): Promise<void> {
    const platformUrl = dynamicPlatformUrl || TestConfig.PLATFORM_URL;
    await runCommand('node', [CLI_PATH, ...args], cwd, {
        BKPER_PLATFORM_URL: envOverrides?.BKPER_PLATFORM_URL || platformUrl,
        BKPER_API_URL: envOverrides?.BKPER_API_URL || API_URL,
        ...envOverrides,
    });
}

/**
 * Start a CLI command and return the process (for long-running commands like dev)
 */
export function startCli(
    args: string[],
    cwd: string,
    envOverrides?: Record<string, string>
): ChildProcess {
    const platformUrl = dynamicPlatformUrl || TestConfig.PLATFORM_URL;
    const child = spawnTracked('node', [CLI_PATH, ...args], {
        cwd,
        env: {
            ...process.env,
            BKPER_PLATFORM_URL: envOverrides?.BKPER_PLATFORM_URL || platformUrl,
            BKPER_API_URL: envOverrides?.BKPER_API_URL || API_URL,
            ...envOverrides,
        },
        stdio: 'pipe',
    });

    child.on('error', err => {
        console.error('Failed to start CLI process:', err);
    });

    return child;
}

/**
 * Poll a URL until it responds successfully or timeout
 */
export async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
                return;
            }
        } catch {
            // Not ready yet
        }
        await sleep(2000);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that the CLI server Worker build artifact exists.
 */
export function assertArtifacts(rootDir: string): void {
    expect(fs.existsSync(path.join(rootDir, 'dist/server/index.js'))).to.be.true;
}

/**
 * Assert that build artifacts have been cleaned
 */
export function assertCleaned(rootDir: string): void {
    expect(fs.existsSync(path.join(rootDir, 'dist'))).to.be.false;
}
