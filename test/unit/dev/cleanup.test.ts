import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { runCleanupStep } from '../../../src/dev/cleanup.js';

describe('cleanup helpers', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should resolve when action completes', async function () {
        await runCleanupStep({
            label: 'sample',
            timeoutMs: 50,
            action: async () => Promise.resolve(),
        });
        // No error thrown = success
    });

    it('should throw on timeout', async function () {
        let error: Error | null = null;
        try {
            await runCleanupStep({
                label: 'slow',
                timeoutMs: 10,
                action: async () =>
                    new Promise<void>(resolve => {
                        setTimeout(resolve, 100);
                    }),
            });
        } catch (err) {
            error = err as Error;
        }

        expect(error).to.not.be.null;
        expect(error!.message).to.include('slow');
        expect(error!.message).to.include('timed out');
    });

    it('should throw on action failure', async function () {
        let error: Error | null = null;
        try {
            await runCleanupStep({
                label: 'failing',
                timeoutMs: 100,
                action: async () => {
                    throw new Error('action failed');
                },
            });
        } catch (err) {
            error = err as Error;
        }

        expect(error).to.not.be.null;
        expect(error!.message).to.include('failing');
        expect(error!.message).to.include('action failed');
    });
});
