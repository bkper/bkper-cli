import {
  expect,
  isPlatformRunning,
  isUserLoggedIn,
  sleep,
  TestConfig,
} from '../setup/deploy-test-helpers.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const CLI_PATH = '/workspace/bkper-cli/lib/cli.js';
const APP_NAME = TestConfig.APP_ID;
const API_URL = process.env.BKPER_API_URL || 'https://api-dev.bkper.app';
const PLATFORM_URL = TestConfig.PLATFORM_URL;

describe('Integration: CLI Full Cycle (init/dev/build/clean)', function () {
  let tempDir: string;
  let appDir: string;
  let devProcess: ReturnType<typeof spawn> | null = null;

  before(async function () {
    this.timeout(20000);

    process.env.BKPER_PLATFORM_URL = TestConfig.PLATFORM_URL;
    process.env.BKPER_API_URL = API_URL;

    if (!fs.existsSync(CLI_PATH)) {
      console.log('\n  Skipping: CLI build not found at /workspace/bkper-cli/lib/cli.js');
      console.log('   Build it with: cd bkper-cli && bun run build\n');
      return this.skip();
    }

    const platformRunning = await isPlatformRunning();
    if (!platformRunning) {
      console.log('\n  Skipping: Platform worker not running at localhost:8790');
      console.log('   Start it with: cd bkper-clients/packages/platform && bun dev\n');
      return this.skip();
    }

    if (!isUserLoggedIn()) {
      console.log('\n  Skipping: User not logged in');
      console.log('   Login with: bkper login\n');
      return this.skip();
    }

    const tempRoot = path.resolve(process.cwd(), 'tmp');
    fs.mkdirSync(tempRoot, { recursive: true });
    tempDir = fs.mkdtempSync(path.join(tempRoot, 'bkper-cli-cycle-'));
    appDir = path.join(tempDir, APP_NAME);
  });

  after(async function () {
    this.timeout(15000);

    if (devProcess) {
      await stopProcess(devProcess, 10000);
      devProcess = null;
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('init', async function () {
    this.timeout(120000);

    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }

    await runCli(['app', 'init', APP_NAME], tempDir);
    expect(fs.existsSync(appDir)).to.be.true;
    assertNoVcsMetadata(appDir);

    await runCommand('bun', ['install'], appDir);
    await runCommand('bun', ['x', 'tsc', '-p', 'tsconfig.json'], path.join(appDir, 'packages/shared'));
  });

  it('dev', async function () {
    this.timeout(120000);

    devProcess = startCli(['app', 'dev'], appDir);
    await waitForUrl('http://localhost:8787/health', 60000);
    await waitForUrl(TestConfig.DEV_EVENTS_URL, 60000);
    await stopProcess(devProcess, 15000);
    devProcess = null;
  });

  it('build', async function () {
    this.timeout(120000);

    await runCli(['app', 'build'], appDir);
    assertArtifacts(appDir);
  });

  it('clean', async function () {
    this.timeout(60000);

    await runCommand('bun', ['run', 'clean'], appDir);
    expect(fs.existsSync(path.join(appDir, 'dist'))).to.be.false;
  });

  it('build after clean', async function () {
    this.timeout(120000);

    await runCommand('bun', ['install'], appDir);
    await runCommand('bun', ['x', 'tsc', '-p', 'tsconfig.json'], path.join(appDir, 'packages/shared'));
    await runCli(['app', 'build'], appDir);
    assertArtifacts(appDir);
  });
});

async function runCli(args: string[], cwd: string): Promise<void> {
  await runCommand('node', [CLI_PATH, ...args], cwd, {
    BKPER_PLATFORM_URL: PLATFORM_URL,
    BKPER_API_URL: API_URL,
  });
}

function startCli(args: string[], cwd: string): ReturnType<typeof spawn> {
  const child = spawn('node', [CLI_PATH, ...args], {
    cwd,
    env: {
      ...process.env,
      BKPER_PLATFORM_URL: TestConfig.PLATFORM_URL,
      BKPER_API_URL: API_URL,
    },
    stdio: 'pipe',
  });

  child.on('error', (err) => {
    console.error('Failed to start CLI dev process:', err);
  });

  return child;
}

async function runCommand(
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
      reject(new Error(`Command failed (${command} ${args.join(' ')}): ${stderr}`));
    });
  });
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
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

async function stopProcess(
  child: ReturnType<typeof spawn>,
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

function assertArtifacts(rootDir: string): void {
  expect(fs.existsSync(path.join(rootDir, 'dist/web/server/index.js'))).to.be.true;
  expect(fs.existsSync(path.join(rootDir, 'dist/web/client/index.html'))).to.be.true;
  expect(fs.existsSync(path.join(rootDir, 'dist/events/index.js'))).to.be.true;
}

function assertNoVcsMetadata(rootDir: string): void {
  const vcsDirs = ['.git', '.svn', '.hg'];
  for (const vcsDir of vcsDirs) {
    expect(fs.existsSync(path.join(rootDir, vcsDir))).to.be.false;
  }
}
