import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { updateGroup } = await import('../../../../src/commands/groups/update.js');

describe('CLI - group update Command', function () {
    let mockGroup: any;
    let mockBook: any;
    let updateCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        updateCalled = false;

        mockGroup = {
            setName: function (n: string) {
                this._name = n;
                return this;
            },
            setHidden: function (h: boolean) {
                this._hidden = h;
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
            json: () => ({ id: 'grp-123', name: 'Assets' }),
        };

        mockBook = {
            getGroup: async (idOrName: string) => {
                if (idOrName === 'not-found') return undefined;
                return mockGroup;
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should update group name', async function () {
        await updateGroup('book-123', 'grp-123', {
            name: 'Liabilities',
        });

        expect(updateCalled).to.be.true;
        expect(mockGroup._name).to.equal('Liabilities');
    });

    it('should update group hidden status', async function () {
        await updateGroup('book-123', 'grp-123', {
            hidden: true,
        });

        expect(updateCalled).to.be.true;
        expect(mockGroup._hidden).to.be.true;
    });

    it('should set properties', async function () {
        await updateGroup('book-123', 'grp-123', {
            property: ['category=finance'],
        });

        expect(updateCalled).to.be.true;
        expect(mockGroup._properties).to.deep.equal({ category: 'finance' });
    });

    it('should delete properties with empty value', async function () {
        await updateGroup('book-123', 'grp-123', {
            property: ['old_key='],
        });

        expect(updateCalled).to.be.true;
        expect(mockGroup._deletedProperties).to.include('old_key');
    });

    it('should only update provided fields', async function () {
        await updateGroup('book-123', 'grp-123', {
            name: 'Only this',
        });

        expect(updateCalled).to.be.true;
        expect(mockGroup._name).to.equal('Only this');
        expect(mockGroup._hidden).to.be.undefined;
    });

    it('should throw when group not found', async function () {
        try {
            await updateGroup('book-123', 'not-found', {
                name: 'New Name',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Group not found');
            expect((err as Error).message).to.include('not-found');
        }
    });

    it('should throw ValidationError for invalid property format', async function () {
        try {
            await updateGroup('book-123', 'grp-123', {
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
            await updateGroup('book-123', 'grp-123', {
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
