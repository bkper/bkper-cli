import { expect } from '../../helpers/test-setup.js';
import { resolveBalanceType } from '../../../../src/commands/balances/list.js';

describe('balances list', function () {
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
});
