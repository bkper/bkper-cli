import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { updateAccount } = await import('../../../../src/commands/accounts/update.js');

describe('CLI - account update Command', function () {
    let mockAccount: any;
    let mockBook: any;
    let updateCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        updateCalled = false;

        mockAccount = {
            setName: function (n: string) {
                this._name = n;
                return this;
            },
            setType: function (t: string) {
                this._type = t;
                return this;
            },
            setArchived: function (a: boolean) {
                this._archived = a;
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
            json: () => ({ id: 'acc-123', name: 'Checking' }),
        };

        mockBook = {
            getAccount: async (idOrName: string) => {
                if (idOrName === 'not-found') return undefined;
                return mockAccount;
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should update account name', async function () {
        await updateAccount('book-123', 'acc-123', {
            name: 'Savings',
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._name).to.equal('Savings');
    });

    it('should update account type', async function () {
        await updateAccount('book-123', 'acc-123', {
            type: 'LIABILITY',
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._type).to.equal('LIABILITY');
    });

    it('should update account archived status', async function () {
        await updateAccount('book-123', 'acc-123', {
            archived: true,
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._archived).to.be.true;
    });

    it('should set properties', async function () {
        await updateAccount('book-123', 'acc-123', {
            property: ['color=blue'],
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._properties).to.deep.equal({ color: 'blue' });
    });

    it('should delete properties with empty value', async function () {
        await updateAccount('book-123', 'acc-123', {
            property: ['old_key='],
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._deletedProperties).to.include('old_key');
    });

    it('should only update provided fields', async function () {
        await updateAccount('book-123', 'acc-123', {
            name: 'Only this',
        });

        expect(updateCalled).to.be.true;
        expect(mockAccount._name).to.equal('Only this');
        expect(mockAccount._type).to.be.undefined;
        expect(mockAccount._archived).to.be.undefined;
    });

    it('should throw when account not found', async function () {
        try {
            await updateAccount('book-123', 'not-found', {
                name: 'New Name',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Account not found');
            expect((err as Error).message).to.include('not-found');
        }
    });

    it('should throw ValidationError for invalid property format', async function () {
        try {
            await updateAccount('book-123', 'acc-123', {
                property: ['noequalssign'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include('Invalid property format');
        }
    });

    it('should report multiple invalid properties at once', async function () {
        try {
            await updateAccount('book-123', 'acc-123', {
                property: ['bad1', 'bad2'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('Invalid property format');
            expect(ve.errors[1]).to.include('Invalid property format');
        }
    });
});
