import { App } from 'bkper-js';
import fs from 'fs';
import * as YAML from 'yaml';
import { getBkperInstance } from '../mcp/bkper-factory.js';

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
