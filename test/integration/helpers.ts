import { expect } from 'chai';
import { isLoggedIn } from '../../src/auth/local-auth-service.js';

export { expect };

/**
 * Test configuration for integration tests
 */
export const TestConfig = {
  APP_TEMPLATE_PATH: '../bkper-app-template',
  APP_ID: 'my-app',
  PLATFORM_URL: process.env.BKPER_PLATFORM_URL || 'http://localhost:8790',
  FALLBACK_PLATFORM_URL: 'https://platform-dev.bkper.app',
  DEV_WEB_URL: 'https://my-app-dev.bkper.app',
  DEV_EVENTS_URL: 'https://my-app-dev.bkper.app/events',
  HTTP_TIMEOUT: 10000,
  DEPLOY_TIMEOUT: 60000,
  POLL_INTERVAL: 2000,
  POLL_MAX_ATTEMPTS: 30,
} as const;

/**
 * Determine which platform URL to use (localhost:8790 or fallback to dev)
 */
export async function determinePlatformUrl(): Promise<string | null> {
  // First try localhost
  try {
    const response = await fetch(`${TestConfig.PLATFORM_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return TestConfig.PLATFORM_URL;
    }
  } catch {
    // Localhost not available, try fallback
  }

  // Try fallback URL
  try {
    const response = await fetch(`${TestConfig.FALLBACK_PLATFORM_URL}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      return TestConfig.FALLBACK_PLATFORM_URL;
    }
  } catch {
    // Fallback also not available
  }

  return null;
}

/**
 * Check if platform worker is accessible at localhost:8790
 */
export async function isPlatformRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${TestConfig.PLATFORM_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if user is logged in to CLI
 */
export function isUserLoggedIn(): boolean {
  return isLoggedIn();
}

interface DeployOptions {
  dev?: boolean;
  events?: boolean;
  sync?: boolean;
}

interface UndeployOptions {
  dev?: boolean;
  events?: boolean;
  deleteData?: boolean;
  force?: boolean;
}

/**
 * Execute deploy command - mocks process.exit to prevent test runner exit
 */
export async function runDeploy(options: DeployOptions): Promise<void> {
  const { deployApp } = await import('../../src/commands/apps/index.js');

  const originalExit = process.exit;
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  }) as never;

  try {
    await deployApp(options);
  } catch (e: unknown) {
    const error = e as Error;
    if (!error.message?.includes('process.exit')) throw e;
  } finally {
    process.exit = originalExit;
  }

  if (exitCode !== undefined && exitCode !== 0) {
    throw new Error(`Deploy failed with exit code ${exitCode}`);
  }
}

/**
 * Execute undeploy command - mocks process.exit
 */
export async function runUndeploy(options: UndeployOptions): Promise<void> {
  const { undeployApp } = await import('../../src/commands/apps/index.js');

  const originalExit = process.exit;
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  }) as never;

  try {
    await undeployApp(options);
  } catch (e: unknown) {
    const error = e as Error;
    if (!error.message?.includes('process.exit')) throw e;
  } finally {
    process.exit = originalExit;
  }

  if (exitCode !== undefined && exitCode !== 0) {
    throw new Error(`Undeploy failed with exit code ${exitCode}`);
  }
}

interface FetchWorkerOptions {
  method?: string;
  body?: unknown;
  isEvents?: boolean;
}

/**
 * Make HTTP request to deployed worker
 */
export async function fetchWorker(
  urlPath: string,
  options?: FetchWorkerOptions
): Promise<Response> {
  const baseUrl = options?.isEvents
    ? TestConfig.DEV_EVENTS_URL
    : TestConfig.DEV_WEB_URL;

  // Handle empty path (just hit the base URL)
  let url: string;
  if (urlPath === '' || urlPath === '/') {
    url =
      options?.isEvents && urlPath === '' ? baseUrl : `${baseUrl}${urlPath}`;
  } else {
    url = urlPath.startsWith('/')
      ? `${baseUrl}${urlPath}`
      : `${baseUrl}/${urlPath}`;
  }

  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    signal: AbortSignal.timeout(TestConfig.HTTP_TIMEOUT),
  };

  if (options?.body) {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify(options.body);
  }

  return fetch(url, fetchOptions);
}

/**
 * Wait for worker to be ready by polling health endpoint
 */
export async function waitForWorkerReady(
  healthPath: string,
  isEvents: boolean = false
): Promise<boolean> {
  for (let i = 0; i < TestConfig.POLL_MAX_ATTEMPTS; i++) {
    try {
      const response = await fetchWorker(healthPath, { isEvents });
      if (response.ok) return true;
    } catch {
      // Worker not ready yet
    }
    await sleep(TestConfig.POLL_INTERVAL);
  }
  return false;
}

/**
 * Write value to KV via events worker test endpoint
 */
export async function writeToKV(key: string, value: string): Promise<void> {
  const response = await fetchWorker('/test/kv', {
    method: 'POST',
    body: { key, value },
    isEvents: true,
  });

  if (!response.ok) {
    throw new Error(`Failed to write to KV: ${response.status}`);
  }

  const data = (await response.json()) as { success?: boolean };
  if (!data.success) {
    throw new Error(`KV write failed: ${JSON.stringify(data)}`);
  }
}

/**
 * Read value from KV via web worker test endpoint
 */
export async function readFromKV(key: string): Promise<string | null> {
  const response = await fetchWorker(`/test/kv/${key}`);

  if (!response.ok) {
    throw new Error(`Failed to read from KV: ${response.status}`);
  }

  const data = (await response.json()) as {
    found?: boolean;
    value?: string;
  };
  return data.found ? data.value ?? null : null;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate unique test key to avoid conflicts
 */
export function generateTestKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
