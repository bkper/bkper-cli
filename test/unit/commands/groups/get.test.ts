import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { getGroup } = await import('../../../../src/commands/groups/get.js');

describe('CLI - group get Command', function () {
    let mockBook: any;
    let mockGroup: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockGroup = {
            getId: () => 'grp-123',
            getName: () => 'Assets',
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

    it('should return group by id', async function () {
        const result = await getGroup('book-123', 'grp-123');
        expect(result).to.equal(mockGroup);
    });

    it('should return group by name', async function () {
        const result = await getGroup('book-123', 'Assets');
        expect(result).to.equal(mockGroup);
    });

    it('should throw when group not found', async function () {
        try {
            await getGroup('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Group not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
