import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { mergeTransactions } = await import('../../../../src/commands/transactions/merge.js');

describe('CLI - transaction merge Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockBook = {
            getTransaction: async (id: string) => {
                if (id.startsWith('not-found')) return undefined;
                return {
                    getId: () => id,
                    isPosted: () => false,
                    getAmount: () => 100,
                    getDescription: () => 'test',
                    getDate: () => '2024-01-15',
                    getCreditAccountName: () => 'Cash',
                    getDebitAccountName: () => 'Expenses',
                    getUrls: () => [],
                    getFiles: () => [],
                    getProperties: () => ({}),
                    json: () => ({ id }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should report both not-found transactions at once', async function () {
        try {
            await mergeTransactions('book-123', 'not-found-1', 'not-found-2');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('not-found-1');
            expect(ve.errors[1]).to.include('not-found-2');
        }
    });

    it('should report single not-found transaction', async function () {
        try {
            await mergeTransactions('book-123', 'tx-valid', 'not-found-2');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(1);
            expect(ve.errors[0]).to.include('not-found-2');
        }
    });
});
