import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { createGroup } = await import('../../../../src/commands/groups/create.js');

describe('CLI - group create Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockBook = {
            getGroup: async (nameOrId: string) => ({
                getId: () => `${nameOrId}-id`,
                getName: () => nameOrId,
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should throw when parent group is not found', async function () {
        mockBook.getGroup = async () => null;

        try {
            await createGroup('book-123', {
                name: 'Child Group',
                parent: 'NonExistentParent',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Parent group not found: NonExistentParent'
            );
        }
    });

    it('should report parent not found and invalid properties together', async function () {
        mockBook.getGroup = async () => null;

        try {
            await createGroup('book-123', {
                name: 'Child Group',
                parent: 'BadParent',
                property: ['noequalssign', 'alsobad'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(3);
            expect(ve.errors[0]).to.include('Invalid property format');
            expect(ve.errors[1]).to.include('Invalid property format');
            expect(ve.errors[2]).to.include('BadParent');
        }
    });
});
