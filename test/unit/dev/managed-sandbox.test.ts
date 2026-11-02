import { expect } from '../helpers/test-setup.js';
import { isManagedSandbox } from '../../../src/dev/managed-sandbox.js';

describe('managed-sandbox', function () {
    it('is on only when BKPER_MANAGED_SANDBOX is exactly 1', function () {
        expect(isManagedSandbox({ BKPER_MANAGED_SANDBOX: '1' })).to.be.true;
        expect(isManagedSandbox({})).to.be.false;
        expect(isManagedSandbox({ BKPER_MANAGED_SANDBOX: '0' })).to.be.false;
        expect(isManagedSandbox({ BKPER_MANAGED_SANDBOX: 'true' })).to.be.false;
        expect(isManagedSandbox({ BKPER_MANAGED_SANDBOX: '' })).to.be.false;
    });
});
