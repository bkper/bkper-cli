import { App } from 'bkper-js';
import * as esbuild from 'esbuild';
import fs from 'fs';
import * as YAML from 'yaml';
import { getOAuthToken, isLoggedIn } from '../auth/local-auth-service.js';
import { getBkperInstance } from '../mcp/bkper-factory.js';
import { createPlatformClient } from '../platform/client.js';
import type { components } from '../platform/types.js';

// =============================================================================
// Types (from OpenAPI)
// =============================================================================

type DeployResult = components['schemas']['DeployResult'];
type UndeployResult = components['schemas']['UndeployResult'];
type AppStatus = components['schemas']['AppStatus'];
type ErrorResponse = components['schemas']['ErrorResponse'];

interface DeployOptions {
  dev?: boolean;
  events?: boolean;
}

// =============================================================================
// Existing Functions
// =============================================================================

/**
 * Lists all apps the authenticated user has access to.
 *
 * @returns Array of app data objects
 */
export async function listApps(): Promise<bkper.App[]> {
  const bkper = getBkperInstance();
  const apps = await bkper.getApps();
  return apps.map(app => app.json());
}

/**
 * Loads app configuration from bkperapp.json or bkperapp.yaml in current directory.
 *
 * @returns App configuration object
 * @throws Error if no config file is found
 */
function loadAppConfig(): bkper.App {
  if (fs.existsSync('./bkperapp.json')) {
    return JSON.parse(fs.readFileSync('./bkperapp.json', 'utf8'));
  } else if (fs.existsSync('./bkperapp.yaml')) {
    return YAML.parse(fs.readFileSync('./bkperapp.yaml', 'utf8'));
  } else {
    throw new Error('bkperapp.json or bkperapp.yaml not found');
  }
}

/**
 * Loads README.md content if it exists.
 *
 * @returns README content or undefined
 */
function loadReadme(): string | undefined {
  if (fs.existsSync('./README.md')) {
    return fs.readFileSync('./README.md', 'utf8');
  }
  return undefined;
}

/**
 * Creates an App instance configured from bkperapp.yaml and environment variables.
 *
 * @returns Configured App instance
 */
function createConfiguredApp(): App {
  const json = loadAppConfig();
  const app = new App(json);

  const readme = loadReadme();
  if (readme) {
    app.setReadme(readme);
  }

  return app;
}

/**
 * Creates a new app from the configuration in the current directory.
 *
 * @returns Created App instance
 */
export async function createApp(): Promise<App> {
  const app = createConfiguredApp();
  const createdApp = await app.create();
  return createdApp;
}

/**
 * Updates an existing app from the configuration in the current directory.
 *
 * @returns Updated App instance
 */
export async function updateApp(): Promise<App> {
  const app = createConfiguredApp();
  const updatedApp = await app.update();
  return updatedApp;
}

// =============================================================================
// Deploy Functions
// =============================================================================

/**
 * Finds the entry point for bundling.
 * Checks for common entry point patterns.
 */
function findEntryPoint(): string | null {
  const candidates = [
    './src/index.ts',
    './src/index.js',
    './index.ts',
    './index.js',
  ];

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
 * @returns Bundled JavaScript code as a Buffer
 */
async function bundleProject(): Promise<Buffer> {
  const entryPoint = findEntryPoint();
  if (!entryPoint) {
    throw new Error(
      'No entry point found. Expected src/index.ts, src/index.js, index.ts, or index.js'
    );
  }

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    minify: true,
    write: false,
    external: [],
    conditions: ['workerd', 'worker', 'browser'],
  });

  if (result.errors.length > 0) {
    const errorMessages = result.errors.map(e => e.text).join('\n');
    throw new Error(`Bundle failed:\n${errorMessages}`);
  }

  if (!result.outputFiles || result.outputFiles.length === 0) {
    throw new Error('Bundle produced no output');
  }

  return Buffer.from(result.outputFiles[0].contents);
}

/**
 * Handles error response from Platform API
 */
function handleError(error: ErrorResponse): never {
  console.error(`Error: ${error.error.message}`);
  if (error.error.details) {
    console.error('Details:', JSON.stringify(error.error.details, null, 2));
  }
  process.exit(1);
}

/**
 * Deploys the app to the Bkper Platform.
 *
 * @param options Deploy options (dev, events)
 */
export async function deployApp(options: DeployOptions = {}): Promise<void> {
  // 1. Check if logged in
  if (!isLoggedIn()) {
    console.error('Error: You must be logged in. Run: bkper login');
    process.exit(1);
  }

  // 2. Load bkperapp.yaml/json to get app ID
  let config: bkper.App;
  try {
    config = loadAppConfig();
  } catch {
    console.error('Error: bkperapp.yaml or bkperapp.json not found');
    process.exit(1);
  }

  if (!config?.id) {
    console.error('Error: App config is missing "id" field');
    process.exit(1);
  }

  // 3. Bundle the project
  console.log('Bundling project...');
  let bundle: Buffer;
  try {
    bundle = await bundleProject();
  } catch (err) {
    console.error(
      'Error bundling project:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  const bundleSizeKB = (bundle.length / 1024).toFixed(2);
  console.log(`Bundle size: ${bundleSizeKB} KB`);

  // 4. Get OAuth token and create client
  const token = await getOAuthToken();
  const client = createPlatformClient(token);

  // 5. Call Platform API
  const env = options.dev ? 'dev' : 'prod';
  const type = options.events ? 'events' : 'web';
  console.log(`Deploying ${type} handler to ${env}...`);

  const { data, error } = await client.POST('/api/apps/{appId}/deploy', {
    params: {
      path: { appId: config.id },
      query: { env, type },
    },
    body: bundle as unknown as string,
    bodySerializer: body => body as unknown as globalThis.ReadableStream,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  });

  if (error) {
    handleError(error);
  }

  if (!data) {
    console.error('Error: Unexpected empty response');
    process.exit(1);
  }

  console.log(`\nDeployed ${type} handler to ${env}`);
  console.log(`  URL: ${data.url}${type === 'events' ? '/events' : ''}`);
  console.log(`  Namespace: ${data.namespace}`);
  console.log(`  Script: ${data.scriptName}`);
}

/**
 * Removes the app from the Bkper Platform.
 *
 * @param options Undeploy options (dev, events)
 */
export async function undeployApp(options: DeployOptions = {}): Promise<void> {
  // 1. Check if logged in
  if (!isLoggedIn()) {
    console.error('Error: You must be logged in. Run: bkper login');
    process.exit(1);
  }

  // 2. Load bkperapp.yaml/json to get app ID
  let config: bkper.App;
  try {
    config = loadAppConfig();
  } catch {
    console.error('Error: bkperapp.yaml or bkperapp.json not found');
    process.exit(1);
  }

  if (!config?.id) {
    console.error('Error: App config is missing "id" field');
    process.exit(1);
  }

  // 3. Get OAuth token and create client
  const token = await getOAuthToken();
  const client = createPlatformClient(token);

  // 4. Call Platform API
  const env = options.dev ? 'dev' : 'prod';
  const type = options.events ? 'events' : 'web';
  console.log(`Removing ${type} handler from ${env}...`);

  const { data, error } = await client.DELETE('/api/apps/{appId}', {
    params: {
      path: { appId: config.id },
      query: { env, type },
    },
  });

  if (error) {
    handleError(error);
  }

  if (!data) {
    console.error('Error: Unexpected empty response');
    process.exit(1);
  }

  console.log(`\nRemoved ${type} handler from ${env}`);
}

/**
 * Shows the deployment status for the app.
 */
export async function statusApp(): Promise<void> {
  // 1. Check if logged in
  if (!isLoggedIn()) {
    console.error('Error: You must be logged in. Run: bkper login');
    process.exit(1);
  }

  // 2. Load bkperapp.yaml/json to get app ID
  let config: bkper.App;
  try {
    config = loadAppConfig();
  } catch {
    console.error('Error: bkperapp.yaml or bkperapp.json not found');
    process.exit(1);
  }

  if (!config?.id) {
    console.error('Error: App config is missing "id" field');
    process.exit(1);
  }

  // 3. Get OAuth token and create client
  const token = await getOAuthToken();
  const client = createPlatformClient(token);

  // 4. Call Platform API
  console.log(`Fetching status for ${config.id}...`);

  const { data, error } = await client.GET('/api/apps/{appId}', {
    params: {
      path: { appId: config.id },
    },
  });

  if (error) {
    handleError(error);
  }

  if (!data) {
    console.error('Error: Unexpected empty response');
    process.exit(1);
  }

  // 5. Display status
  console.log(`\nApp: ${data.appId}\n`);

  console.log('Production:');
  if (data.prod.web?.deployed) {
    console.log(
      `  Web:    ${data.prod.web.url} (deployed ${data.prod.web.updatedAt})`
    );
  } else {
    console.log('  Web:    (not deployed)');
  }
  if (data.prod.events?.deployed) {
    console.log(
      `  Events: ${data.prod.events.url} (deployed ${data.prod.events.updatedAt})`
    );
  } else {
    console.log('  Events: (not deployed)');
  }

  console.log('\nDevelopment:');
  if (data.dev.web?.deployed) {
    console.log(
      `  Web:    ${data.dev.web.url} (deployed ${data.dev.web.updatedAt})`
    );
  } else {
    console.log('  Web:    (not deployed)');
  }
  if (data.dev.events?.deployed) {
    console.log(
      `  Events: ${data.dev.events.url} (deployed ${data.dev.events.updatedAt})`
    );
  } else {
    console.log('  Events: (not deployed)');
  }
}
