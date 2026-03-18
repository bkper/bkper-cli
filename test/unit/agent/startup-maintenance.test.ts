import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { runStartupMaintenance } from '../../../src/agent/startup-maintenance.js';

describe('agent startup maintenance', function () {
    const originalDisableAutoUpdate = process.env.BKPER_DISABLE_AUTOUPDATE;

    afterEach(function () {
        if (originalDisableAutoUpdate === undefined) {
            delete process.env.BKPER_DISABLE_AUTOUPDATE;
        } else {
            process.env.BKPER_DISABLE_AUTOUPDATE = originalDisableAutoUpdate;
        }
    });

    it('should trigger auto-upgrade by default', function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;

        const autoUpgrade = sinon.stub().resolves();

        runStartupMaintenance({
            autoUpgrade,
        });

        expect(autoUpgrade.calledOnce).to.be.true;
    });

    it('should skip auto-upgrade when disabled', function () {
        process.env.BKPER_DISABLE_AUTOUPDATE = '1';

        const autoUpgrade = sinon.stub().resolves();

        runStartupMaintenance({
            autoUpgrade,
        });

        expect(autoUpgrade.called).to.be.false;
    });
});
