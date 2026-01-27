import { App, BkperError } from "bkper-js";
import { getBkperInstance } from "../../bkper-factory.js";
import { createConfiguredApp } from "./config.js";
import type { SyncResult } from "./types.js";

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

/**
 * Syncs app configuration to Bkper (creates if new, updates if exists).
 *
 * @returns Sync result with app id and action taken
 */
export async function syncApp(): Promise<SyncResult> {
    const bkper = getBkperInstance();
    const app = createConfiguredApp();
    const appId = app.getId();

    if (!appId) {
        throw new Error('App config is missing "id" field');
    }

    // Check if app exists
    let exists = false;
    try {
        await bkper.getApp(appId);
        exists = true;
    } catch (err) {
        if (err instanceof BkperError && err.code === 404) {
            // App doesn't exist, will create
            console.log("App does not exist, will create");
            exists = false;
        } else {
            throw err;
        }
    }

    if (exists) {
        await app.update();
        return { id: appId, action: "updated" };
    } else {
        await app.create();
        return { id: appId, action: "created" };
    }
}
