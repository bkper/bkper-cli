import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { mergeTransactions } = await import('../../../../src/commands/transactions/merge.js');

describe('CLI - transaction merge Command', function () {
    let mergeCalls: Array<[string, string]>;
    let mockBook: {
        mergeTransactions: (tx1: string, tx2: string) => Promise<unknown>;
    };

    beforeEach(function () {
        setupTestEnvironment();
        mergeCalls = [];

        mockBook = {
            mergeTransactions: async (tx1: string, tx2: string) => {
                mergeCalls.push([tx1, tx2]);
                return {
                    json: () => ({
                        id: 'merged-123',
                        remoteIds: [`merged_${tx1}`, `merged_${tx2}`],
                    }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should merge transactions by id using the canonical book merge operation', async function () {
        const merged = await mergeTransactions('book-123', 'tx-1', 'tx-2');

        expect(mergeCalls).to.deep.equal([['tx-1', 'tx-2']]);
        expect(merged.json()).to.deep.equal({
            id: 'merged-123',
            remoteIds: ['merged_tx-1', 'merged_tx-2'],
        });
    });
});
