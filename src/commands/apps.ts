import { App } from 'bkper-js';
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import { getOAuthToken, isLoggedIn } from '../auth/local-auth-service.js';
import { getBkperInstance } from '../mcp/bkper-factory.js';

const PLATFORM_API_URL = 'https://platform.bkper.app';

// =============================================================================
// Types
// =============================================================================

interface DeployOptions {
  dev?: boolean;
  events?: boolean;
}

interface DeployResponse {
  success: boolean;
  url?: string;
  environment?: string;
  type?: string;
  namespace?: string;
  scriptName?: string;
  updatedAt?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface StatusResponse {
  success: boolean;
  appId?: string;
  deployments?: {
    prod: {
      web: DeploymentInfo | null;
      events: DeploymentInfo | null;
    };
    dev: {
      web: DeploymentInfo | null;
      events: DeploymentInfo | null;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface DeploymentInfo {
  url: string;
  scriptName: string;
  namespace: string;
  updatedAt: string;
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
    throw new Error('No entry point found. Expected src/index.ts, src/index.js, index.ts, or index.js');
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
  } catch (err) {
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
    console.error('Error bundling project:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  
  const bundleSizeKB = (bundle.length / 1024).toFixed(2);
  console.log(`Bundle size: ${bundleSizeKB} KB`);
  
  // 4. Get OAuth token
  const token = await getOAuthToken();
  
  // 5. Call Platform API
  const env = options.dev ? 'dev' : 'prod';
  const type = options.events ? 'events' : 'web';
  console.log(`Deploying ${type} handler to ${env}...`);
  
  const response = await fetch(
    `${PLATFORM_API_URL}/api/apps/${config.id}/deploy?env=${env}&type=${type}`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/javascript',
      },
      body: bundle,
    }
  );
  
  const result = await response.json() as DeployResponse;
  
  if (!result.success) {
    console.error(`Error: ${result.error?.message || 'Unknown error'}`);
    if (result.error?.details) {
      console.error('Details:', JSON.stringify(result.error.details, null, 2));
    }
    process.exit(1);
  }
  
  console.log(`\nDeployed ${type} handler to ${env}`);
  console.log(`  URL: ${result.url}${type === 'events' ? '/events' : ''}`);
  console.log(`  Namespace: ${result.namespace}`);
  console.log(`  Script: ${result.scriptName}`);
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
  } catch (err) {
    console.error('Error: bkperapp.yaml or bkperapp.json not found');
    process.exit(1);
  }
  
  if (!config?.id) {
    console.error('Error: App config is missing "id" field');
    process.exit(1);
  }
  
  // 3. Get OAuth token
  const token = await getOAuthToken();
  
  // 4. Call Platform API
  const env = options.dev ? 'dev' : 'prod';
  const type = options.events ? 'events' : 'web';
  console.log(`Removing ${type} handler from ${env}...`);
  
  const response = await fetch(
    `${PLATFORM_API_URL}/api/apps/${config.id}?env=${env}&type=${type}`, 
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  const result = await response.json() as DeployResponse;
  
  if (!result.success) {
    console.error(`Error: ${result.error?.message || 'Unknown error'}`);
    if (result.error?.details) {
      console.error('Details:', JSON.stringify(result.error.details, null, 2));
    }
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
  } catch (err) {
    console.error('Error: bkperapp.yaml or bkperapp.json not found');
    process.exit(1);
  }
  
  if (!config?.id) {
    console.error('Error: App config is missing "id" field');
    process.exit(1);
  }
  
  // 3. Get OAuth token
  const token = await getOAuthToken();
  
  // 4. Call Platform API
  console.log(`Fetching status for ${config.id}...`);
  
  const response = await fetch(
    `${PLATFORM_API_URL}/api/apps/${config.id}`, 
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  const result = await response.json() as StatusResponse;
  
  if (!result.success) {
    console.error(`Error: ${result.error?.message || 'Unknown error'}`);
    if (result.error?.details) {
      console.error('Details:', JSON.stringify(result.error.details, null, 2));
    }
    process.exit(1);
  }
  
  // 5. Display status
  console.log(`\nApp: ${result.appId}\n`);
  
  const deployments = result.deployments;
  if (!deployments) {
    console.log('No deployment information available.');
    return;
  }
  
  console.log('Production:');
  if (deployments.prod.web) {
    console.log(`  Web:    ${deployments.prod.web.url} (deployed ${deployments.prod.web.updatedAt})`);
  } else {
    console.log('  Web:    (not deployed)');
  }
  if (deployments.prod.events) {
    console.log(`  Events: ${deployments.prod.events.url} (deployed ${deployments.prod.events.updatedAt})`);
  } else {
    console.log('  Events: (not deployed)');
  }
  
  console.log('\nDevelopment:');
  if (deployments.dev.web) {
    console.log(`  Web:    ${deployments.dev.web.url} (deployed ${deployments.dev.web.updatedAt})`);
  } else {
    console.log('  Web:    (not deployed)');
  }
  if (deployments.dev.events) {
    console.log(`  Events: ${deployments.dev.events.url} (deployed ${deployments.dev.events.updatedAt})`);
  } else {
    console.log('  Events: (not deployed)');
  }
}
