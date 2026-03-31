import { expect } from '../helpers/test-setup.js';

import {
    findSuspiciousDateQueryFragments,
    getSuspiciousDateVariableWarning,
} from '../../../src/utils/query-warning.js';

describe('query warning utils', function () {
    describe('findSuspiciousDateQueryFragments', function () {
        it('should detect empty date operators', function () {
            expect(findSuspiciousDateQueryFragments('on:')).to.deep.equal(['on:']);
            expect(findSuspiciousDateQueryFragments("account:'Cash' after:")).to.deep.equal([
                'after:',
            ]);
        });

        it('should detect signed offsets without date variables', function () {
            expect(findSuspiciousDateQueryFragments('after:-3 before:+1')).to.deep.equal([
                'after:-3',
                'before:+1',
            ]);
        });

        it('should return no fragments for valid date queries', function () {
            expect(findSuspiciousDateQueryFragments('on:2025')).to.deep.equal([]);
            expect(
                findSuspiciousDateQueryFragments('after:2025-01-01 before:2026-01-01')
            ).to.deep.equal([]);
            expect(findSuspiciousDateQueryFragments('after:$m-3 before:$m+1')).to.deep.equal(
                []
            );
        });

        it('should ignore suspicious-looking text inside quoted phrases', function () {
            expect(findSuspiciousDateQueryFragments('NOT "after:-3"')).to.deep.equal([]);
            expect(findSuspiciousDateQueryFragments("account:'before:+1'"))
                .to.deep.equal([]);
        });
    });

    describe('getSuspiciousDateVariableWarning', function () {
        it('should return a warning message with the suspicious fragments', function () {
            const warning = getSuspiciousDateVariableWarning('after:-3 before:+1');

            expect(warning).to.contain('after:-3, before:+1');
            expect(warning).to.contain('$d, $m, or $y');
        });

        it('should return undefined for non-suspicious queries', function () {
            expect(getSuspiciousDateVariableWarning('on:2025')).to.equal(undefined);
        });
    });
});
