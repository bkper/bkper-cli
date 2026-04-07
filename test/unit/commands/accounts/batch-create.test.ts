import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { batchCreateAccounts } = await import('../../../../src/commands/accounts/batch-create.js');

describe('CLI - account batch-create Command', function () {
    let mockBook: any;
    let batchCalls: any[][];
    let consoleOutput: string[];
    let groupLookups: string[];
    let originalLog: typeof console.log;

    beforeEach(function () {
        setupTestEnvironment();
        batchCalls = [];
        consoleOutput = [];
        groupLookups = [];

        originalLog = console.log;
        console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };

        mockBook = {
            getGroup: async (name: string) => {
                groupLookups.push(name);
                return {
                    id: `${name}-id`,
                    name,
                    getId: () => `${name}-id`,
                    getName: () => name,
                };
            },
            batchCreateAccounts: async (accounts: any[]) => {
                batchCalls.push(accounts);
                return accounts.map((a: any, idx: number) => ({
                    json: () => ({ id: `acc-${idx}`, name: a.getName() }),
                }));
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    afterEach(function () {
        console.log = originalLog;
    });

    it('should create a single account', async function () {
        await batchCreateAccounts('book-123', [{ name: 'Checking' }]);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0]).to.have.length(1);
        expect(batchCalls[0][0].getName()).to.equal('Checking');
    });

    it('should output flat JSON array for created accounts', async function () {
        await batchCreateAccounts('book-123', [{ name: 'Checking' }, { name: 'Savings' }]);

        expect(consoleOutput).to.have.length(1);
        const parsed = JSON.parse(consoleOutput[0]);
        expect(parsed).to.be.an('array').with.length(2);
        expect(parsed[0]).to.have.property('name');
        expect(parsed[1]).to.have.property('name');
    });

    it('should send all items in a single batch call', async function () {
        const items = Array.from({ length: 150 }, (_, i) => ({ name: `Account-${i}` }));
        await batchCreateAccounts('book-123', items);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0]).to.have.length(150);
    });

    it('should set properties from stdin payload', async function () {
        await batchCreateAccounts('book-123', [{ name: 'Test', properties: { color: 'blue' } }]);

        expect(batchCalls).to.have.length(1);
        const account = batchCalls[0][0];
        expect(account.getProperty('color')).to.equal('blue');
    });

    it('should apply property overrides from CLI flags', async function () {
        await batchCreateAccounts('book-123', [{ name: 'Test' }], ['region=LATAM']);

        expect(batchCalls).to.have.length(1);
        const account = batchCalls[0][0];
        expect(account.getProperty('region')).to.equal('LATAM');
    });

    it('should set account type when provided', async function () {
        await batchCreateAccounts('book-123', [{ name: 'Revenue', type: 'INCOMING' }]);

        expect(batchCalls).to.have.length(1);
        const account = batchCalls[0][0];
        expect(account.getType()).to.equal('INCOMING');
    });

    it('should resolve group names from stdin payload before batching', async function () {
        await batchCreateAccounts('book-123', [
            {
                name: 'Cash',
                groups: [{ name: 'Current Assets' }],
            },
        ]);

        expect(groupLookups).to.deep.equal(['Current Assets']);
        expect(batchCalls).to.have.length(1);
        const account = batchCalls[0][0];
        const payload = account.json();
        expect(payload.groups).to.have.length(1);
        expect(payload.groups[0].id).to.equal('Current Assets-id');
        expect(payload.groups[0].name).to.equal('Current Assets');
    });
});
