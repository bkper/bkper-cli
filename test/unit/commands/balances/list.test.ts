import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import sinon from 'sinon';
import { Command } from 'commander';
import { setMockBkper } from '../../helpers/mock-factory.js';
import {
    listBalancesMatrix,
    resolveBalanceType,
} from '../../../../src/commands/balances/list.js';
import { registerBalanceCommands } from '../../../../src/commands/balances/register.js';

function createBuilder(matrix: unknown[][]) {
    return {
        type: sinon.stub().returnsThis(),
        trial: sinon.stub().returnsThis(),
        period: sinon.stub().returnsThis(),
        properties: sinon.stub().returnsThis(),
        hiddenProperties: sinon.stub().returnsThis(),
        formatValues: sinon.stub().returnsThis(),
        formatDates: sinon.stub().returnsThis(),
        transposed: sinon.stub().returnsThis(),
        raw: sinon.stub().returnsThis(),
        expanded: sinon.stub().returnsThis(),
        hideNames: sinon.stub().returnsThis(),
        build: sinon.stub().returns(matrix),
    };
}

describe('balances list', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    describe('resolveBalanceType', function () {
        it('should return PERIOD when query contains after:', function () {
            expect(resolveBalanceType('group:"Assets" after:2023-01-01')).to.equal('PERIOD');
        });

        it('should return CUMULATIVE when query has no after:', function () {
            expect(resolveBalanceType('group:"Total Equity" before:$m')).to.equal('CUMULATIVE');
        });

        it('should return CUMULATIVE for simple group query', function () {
            expect(resolveBalanceType('group:"Assets"')).to.equal('CUMULATIVE');
        });

        it('should return PERIOD when after: is present with before:', function () {
            expect(resolveBalanceType('group:"Revenue" after:$y before:$m')).to.equal('PERIOD');
        });

        it('should return CUMULATIVE for empty query', function () {
            expect(resolveBalanceType('')).to.equal('CUMULATIVE');
        });

        it('should return TOTAL for a trial balance', function () {
            expect(resolveBalanceType("group:'Assets' before:2026-01-01", true)).to.equal('TOTAL');
        });
    });

    describe('listBalancesMatrix', function () {
        it('should build a cumulative trial balance with debit and credit columns', async function () {
            const matrix = [
                ['Cash', 100, 0],
                ['Payables', 0, 100],
            ];
            const builder = createBuilder(matrix);

            setMockBkper({
                setConfig: () => {},
                getBook: async () => ({
                    json: () => ({ id: 'book-123' }),
                    getBalancesReport: async () => ({
                        getBalances: async () => [],
                        getBalancesContainers: () => [],
                        createDataTable: () => builder,
                    }),
                }),
            });

            const result = await listBalancesMatrix('book-123', {
                query: "group:'Balance Sheet' before:2026-01-01",
                trial: true,
            });

            expect(builder.type.calledOnceWithExactly('TOTAL')).to.equal(true);
            expect(builder.trial.calledOnceWithExactly(true)).to.equal(true);
            expect(builder.period.calledOnceWithExactly(false)).to.equal(true);
            expect(result).to.deep.equal([
                ['Name', 'Debit', 'Credit'],
                ...matrix,
            ]);
        });

        it('should build a period trial balance with aligned CSV metadata', async function () {
            const matrix = [
                ['name', 'balance', 'code'],
                ['Sales', 0, 250, '4000'],
                ['Bank', 250, 0, '1000'],
            ];
            const builder = createBuilder(matrix);

            setMockBkper({
                setConfig: () => {},
                getBook: async () => ({
                    json: () => ({ id: 'book-123' }),
                    getBalancesReport: async () => ({
                        getBalances: async () => [],
                        getBalancesContainers: () => [],
                        createDataTable: () => builder,
                    }),
                }),
            });

            const result = await listBalancesMatrix('book-123', {
                query: "group:'Profit and Loss' after:2025-01-01 before:2026-01-01",
                trial: true,
                format: 'csv',
            });

            expect(builder.period.calledOnceWithExactly(true)).to.equal(true);
            expect(result).to.deep.equal([
                ['Name', 'Debit', 'Credit', 'code'],
                ...matrix.slice(1),
            ]);
        });

        it('should warn when query looks like a shell-expanded date variable', async function () {
            const consoleWarnStub = sinon.stub(console, 'warn');
            const matrix = [['Account', 'Balance']];
            const builder = createBuilder(matrix);

            setMockBkper({
                setConfig: () => {},
                getBook: async () => ({
                    json: () => ({ id: 'book-123' }),
                    getBalancesReport: async () => ({
                        getBalances: async () => [],
                        getBalancesContainers: () => [],
                        createDataTable: () => builder,
                    }),
                }),
            });

            try {
                const result = await listBalancesMatrix('book-123', {
                    query: 'after:-3 before:+1',
                });
                expect(result).to.equal(matrix);
            } finally {
                consoleWarnStub.restore();
            }

            expect(consoleWarnStub.calledOnce).to.equal(true);
            expect(consoleWarnStub.firstCall.args[0]).to.contain(
                'suspicious date fragment(s): after:-3, before:+1'
            );
        });
    });

    describe('command registration', function () {
        it('should expose trial balance output on balance list', function () {
            const program = new Command();
            registerBalanceCommands(program);
            const balance = program.commands.find(command => command.name() === 'balance');
            const list = balance?.commands.find(command => command.name() === 'list');

            expect(list?.options.some(option => option.long === '--trial')).to.equal(true);
        });
    });
});
