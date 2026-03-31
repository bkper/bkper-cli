import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import sinon from 'sinon';
import { setMockBkper } from '../../helpers/mock-factory.js';
import {
    listBalancesMatrix,
    resolveBalanceType,
} from '../../../../src/commands/balances/list.js';

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
    });

    describe('listBalancesMatrix', function () {
        it('should warn when query looks like a shell-expanded date variable', async function () {
            const consoleWarnStub = sinon.stub(console, 'warn');
            const matrix = [['Account', 'Balance']];
            const builder = {
                type() {
                    return this;
                },
                properties() {
                    return this;
                },
                hiddenProperties() {
                    return this;
                },
                formatValues() {
                    return this;
                },
                formatDates() {
                    return this;
                },
                transposed() {
                    return this;
                },
                raw() {
                    return this;
                },
                expanded() {
                    return this;
                },
                hideNames() {
                    return this;
                },
                build() {
                    return matrix;
                },
            };

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
});
