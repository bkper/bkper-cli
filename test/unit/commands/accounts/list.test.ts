import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { listAccounts } = await import('../../../../src/commands/accounts/list.js');

describe('CLI - account list Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should return all accounts', async function () {
        const mockAccounts = [
            {
                getId: () => 'acc-1',
                getName: () => 'Checking',
                json: () => ({ id: 'acc-1', name: 'Checking' }),
            },
            {
                getId: () => 'acc-2',
                getName: () => 'Savings',
                json: () => ({ id: 'acc-2', name: 'Savings' }),
            },
        ];

        mockBook = {
            getAccounts: async () => mockAccounts,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listAccounts('book-123');
        expect(result).to.have.length(2);
        expect(result[0].getName()).to.equal('Checking');
        expect(result[1].getName()).to.equal('Savings');
    });

    it('should return empty array when no accounts exist', async function () {
        mockBook = {
            getAccounts: async () => null,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listAccounts('book-123');
        expect(result).to.deep.equal([]);
    });

    it('should return empty array for undefined accounts', async function () {
        mockBook = {
            getAccounts: async () => undefined,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listAccounts('book-123');
        expect(result).to.deep.equal([]);
    });
});
