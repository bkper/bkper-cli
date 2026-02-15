import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { batchCreateGroups } = await import('../../../../src/commands/groups/batch-create.js');

describe('CLI - group batch-create Command', function () {
    let mockBook: any;
    let batchCalls: any[][];
    let consoleOutput: string[];

    beforeEach(function () {
        setupTestEnvironment();
        batchCalls = [];
        consoleOutput = [];

        const originalLog = console.log;
        console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };

        mockBook = {
            getGroup: async (name: string) => ({
                getId: () => `${name}-id`,
                getName: () => name,
            }),
            batchCreateGroups: async (groups: any[]) => {
                batchCalls.push(groups);
                return groups.map((g: any, idx: number) => ({
                    json: () => ({ id: `grp-${idx}`, name: g.getName() }),
                }));
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        afterEach(() => {
            console.log = originalLog;
        });
    });

    it('should create a single group', async function () {
        await batchCreateGroups('book-123', [{ name: 'Assets' }]);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0]).to.have.length(1);
        expect(batchCalls[0][0].getName()).to.equal('Assets');
    });

    it('should output NDJSON for each created group', async function () {
        await batchCreateGroups('book-123', [{ name: 'Assets' }, { name: 'Liabilities' }]);

        expect(consoleOutput).to.have.length(2);
        const parsed0 = JSON.parse(consoleOutput[0]);
        const parsed1 = JSON.parse(consoleOutput[1]);
        expect(parsed0).to.have.property('name');
        expect(parsed1).to.have.property('name');
    });

    it('should chunk items at 100', async function () {
        const items = Array.from({ length: 150 }, (_, i) => ({ name: `Group-${i}` }));
        await batchCreateGroups('book-123', items);

        expect(batchCalls).to.have.length(2);
        expect(batchCalls[0]).to.have.length(100);
        expect(batchCalls[1]).to.have.length(50);
    });

    it('should set properties from stdin fields', async function () {
        await batchCreateGroups('book-123', [{ name: 'Test', color: 'red' }]);

        expect(batchCalls).to.have.length(1);
        const group = batchCalls[0][0];
        expect(group.getProperty('color')).to.equal('red');
    });

    it('should apply property overrides from CLI flags', async function () {
        await batchCreateGroups('book-123', [{ name: 'Test' }], ['region=EU']);

        expect(batchCalls).to.have.length(1);
        const group = batchCalls[0][0];
        expect(group.getProperty('region')).to.equal('EU');
    });

    it('should set hidden status when provided', async function () {
        await batchCreateGroups('book-123', [{ name: 'Internal', hidden: 'true' }]);

        expect(batchCalls).to.have.length(1);
        const group = batchCalls[0][0];
        expect(group.isHidden()).to.be.true;
    });
});
