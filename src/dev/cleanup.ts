export interface CleanupStepOptions {
    label: string;
    timeoutMs: number;
    action: () => Promise<void>;
}

/**
 * Runs a cleanup step with timeout. Throws on timeout or failure.
 */
export async function runCleanupStep(options: CleanupStepOptions): Promise<void> {
    const { label, timeoutMs, action } = options;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} cleanup timed out`));
        }, timeoutMs);
    });

    try {
        await Promise.race([action(), timeoutPromise]);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`${label}: ${message}`);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
