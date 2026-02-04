import { getBkperInstance } from '../bkper-factory.js';

export interface AppWebhookUpdater {
    setWebhookUrlDev(url: string | null): AppWebhookUpdater;
    update(): Promise<void>;
}

export interface AppUpdater {
    getApp(appId: string): Promise<AppWebhookUpdater>;
}

function isAppWebhookUpdater(value: unknown): value is AppWebhookUpdater {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return typeof record.setWebhookUrlDev === 'function' && typeof record.update === 'function';
}

export async function updateWebhookUrlDev(
    appId: string,
    webhookUrlDev: string | null,
    updater?: AppUpdater
): Promise<void> {
    const bkperInstance = updater ?? getBkperInstance();
    const app = await bkperInstance.getApp(appId);
    if (!isAppWebhookUpdater(app)) {
        throw new Error('App instance does not support webhookUrlDev updates');
    }
    await app.setWebhookUrlDev(webhookUrlDev ?? null).update();
}
