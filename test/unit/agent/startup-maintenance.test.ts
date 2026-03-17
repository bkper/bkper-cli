import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { runStartupMaintenance } from '../../../src/agent/startup-maintenance.js';

describe('agent startup maintenance', function () {
    const originalDisableAutoUpdate = process.env.BKPER_DISABLE_AUTOUPDATE;
    const originalDisableSkillsSync = process.env.BKPER_DISABLE_SKILLS_SYNC;

    afterEach(function () {
        if (originalDisableAutoUpdate === undefined) {
            delete process.env.BKPER_DISABLE_AUTOUPDATE;
        } else {
            process.env.BKPER_DISABLE_AUTOUPDATE = originalDisableAutoUpdate;
        }

        if (originalDisableSkillsSync === undefined) {
            delete process.env.BKPER_DISABLE_SKILLS_SYNC;
        } else {
            process.env.BKPER_DISABLE_SKILLS_SYNC = originalDisableSkillsSync;
        }
    });

    it('should trigger auto-upgrade and skills sync by default', function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;
        delete process.env.BKPER_DISABLE_SKILLS_SYNC;

        const autoUpgrade = sinon.stub().resolves();
        const updateSkills = sinon.stub().resolves();

        runStartupMaintenance({
            autoUpgrade,
            updateSkills,
        });

        expect(autoUpgrade.calledOnce).to.be.true;
        expect(updateSkills.calledOnce).to.be.true;
    });

    it('should skip auto-upgrade when disabled', function () {
        process.env.BKPER_DISABLE_AUTOUPDATE = '1';
        delete process.env.BKPER_DISABLE_SKILLS_SYNC;

        const autoUpgrade = sinon.stub().resolves();
        const updateSkills = sinon.stub().resolves();

        runStartupMaintenance({
            autoUpgrade,
            updateSkills,
        });

        expect(autoUpgrade.called).to.be.false;
        expect(updateSkills.calledOnce).to.be.true;
    });

    it('should skip skills sync when disabled', function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;
        process.env.BKPER_DISABLE_SKILLS_SYNC = '1';

        const autoUpgrade = sinon.stub().resolves();
        const updateSkills = sinon.stub().resolves();

        runStartupMaintenance({
            autoUpgrade,
            updateSkills,
        });

        expect(autoUpgrade.calledOnce).to.be.true;
        expect(updateSkills.called).to.be.false;
    });
});
