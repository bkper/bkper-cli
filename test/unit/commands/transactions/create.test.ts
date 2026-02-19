import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';
import { Transaction } from 'bkper-js';

// Import after mock setup
const { createTransaction } = await import('../../../../src/commands/transactions/create.js');

describe('CLI - transaction create Command', function () {
    let mockBook: any;
    let originalCreate: typeof Transaction.prototype.create;

    before(function () {
        originalCreate = Transaction.prototype.create;
    });

    afterEach(function () {
        Transaction.prototype.create = originalCreate;
    });

    beforeEach(function () {
        setupTestEnvironment();

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
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should create a transaction with description only', async function () {
        let createCalled = false;
        Transaction.prototype.create = async function () {
            createCalled = true;
            return this;
        };

        const result = await createTransaction('book-123', {
            description: 'Office supplies',
        });

        expect(createCalled).to.be.true;
        expect(result).to.exist;
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
