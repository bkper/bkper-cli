import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import {
    autoUpgrade,
    getAvailableUpgrade,
    isNewerVersion,
} from '../../../src/upgrade/upgrade.js';
import { fetchLatestVersion } from '../../../src/upgrade/installation.js';

describe('upgrade', function () {
    describe('isNewerVersion', function () {
        it('should return true when latest patch is higher', function () {
            expect(isNewerVersion('4.3.0', '4.3.1')).to.be.true;
        });

        it('should return true when latest minor is higher', function () {
            expect(isNewerVersion('4.3.0', '4.4.0')).to.be.true;
        });

        it('should return true when latest major is higher', function () {
            expect(isNewerVersion('4.3.0', '5.0.0')).to.be.true;
        });

        it('should return false when versions are equal', function () {
            expect(isNewerVersion('4.3.0', '4.3.0')).to.be.false;
        });

        it('should return false when current is newer', function () {
            expect(isNewerVersion('4.3.1', '4.3.0')).to.be.false;
        });

        it('should return false when current minor is higher', function () {
            expect(isNewerVersion('4.4.0', '4.3.9')).to.be.false;
        });

        it('should return false when current major is higher', function () {
            expect(isNewerVersion('5.0.0', '4.99.99')).to.be.false;
        });

        it('should handle single-digit versions', function () {
            expect(isNewerVersion('1.0.0', '2.0.0')).to.be.true;
        });

        it('should handle large version numbers', function () {
            expect(isNewerVersion('10.20.30', '10.20.31')).to.be.true;
        });
    });

    describe('getAvailableUpgrade', function () {
        it('should return available upgrade when latest version is newer', async function () {
            const fetchLatestVersion = sinon.stub().resolves('5.0.0');
            const detectMethod = sinon.stub().resolves('npm');

            const upgrade = await getAvailableUpgrade({
                version: '4.9.0',
                fetchLatestVersion,
                detectMethod,
            });

            expect(upgrade).to.deep.equal({
                current: '4.9.0',
                latest: '5.0.0',
                method: 'npm',
            });
        });

        it('should return null when current version is already latest', async function () {
            const fetchLatestVersion = sinon.stub().resolves('5.0.0');
            const detectMethod = sinon.stub().resolves('npm');

            const upgrade = await getAvailableUpgrade({
                version: '5.0.0',
                fetchLatestVersion,
                detectMethod,
            });

            expect(upgrade).to.be.null;
            expect(detectMethod.called).to.be.false;
        });
    });

    describe('fetchLatestVersion', function () {
        const originalLatestVersion = process.env.BKPER_AUTOUPDATE_LATEST_VERSION;

        afterEach(function () {
            if (originalLatestVersion === undefined) {
                delete process.env.BKPER_AUTOUPDATE_LATEST_VERSION;
            } else {
                process.env.BKPER_AUTOUPDATE_LATEST_VERSION = originalLatestVersion;
            }
        });

        it('should use latest version override when configured', async function () {
            process.env.BKPER_AUTOUPDATE_LATEST_VERSION = '999.0.0';

            const latestVersion = await fetchLatestVersion();
            expect(latestVersion).to.equal('999.0.0');
        });
    });

    describe('autoUpgrade', function () {
        it('should start detached upgrade when latest version is newer and method is known', async function () {
            const fetchLatestVersion = sinon.stub().resolves('5.0.0');
            const detectMethod = sinon.stub().resolves('npm');
            const startUpgrade = sinon.stub();
            const writeStderr = sinon.stub();

            await autoUpgrade({
                version: '4.9.0',
                fetchLatestVersion,
                detectMethod,
                startUpgrade,
                writeStderr,
            });

            expect(startUpgrade.calledOnceWithExactly('npm', '5.0.0')).to.be.true;
            expect(writeStderr.calledOnce).to.be.true;
            expect(writeStderr.firstCall.args[0]).to.contain('update started in background');
        });

        it('should print manual hint when installation method is unknown', async function () {
            const fetchLatestVersion = sinon.stub().resolves('5.0.0');
            const detectMethod = sinon.stub().resolves('unknown');
            const startUpgrade = sinon.stub();
            const writeStderr = sinon.stub();

            await autoUpgrade({
                version: '4.9.0',
                fetchLatestVersion,
                detectMethod,
                startUpgrade,
                writeStderr,
            });

            expect(startUpgrade.called).to.be.false;
            expect(writeStderr.calledOnce).to.be.true;
            expect(writeStderr.firstCall.args[0]).to.contain('Upgrade manually');
        });
    });
});
