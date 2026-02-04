import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { runCleanupStep } from '../../../src/dev/cleanup.js';

describe('cleanup helpers', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should log success when action completes', async function () {
        const logs: string[] = [];
        const logger = {
            info: (message: string) => logs.push(message),
            success: (message: string) => logs.push(message),
            warn: (message: string) => logs.push(message),
            error: (message: string) => logs.push(message),
        };

        await runCleanupStep({
            label: 'sample',
            timeoutMs: 50,
            logger,
            action: async () => Promise.resolve(),
        });

        expect(logs[0]).to.equal('Cleaning up: sample...');
        expect(logs[1]).to.equal('Cleanup done: sample');
    });

    it('should warn on timeout and continue', async function () {
        const logs: string[] = [];
        const logger = {
            info: (message: string) => logs.push(message),
            success: (message: string) => logs.push(message),
            warn: (message: string) => logs.push(message),
            error: (message: string) => logs.push(message),
        };

        await runCleanupStep({
            label: 'slow',
            timeoutMs: 10,
            logger,
            action: async () =>
                new Promise<void>(resolve => {
                    setTimeout(resolve, 50);
                }),
        });

        expect(logs[0]).to.equal('Cleaning up: slow...');
        expect(logs[1]).to.equal('Cleanup timeout: slow after 10ms');
    });
});
