import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { uninstallApp } = await import('../../../../src/commands/apps/uninstall.js');

describe('CLI - app uninstall Command', function () {
    let removeCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        removeCalled = false;

        setMockBkper({
            setConfig: () => {},
            getBook: async () => ({
                json: () => ({ id: 'book-123', name: 'Test Book' }),
                getIntegrations: async () => [
                    {
                        getId: () => 'int-1',
                        getAgentId: () => 'app-123',
                        getName: () => 'Test App',
                        remove: async () => {
                            removeCalled = true;
                            return {
                                getId: () => 'int-1',
                                getAgentId: () => 'app-123',
                                json: () => ({ id: 'int-1', agentId: 'app-123' }),
                            };
                        },
                        json: () => ({ id: 'int-1', agentId: 'app-123', name: 'Test App' }),
                    },
                    {
                        getId: () => 'int-2',
                        getAgentId: () => 'app-456',
                        getName: () => 'Other App',
                        remove: async () => ({ json: () => ({}) }),
                        json: () => ({ id: 'int-2', agentId: 'app-456', name: 'Other App' }),
                    },
                ],
            }),
        });
    });

    it('should uninstall the correct app from a book', async function () {
        await uninstallApp('book-123', 'app-123');
        expect(removeCalled).to.be.true;
    });

    it('should throw when app not found in book', async function () {
        try {
            await uninstallApp('book-123', 'app-nonexistent');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('not found');
        }
    });
});
