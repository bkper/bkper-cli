import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { isNewerVersion, runUpgrade } from '../../../src/upgrade/upgrade.js';
import type { UpgradeDependencies } from '../../../src/upgrade/upgrade.js';
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

        it('should handle large version numbers', function () {
            expect(isNewerVersion('10.20.30', '10.20.31')).to.be.true;
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

    describe('runUpgrade', function () {
        const packageDir = '/usr/local/lib/node_modules/bkper';
        const packageJsonPath = `${packageDir}/package.json`;
        const command = 'npm --prefix "/usr/local" install -g bkper@5.1.0';

        function dependencies(overrides: Partial<UpgradeDependencies> = {}): UpgradeDependencies {
            return {
                version: '5.0.0',
                fetchLatestVersion: sinon.stub().resolves('5.1.0'),
                getSelfUpdatePlan: sinon.stub().returns({
                    kind: 'install',
                    method: 'npm',
                    packageDir,
                    command,
                    packageJsonPath,
                }),
                runInstall: sinon.stub(),
                readInstalledVersion: sinon.stub().returns('5.1.0'),
                log: sinon.stub(),
                error: sinon.stub(),
                ...overrides,
            };
        }

        function output(stub: UpgradeDependencies['log']): string {
            return (stub as sinon.SinonStub).args.map(args => String(args[0])).join('\n');
        }

        it('should install into the running copy and verify the new version', async function () {
            const deps = dependencies();

            const exitCode = await runUpgrade(undefined, deps);

            expect(exitCode).to.equal(0);
            expect((deps.runInstall as sinon.SinonStub).calledOnceWithExactly(command)).to.be.true;
            expect((deps.readInstalledVersion as sinon.SinonStub).calledWith(packageJsonPath)).to
                .be.true;
        });

        it('should refuse to install when the running copy cannot update itself', async function () {
            const deps = dependencies({
                getSelfUpdatePlan: sinon.stub().returns({
                    kind: 'manual',
                    method: 'unknown',
                    packageDir: '/workspace/bkper-cli',
                    instruction: 'Update bkper with the source checkout that provides it.',
                }),
            });

            const exitCode = await runUpgrade(undefined, deps);

            expect(exitCode).to.equal(1);
            expect((deps.runInstall as sinon.SinonStub).called).to.be.false;
            const message = output(deps.error);
            expect(message).to.contain('/workspace/bkper-cli');
            expect(message).to.contain('unknown');
            expect(message).to.contain('Update bkper with the source checkout that provides it.');
            expect(message).to.not.contain('sudo');
        });

        it('should fail when the install landed somewhere else', async function () {
            const deps = dependencies({ readInstalledVersion: sinon.stub().returns('5.0.0') });

            const exitCode = await runUpgrade(undefined, deps);

            expect(exitCode).to.equal(1);
            const message = output(deps.error);
            expect(message).to.contain('installed elsewhere');
            expect(message).to.contain(packageDir);
        });

        it('should fail with the manual command when the install fails', async function () {
            const deps = dependencies({ runInstall: sinon.stub().throws(new Error('EACCES')) });

            const exitCode = await runUpgrade(undefined, deps);

            expect(exitCode).to.equal(1);
            expect(output(deps.error)).to.contain(command);
        });

        it('should do nothing when already on the latest version', async function () {
            const deps = dependencies({ fetchLatestVersion: sinon.stub().resolves('5.0.0') });

            const exitCode = await runUpgrade(undefined, deps);

            expect(exitCode).to.equal(0);
            expect((deps.getSelfUpdatePlan as sinon.SinonStub).called).to.be.false;
        });

        it('should install an explicit target version', async function () {
            const deps = dependencies({ readInstalledVersion: sinon.stub().returns('4.31.3') });

            const exitCode = await runUpgrade('4.31.3', deps);

            expect(exitCode).to.equal(0);
            expect((deps.fetchLatestVersion as sinon.SinonStub).called).to.be.false;
            expect((deps.getSelfUpdatePlan as sinon.SinonStub).calledOnceWithExactly('4.31.3')).to
                .be.true;
        });
    });
});
