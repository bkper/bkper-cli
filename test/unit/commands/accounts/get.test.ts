import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { getAccount } = await import('../../../../src/commands/accounts/get.js');

describe('CLI - account get Command', function () {
    let mockBook: any;
    let mockAccount: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockAccount = {
            getId: () => 'acc-123',
            getName: () => 'Checking',
            json: () => ({ id: 'acc-123', name: 'Checking', type: 'ASSET' }),
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

    it('should forward the account identifier to the book', async function () {
        let requested: string | undefined;
        mockBook.getAccount = async (idOrName: string) => {
            requested = idOrName;
            return mockAccount;
        };

        await getAccount('book-123', 'acc-123');
        expect(requested).to.equal('acc-123');
    });

    it('should throw when account not found', async function () {
        try {
            await getAccount('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Account not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
