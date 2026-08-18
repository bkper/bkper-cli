import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { copyBook } = await import('../../../../src/commands/books/copy.js');

describe('CLI - book copy Command', function () {
    let requestedBookId: string | undefined;
    let copyArguments: [string, boolean, number | undefined] | undefined;

    const copiedBook = {
        getId: () => 'book-copy',
        json: () => ({ id: 'book-copy', name: 'Copied Book' }),
    };

    beforeEach(function () {
        setupTestEnvironment();
        requestedBookId = undefined;
        copyArguments = undefined;

        setMockBkper({
            setConfig: () => {},
            getBook: async (bookId: string) => {
                requestedBookId = bookId;
                return {
                    copy: async (
                        name: string,
                        copyTransactions: boolean,
                        fromDate?: number
                    ) => {
                        copyArguments = [name, copyTransactions, fromDate];
                        return copiedBook;
                    },
                };
            },
        });
    });

    it('should copy book structure without transactions by default', async function () {
        const result = await copyBook('book-source', { name: 'Copied Book' });

        expect(result).to.equal(copiedBook);
        expect(requestedBookId).to.equal('book-source');
        expect(copyArguments).to.deep.equal(['Copied Book', false, undefined]);
    });

    it('should copy transactions from the requested date', async function () {
        await copyBook('book-source', {
            name: 'Copied Book',
            transactions: true,
            fromDate: '2025-01-15',
        });

        expect(copyArguments).to.deep.equal(['Copied Book', true, 20250115]);
    });

    it('should require --transactions when --from-date is provided', async function () {
        try {
            await copyBook('book-source', {
                name: 'Copied Book',
                fromDate: '2025-01-15',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.equal('--from-date requires --transactions');
            expect(requestedBookId).to.equal(undefined);
        }
    });

    it('should reject an invalid --from-date', async function () {
        try {
            await copyBook('book-source', {
                name: 'Copied Book',
                transactions: true,
                fromDate: '2025-02-30',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.equal(
                'Invalid --from-date: 2025-02-30. Expected a valid date in YYYY-MM-DD format'
            );
            expect(requestedBookId).to.equal(undefined);
        }
    });
});
