import { spawn, type ChildProcess } from 'child_process';
import { TestConfig, determinePlatformUrl } from '../../helpers.js';
import fs from 'fs';
import path from 'path';
import { expect } from 'chai';

const CLI_PATH = '/workspace/bkper-cli/lib/cli.js';
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
export async function runCli(args: string[], cwd: string, envOverrides?: Record<string, string>): Promise<void> {
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
export function startCli(args: string[], cwd: string, envOverrides?: Record<string, string>): ChildProcess {
  const platformUrl = dynamicPlatformUrl || TestConfig.PLATFORM_URL;
  const child = spawn('node', [CLI_PATH, ...args], {
    cwd,
    env: {
      ...process.env,
      BKPER_PLATFORM_URL: envOverrides?.BKPER_PLATFORM_URL || platformUrl,
      BKPER_API_URL: envOverrides?.BKPER_API_URL || API_URL,
      ...envOverrides,
    },
    stdio: 'pipe',
  });

  child.on('error', (err) => {
    console.error('Failed to start CLI process:', err);
  });

  return child;
}

/**
 * Run a shell command and wait for completion
 */
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  envOverrides?: Record<string, string>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(envOverrides || {}) },
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`Command failed (${command} ${args.join(' ')}): ${stderr}`)
      );
    });
  });
}

/**
 * Poll a URL until it responds successfully or timeout
 */
export async function waitForUrl(
  url: string,
  timeoutMs: number
): Promise<void> {
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
 * Gracefully stop a process, escalating to SIGKILL if needed
 */
export async function stopProcess(
  child: ChildProcess,
  timeoutMs: number
): Promise<void> {
  if (child.exitCode !== null) return;

  let exited = false;
  const exitPromise = new Promise<void>((resolve) => {
    child.once('exit', () => {
      exited = true;
      resolve();
    });
  });

  child.kill('SIGINT');

  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  await Promise.race([exitPromise, timeout]);

  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that build artifacts exist
 */
export function assertArtifacts(rootDir: string): void {
  expect(fs.existsSync(path.join(rootDir, 'dist/web/server/index.js'))).to.be
    .true;
  expect(fs.existsSync(path.join(rootDir, 'dist/web/client/index.html'))).to.be
    .true;
  expect(fs.existsSync(path.join(rootDir, 'dist/events/index.js'))).to.be.true;
}

/**
 * Assert that no VCS metadata (.git, .svn, .hg) exists in directory
 */
export function assertNoVcsMetadata(rootDir: string): void {
  const vcsDirs = ['.git', '.svn', '.hg'];
  for (const vcsDir of vcsDirs) {
    expect(fs.existsSync(path.join(rootDir, vcsDir))).to.be.false;
  }
}

/**
 * Assert that build artifacts have been cleaned
 */
export function assertCleaned(rootDir: string): void {
  expect(fs.existsSync(path.join(rootDir, 'dist'))).to.be.false;
}
