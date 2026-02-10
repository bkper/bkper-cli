import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { installApp } = await import('../../../../src/commands/apps/install.js');

describe('CLI - app install Command', function () {
    let createdIntegration: any;

    beforeEach(function () {
        setupTestEnvironment();
        createdIntegration = undefined;

        setMockBkper({
            setConfig: () => {},
            getBook: async () => ({
                json: () => ({ id: 'book-123', name: 'Test Book' }),
                createIntegration: async (integration: any) => {
                    createdIntegration = integration;
                    return {
                        getId: () => 'int-1',
                        getAgentId: () => 'app-123',
                        getName: () => 'Test App',
                        json: () => ({ id: 'int-1', agentId: 'app-123', name: 'Test App' }),
                    };
                },
            }),
        });
    });

    it('should install an app into a book', async function () {
        const result = await installApp('book-123', 'app-123');
        expect(result).to.exist;
        expect(createdIntegration).to.exist;
    });
});
