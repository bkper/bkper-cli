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

    it('should start background upgrade and notify when update is available', async function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;

        const getAvailableUpgrade = sinon.stub().resolves({
            current: '4.9.0',
            latest: '5.0.0',
            method: 'npm',
        });
        const startDetachedUpgrade = sinon.stub();
        const notify = sinon.stub();

        await runStartupMaintenance(
            {
                notify,
            },
            {
                getAvailableUpgrade,
                startDetachedUpgrade,
            }
        );

        expect(startDetachedUpgrade.calledOnceWithExactly('npm', '5.0.0')).to.be.true;
        expect(
            notify.calledOnceWithExactly(
                'Updating bkper to 5.0.0 in background. Restart later to use it.',
                'info'
            )
        ).to.be.true;
    });

    it('should show manual upgrade hint when installation method is unknown', async function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;

        const getAvailableUpgrade = sinon.stub().resolves({
            current: '4.9.0',
            latest: '5.0.0',
            method: 'unknown',
        });
        const startDetachedUpgrade = sinon.stub();
        const notify = sinon.stub();

        await runStartupMaintenance(
            {
                notify,
            },
            {
                getAvailableUpgrade,
                startDetachedUpgrade,
            }
        );

        expect(startDetachedUpgrade.called).to.be.false;
        expect(
            notify.calledOnceWithExactly(
                'bkper 5.0.0 available. Run bkper upgrade after exit.',
                'warning'
            )
        ).to.be.true;
    });

    it('should show manual upgrade hint when background upgrade cannot be started', async function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;

        const getAvailableUpgrade = sinon.stub().resolves({
            current: '4.9.0',
            latest: '5.0.0',
            method: 'npm',
        });
        const startDetachedUpgrade = sinon.stub().throws(new Error('spawn failed'));
        const notify = sinon.stub();

        await runStartupMaintenance(
            {
                notify,
            },
            {
                getAvailableUpgrade,
                startDetachedUpgrade,
            }
        );

        expect(
            notify.calledOnceWithExactly(
                'bkper 5.0.0 available. Run bkper upgrade after exit.',
                'warning'
            )
        ).to.be.true;
    });

    it('should skip auto-upgrade when disabled', async function () {
        process.env.BKPER_DISABLE_AUTOUPDATE = '1';

        const getAvailableUpgrade = sinon.stub().resolves(null);
        const startDetachedUpgrade = sinon.stub();
        const notify = sinon.stub();

        await runStartupMaintenance(
            {
                notify,
            },
            {
                getAvailableUpgrade,
                startDetachedUpgrade,
            }
        );

        expect(getAvailableUpgrade.called).to.be.false;
        expect(startDetachedUpgrade.called).to.be.false;
        expect(notify.called).to.be.false;
    });
});
