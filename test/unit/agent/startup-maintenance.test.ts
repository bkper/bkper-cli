import {expect} from '../helpers/test-setup.js';
import sinon from 'sinon';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    runStartupMaintenance,
    startAgentUpdateCheck,
} from '../../../src/agent/startup-maintenance.js';
import {getUpdateNotice, writeUpdateState} from '../../../src/upgrade/update-check.js';
import {VERSION} from '../../../src/upgrade/installation.js';

describe('agent startup maintenance', function () {
    const originalDisableAutoUpdate = process.env.BKPER_DISABLE_AUTOUPDATE;
    const originalCi = process.env.CI;

    beforeEach(function () {
        delete process.env.BKPER_DISABLE_AUTOUPDATE;
        delete process.env.CI;
    });

    afterEach(function () {
        for (const [key, value] of [
            ['BKPER_DISABLE_AUTOUPDATE', originalDisableAutoUpdate],
            ['CI', originalCi],
        ] as const) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });

    it('should start the background update check', async function () {
        const readNotice = sinon.stub().returns(undefined);
        const startUpdateCheck = sinon.stub().returns(true);
        const notify = sinon.stub();

        await runStartupMaintenance({notify}, {readNotice, startUpdateCheck});

        expect(startUpdateCheck.calledOnce).to.be.true;
        expect(notify.called).to.be.false;
    });

    it('should check on every start instead of once a day', async function () {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-startup-maintenance-'));
        try {
            const cachePath = path.join(tempDir, 'copy.json');
            const spawnWorker = sinon.stub();
            // Checked an hour ago: plain commands wait a day, the agent checks again.
            const now = Date.now();
            writeUpdateState({lastAttemptedAt: now - 60 * 60 * 1000}, cachePath);

            await runStartupMaintenance(
                {notify: sinon.stub()},
                {
                    readNotice: () => undefined,
                    startUpdateCheck: () =>
                        startAgentUpdateCheck({cachePath, now, env: {}, spawnWorker}),
                }
            );

            expect(spawnWorker.calledOnce).to.be.true;
        } finally {
            fs.rmSync(tempDir, {recursive: true, force: true});
        }
    });

    it('should ask for a restart when a newer version was installed', async function () {
        const readNotice = sinon.stub().returns({kind: 'installed', current: '5.0.0', latest: '5.1.0'});
        const startUpdateCheck = sinon.stub().returns(false);
        const notify = sinon.stub();

        await runStartupMaintenance({notify}, {readNotice, startUpdateCheck});

        expect(
            notify.calledOnceWithExactly(
                'bkper 5.1.0 installed (current 5.0.0). Restart to use it.',
                'info'
            )
        ).to.be.true;
    });

    it('should request a restart instead of warning when a cached failure has been resolved', async function () {
        const startUpdateCheck = sinon.stub().returns(false);
        const notify = sinon.stub();

        await runStartupMaintenance(
            {notify},
            {
                readNotice: () => getUpdateNotice(
                    {latestVersion: VERSION, install: {version: VERSION, status: 'failed'}},
                    '0.0.0'
                ),
                startUpdateCheck,
            }
        );

        expect(notify.calledOnce).to.be.true;
        expect(notify.firstCall.args[1]).to.equal('info');
        expect(startUpdateCheck.calledOnce).to.be.true;
    });

    it('should warn with the manual instruction when the copy cannot update itself', async function () {
        const readNotice = sinon.stub().returns({
            kind: 'manual',
            current: '5.0.0',
            latest: '5.1.0',
            instruction: 'Run: bkper upgrade',
        });
        const startUpdateCheck = sinon.stub().returns(false);
        const notify = sinon.stub();

        await runStartupMaintenance({notify}, {readNotice, startUpdateCheck});

        expect(
            notify.calledOnceWithExactly(
                'bkper 5.1.0 available (current 5.0.0). Run: bkper upgrade',
                'warning'
            )
        ).to.be.true;
    });

    it('should skip everything when disabled', async function () {
        process.env.BKPER_DISABLE_AUTOUPDATE = '1';
        const readNotice = sinon.stub();
        const startUpdateCheck = sinon.stub();
        const notify = sinon.stub();

        await runStartupMaintenance({notify}, {readNotice, startUpdateCheck});

        expect(readNotice.called).to.be.false;
        expect(startUpdateCheck.called).to.be.false;
        expect(notify.called).to.be.false;
    });

    it('should never throw', async function () {
        const readNotice = sinon.stub().throws(new Error('boom'));
        const startUpdateCheck = sinon.stub();
        const notify = sinon.stub();

        await runStartupMaintenance({notify}, {readNotice, startUpdateCheck});

        expect(notify.called).to.be.false;
    });
});
