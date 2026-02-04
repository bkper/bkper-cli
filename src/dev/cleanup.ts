export interface CleanupLogger {
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export interface CleanupStepOptions {
    label: string;
    timeoutMs: number;
    action: () => Promise<void>;
    logger?: CleanupLogger;
}

export async function runCleanupStep(options: CleanupStepOptions): Promise<void> {
    const { label, timeoutMs, action, logger } = options;
    logger?.info(`Cleaning up: ${label}...`);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('timeout'));
        }, timeoutMs);
    });

    try {
        await Promise.race([action(), timeoutPromise]);
        logger?.info(`Cleanup done: ${label}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'timeout') {
            logger?.warn(`Cleanup timeout: ${label} after ${timeoutMs}ms`);
        } else {
            logger?.warn(`Cleanup failed: ${label} (${message})`);
        }
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
