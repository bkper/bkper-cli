import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { createAccount } = await import('../../../../src/commands/accounts/create.js');

describe('CLI - account create Command', function () {
    let mockBook: any;
    let createdAccount: any;

    beforeEach(function () {
        setupTestEnvironment();

        createdAccount = {
            setName: function (n: string) {
                this._name = n;
                return this;
            },
            setType: function (t: string) {
                this._type = t;
                return this;
            },
            setProperty: function (k: string, v: string) {
                this._properties = this._properties || {};
                this._properties[k] = v;
                return this;
            },
            deleteProperty: function (k: string) {
                return this;
            },
            addGroup: function (g: any) {
                this._groups = this._groups || [];
                this._groups.push(g);
                return this;
            },
            create: async function () {
                return this;
            },
            json: () => ({ id: 'acc-123', name: 'Test Account' }),
        };

        mockBook = {
            getGroup: async (nameOrId: string) => ({
                getId: () => `${nameOrId}-id`,
                getName: () => nameOrId,
            }),
            getAccount: async () => null,
        };

        // Patch Account constructor via mock
        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should throw when a specified group is not found', async function () {
        mockBook.getGroup = async () => null;

        try {
            await createAccount('book-123', {
                name: 'Test',
                groups: ['NonExistent'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include('Group not found: NonExistent');
        }
    });

    it('should report all not-found groups at once', async function () {
        mockBook.getGroup = async () => null;

        try {
            await createAccount('book-123', {
                name: 'Test',
                groups: ['Group1', 'Group2', 'Group3'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(3);
            expect(ve.errors[0]).to.include('Group1');
            expect(ve.errors[1]).to.include('Group2');
            expect(ve.errors[2]).to.include('Group3');
        }
    });

    it('should report not-found groups and invalid properties together', async function () {
        mockBook.getGroup = async () => null;

        try {
            await createAccount('book-123', {
                name: 'Test',
                groups: ['BadGroup'],
                property: ['noequalssign'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('Invalid property format');
            expect(ve.errors[1]).to.include('BadGroup');
        }
    });
});
