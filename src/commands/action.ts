import { setupBkper } from '../bkper-factory.js';
import { getFormat } from './cli-helpers.js';
import type { OutputFormat } from '../render/output.js';

/**
 * Options for the action wrapper.
 */
interface ActionOptions {
    /** Skip calling setupBkper() before the action (e.g. for init, build). */
    skipSetup?: boolean;
}

/**
 * Wraps a CLI command action with consistent error handling and Bkper setup.
 *
 * Eliminates the repeated try/catch + setupBkper() + process.exit(1) boilerplate
 * from every command handler.
 *
 * @param label - Human-readable label for error messages (e.g. "listing books")
 * @param fn - The action function. Receives the resolved OutputFormat.
 * @param options - Optional configuration (e.g. skipSetup)
 */
export function withAction(
    label: string,
    fn: (format: OutputFormat) => Promise<void>,
    options?: ActionOptions
): () => Promise<void> {
    return async () => {
        try {
            if (!options?.skipSetup) {
                setupBkper();
            }
            await fn(getFormat());
        } catch (err) {
            console.error(`Error ${label}:`, err);
            process.exit(1);
        }
    };
}
