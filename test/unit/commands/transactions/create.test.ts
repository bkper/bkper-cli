import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { createTransaction } = await import('../../../../src/commands/transactions/create.js');

describe('CLI - transaction create Command', function () {
    let mockBook: any;
    let createdTransactions: any[];

    beforeEach(function () {
        setupTestEnvironment();
        createdTransactions = [];

        mockBook = {
            json: () => ({ id: 'book-123', name: 'Test Book' }),
            getDecimalSeparator: () => 'DOT',
            getFractionDigits: () => 2,
            getDatePattern: () => 'yyyy-MM-dd',
            getTimeZone: () => 'UTC',
            getTimeZoneOffset: () => 0,
            getAccount: async (nameOrId: string) => ({
                getId: () => `${nameOrId}-id`,
                getName: () => nameOrId,
                json: () => ({ id: `${nameOrId}-id`, name: nameOrId }),
            }),
            batchCreateTransactions: async (txs: any[]) => {
                createdTransactions = txs;
                return txs;
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should create a transaction with required fields only', async function () {
        const result = await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '100.50',
        });

        expect(result).to.exist;
        expect(createdTransactions).to.have.length(1);
    });

    it('should create a transaction with all optional fields', async function () {
        await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '250.00',
            description: 'Office supplies',
            from: 'Cash',
            to: 'Expenses',
            url: ['https://receipt.example.com'],
            remoteId: ['ext-123'],
            property: ['category=office', 'vendor=Staples'],
        });

        expect(createdTransactions).to.have.length(1);
    });

    it('should handle property deletion with empty value', async function () {
        await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '100',
            property: ['old_key='],
        });

        expect(createdTransactions).to.have.length(1);
    });

    it('should handle multiple urls', async function () {
        await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '100',
            url: ['https://a.com', 'https://b.com'],
        });

        expect(createdTransactions).to.have.length(1);
    });

    it('should handle multiple remote ids', async function () {
        await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '100',
            remoteId: ['remote-1', 'remote-2'],
        });

        expect(createdTransactions).to.have.length(1);
    });

    it('should not set credit account when from is not provided', async function () {
        let getAccountCalled = false;
        mockBook.getAccount = async () => {
            getAccountCalled = true;
            return null;
        };

        await createTransaction('book-123', {
            date: '2024-01-15',
            amount: '100',
        });

        expect(getAccountCalled).to.be.false;
    });

    it('should throw when credit account (from) not found', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'NonExistent',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Credit account (--from) not found: NonExistent'
            );
        }
    });

    it('should report all not-found accounts at once', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'BadSource',
                to: 'BadDest',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('BadSource');
            expect(ve.errors[1]).to.include('BadDest');
        }
    });

    it('should report not-found accounts and invalid properties together', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'Missing',
                property: ['invalidprop'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('Missing');
            expect(ve.errors[1]).to.include('Invalid property format');
        }
    });
});
