import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { updateTransaction } = await import('../../../../src/commands/transactions/update.js');

describe('CLI - transaction update Command', function () {
    let mockTransaction: any;
    let mockBook: any;
    let updateCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        updateCalled = false;

        mockTransaction = {
            setDate: function (d: string) {
                this._date = d;
                return this;
            },
            setAmount: function (a: string | number) {
                this._amount = a;
                return this;
            },
            setDescription: function (d: string) {
                this._description = d;
                return this;
            },
            setCreditAccount: function (a: any) {
                this._creditAccount = a;
                return this;
            },
            setDebitAccount: function (a: any) {
                this._debitAccount = a;
                return this;
            },
            setUrls: function (urls: string[]) {
                this._urls = urls;
                return this;
            },
            setChecked: function (checked: boolean) {
                this._checked = checked;
                return this;
            },
            setProperty: function (key: string, value: string) {
                this._properties = this._properties || {};
                this._properties[key] = value;
                return this;
            },
            deleteProperty: function (key: string) {
                this._deletedProperties = this._deletedProperties || [];
                this._deletedProperties.push(key);
                return this;
            },
            update: async function () {
                updateCalled = true;
                return this;
            },
            json: () => ({ id: 'tx-123', amount: '100', date: '2024-01-15' }),
        };

        mockBook = {
            getTransaction: async (id: string) => {
                if (id === 'tx-not-found') return undefined;
                return mockTransaction;
            },
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

    it('should update transaction date', async function () {
        await updateTransaction('book-123', 'tx-123', {
            date: '2024-06-01',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._date).to.equal('2024-06-01');
    });

    it('should update transaction amount', async function () {
        await updateTransaction('book-123', 'tx-123', {
            amount: '500.00',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._amount).to.equal('500.00');
    });

    it('should update transaction description', async function () {
        await updateTransaction('book-123', 'tx-123', {
            description: 'Updated description',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._description).to.equal('Updated description');
    });

    it('should update credit account (from)', async function () {
        await updateTransaction('book-123', 'tx-123', {
            from: 'Cash',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._creditAccount).to.exist;
    });

    it('should update debit account (to)', async function () {
        await updateTransaction('book-123', 'tx-123', {
            to: 'Expenses',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._debitAccount).to.exist;
    });

    it('should update urls', async function () {
        await updateTransaction('book-123', 'tx-123', {
            url: ['https://new-receipt.com'],
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._urls).to.deep.equal(['https://new-receipt.com']);
    });

    it('should update properties', async function () {
        await updateTransaction('book-123', 'tx-123', {
            property: ['category=travel'],
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._properties).to.deep.equal({ category: 'travel' });
    });

    it('should delete properties with empty value', async function () {
        await updateTransaction('book-123', 'tx-123', {
            property: ['old_key='],
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._deletedProperties).to.include('old_key');
    });

    it('should throw when transaction not found', async function () {
        try {
            await updateTransaction('book-123', 'tx-not-found', {
                date: '2024-06-01',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
        }
    });

    it('should only update provided fields', async function () {
        await updateTransaction('book-123', 'tx-123', {
            description: 'Only this',
        });

        expect(updateCalled).to.be.true;
        expect(mockTransaction._description).to.equal('Only this');
        expect(mockTransaction._date).to.be.undefined;
        expect(mockTransaction._amount).to.be.undefined;
    });

    it('should throw when credit account (from) not found', async function () {
        mockBook.getAccount = async () => null;

        try {
            await updateTransaction('book-123', 'tx-123', {
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
            await updateTransaction('book-123', 'tx-123', {
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
            await updateTransaction('book-123', 'tx-123', {
                to: 'Missing',
                property: ['noequalssign'],
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
