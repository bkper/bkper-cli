import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sinon from 'sinon';
import {expect} from '../helpers/test-setup.js';
import {
    AGENT_CHECK_INTERVAL_MS,
    CHECK_INTERVAL_MS,
    formatUpdateNotice,
    getUpdateCachePath,
    getUpdateNotice,
    isUpdateCheckDisabled,
    maybeStartUpdateCheck,
    readUpdateState,
    runUpdateWorker,
    writeUpdateState,
} from '../../../src/upgrade/update-check.js';
import type {UpdateWorkerDependencies} from '../../../src/upgrade/update-check.js';
import {VERSION} from '../../../src/upgrade/installation.js';
import type {SelfUpdatePlan} from '../../../src/upgrade/installation.js';

const INSTALL_PLAN: SelfUpdatePlan = {
    kind: 'install',
    method: 'npm',
    packageDir: '/usr/local/lib/node_modules/bkper',
    command: 'npm --prefix "/usr/local" install -g bkper@5.1.0',
    packageJsonPath: '/usr/local/lib/node_modules/bkper/package.json',
};

const MANUAL_PLAN: SelfUpdatePlan = {
    kind: 'manual',
    method: 'npm',
    packageDir: '/home/u/project/node_modules/bkper',
    instruction: 'bkper at /home/u/project/node_modules/bkper is not a global npm install.',
};

describe('update check', function () {
    let tempDir: string;
    let cachePath: string;

    beforeEach(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-update-check-'));
        cachePath = path.join(tempDir, 'update-check', 'copy.json');
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    describe('getUpdateCachePath', function () {
        it('should keep one cache per installed copy inside the config dir', function () {
            const npmCopy = getUpdateCachePath('/usr/local/lib/node_modules/bkper', tempDir);
            const bunCopy = getUpdateCachePath('/home/u/.bun/install/global/node_modules/bkper', tempDir);

            expect(npmCopy.startsWith(path.join(tempDir, 'update-check'))).to.be.true;
            expect(npmCopy).to.equal(getUpdateCachePath('/usr/local/lib/node_modules/bkper', tempDir));
            expect(npmCopy).to.not.equal(bunCopy);
        });
    });

    describe('isUpdateCheckDisabled', function () {
        it('should be disabled by BKPER_DISABLE_AUTOUPDATE or CI', function () {
            expect(isUpdateCheckDisabled({})).to.be.false;
            expect(isUpdateCheckDisabled({BKPER_DISABLE_AUTOUPDATE: '1'})).to.be.true;
            expect(isUpdateCheckDisabled({CI: 'true'})).to.be.true;
            expect(isUpdateCheckDisabled({CI: 'false'})).to.be.false;
            expect(isUpdateCheckDisabled({CI: '0'})).to.be.false;
        });
    });

    describe('maybeStartUpdateCheck', function () {
        it('should start the worker and record the attempt when the cache is empty', function () {
            const spawnWorker = sinon.stub();

            const started = maybeStartUpdateCheck({cachePath, now: 1000, env: {}, spawnWorker});

            expect(started).to.be.true;
            expect(spawnWorker.calledOnce).to.be.true;
            expect(readUpdateState(cachePath).lastAttemptedAt).to.equal(1000);
        });

        it('should not start the worker again within 24 hours', function () {
            const spawnWorker = sinon.stub();
            writeUpdateState({lastAttemptedAt: 1000}, cachePath);

            expect(
                maybeStartUpdateCheck({
                    cachePath,
                    now: 1000 + CHECK_INTERVAL_MS - 1,
                    env: {},
                    spawnWorker,
                })
            ).to.be.false;
            expect(
                maybeStartUpdateCheck({
                    cachePath,
                    now: 1000 + CHECK_INTERVAL_MS,
                    env: {},
                    spawnWorker,
                })
            ).to.be.true;
            expect(spawnWorker.calledOnce).to.be.true;
        });

        it('should honor a custom interval', function () {
            const spawnWorker = sinon.stub();
            writeUpdateState({lastAttemptedAt: 1000}, cachePath);

            expect(
                maybeStartUpdateCheck({
                    cachePath,
                    now: 1000 + AGENT_CHECK_INTERVAL_MS - 1,
                    intervalMs: AGENT_CHECK_INTERVAL_MS,
                    env: {},
                    spawnWorker,
                })
            ).to.be.false;
            expect(
                maybeStartUpdateCheck({
                    cachePath,
                    now: 1000 + AGENT_CHECK_INTERVAL_MS,
                    intervalMs: AGENT_CHECK_INTERVAL_MS,
                    env: {},
                    spawnWorker,
                })
            ).to.be.true;
            expect(spawnWorker.calledOnce).to.be.true;
        });

        it('should not start the worker while another process holds the lock', function () {
            const spawnWorker = sinon.stub();
            fs.mkdirSync(path.dirname(cachePath), {recursive: true});
            fs.writeFileSync(`${cachePath}.lock`, '');

            const started = maybeStartUpdateCheck({cachePath, now: 1000, env: {}, spawnWorker});

            expect(started).to.be.false;
            expect(spawnWorker.called).to.be.false;
        });

        it('should not start the worker when disabled or in CI', function () {
            const spawnWorker = sinon.stub();

            maybeStartUpdateCheck({cachePath, now: 1000, env: {BKPER_DISABLE_AUTOUPDATE: '1'}, spawnWorker});
            maybeStartUpdateCheck({cachePath, now: 1000, env: {CI: 'true'}, spawnWorker});

            expect(spawnWorker.called).to.be.false;
            expect(fs.existsSync(cachePath)).to.be.false;
        });
    });

    describe('runUpdateWorker', function () {
        function dependencies(
            overrides: Partial<UpdateWorkerDependencies> = {}
        ): UpdateWorkerDependencies {
            return {
                cachePath,
                version: '5.0.0',
                fetchLatestVersion: sinon.stub().resolves('5.1.0'),
                getSelfUpdatePlan: sinon.stub().returns(INSTALL_PLAN),
                runInstall: sinon.stub(),
                readInstalledVersion: sinon.stub().onFirstCall().returns('5.0.0').returns('5.1.0'),
                ...overrides,
            };
        }

        it('should install a newer version into a safe global copy and verify it', async function () {
            const deps = dependencies();

            await runUpdateWorker(deps);

            expect((deps.runInstall as sinon.SinonStub).calledOnceWithExactly(INSTALL_PLAN.command)).to
                .be.true;
            expect(readUpdateState(cachePath)).to.deep.include({
                latestVersion: '5.1.0',
                install: {version: '5.1.0', status: 'installed'},
            });
        });

        it('should record a manual instruction without installing when the copy is not safe', async function () {
            const deps = dependencies({getSelfUpdatePlan: sinon.stub().returns(MANUAL_PLAN)});

            await runUpdateWorker(deps);

            expect((deps.runInstall as sinon.SinonStub).called).to.be.false;
            expect(readUpdateState(cachePath).install).to.deep.equal({
                version: '5.1.0',
                status: 'manual',
                instruction: MANUAL_PLAN.instruction,
            });
        });

        it('should record a failure when the install does not change the running copy', async function () {
            const deps = dependencies({readInstalledVersion: sinon.stub().returns('5.0.0')});

            await runUpdateWorker(deps);

            expect(readUpdateState(cachePath).install?.status).to.equal('failed');
        });

        it('should record a failure when the install command fails', async function () {
            const deps = dependencies({runInstall: sinon.stub().throws(new Error('EACCES'))});

            await runUpdateWorker(deps);

            expect(readUpdateState(cachePath).install?.status).to.equal('failed');
        });

        it('should not install when the version on disk is already the latest', async function () {
            const deps = dependencies({readInstalledVersion: sinon.stub().returns('5.1.0')});

            await runUpdateWorker(deps);

            expect((deps.runInstall as sinon.SinonStub).called).to.be.false;
            expect(readUpdateState(cachePath).install?.status).to.equal('installed');
        });

        it('should not install when already on the latest version', async function () {
            const deps = dependencies({fetchLatestVersion: sinon.stub().resolves('5.0.0')});

            await runUpdateWorker(deps);

            expect((deps.getSelfUpdatePlan as sinon.SinonStub).called).to.be.false;
            expect((deps.runInstall as sinon.SinonStub).called).to.be.false;
            expect(readUpdateState(cachePath).latestVersion).to.equal('5.0.0');
        });

        it('should keep the previous state when npm cannot be reached', async function () {
            writeUpdateState({lastAttemptedAt: 1000, latestVersion: '5.0.0'}, cachePath);
            const deps = dependencies({fetchLatestVersion: sinon.stub().resolves(null)});

            await runUpdateWorker(deps);

            expect(readUpdateState(cachePath)).to.deep.equal({
                lastAttemptedAt: 1000,
                latestVersion: '5.0.0',
            });
        });
    });

    describe('getUpdateNotice', function () {
        it('should prefer the version on disk over a cached installation failure', function () {
            const notice = getUpdateNotice(
                {latestVersion: VERSION, install: {version: VERSION, status: 'failed'}},
                '0.0.0'
            );

            expect(notice).to.deep.equal({kind: 'installed', current: '0.0.0', latest: VERSION});
        });

        it('should report a newer installed version even without an update cache', function () {
            expect(getUpdateNotice({}, '5.0.0', '5.1.0')).to.deep.equal({
                kind: 'installed', current: '5.0.0', latest: '5.1.0',
            });
        });

        it('should use the installed version even when the cache describes a different release', function () {
            const notice = getUpdateNotice(
                {latestVersion: '5.1.0', install: {version: '5.1.0', status: 'manual', instruction: 'x'}},
                '5.0.0',
                '5.2.0'
            );

            expect(notice).to.deep.equal({kind: 'installed', current: '5.0.0', latest: '5.2.0'});
        });

        it('should return nothing when up to date or before the worker decided', function () {
            expect(getUpdateNotice({}, '5.0.0', '5.0.0')).to.be.undefined;
            expect(getUpdateNotice({latestVersion: '5.0.0'}, '5.0.0', '5.0.0')).to.be.undefined;
            expect(getUpdateNotice({latestVersion: '5.1.0'}, '5.0.0', '5.0.0')).to.be.undefined;
            expect(getUpdateNotice({}, VERSION)).to.be.undefined;
        });

        it('should warn with the manual instruction when the copy cannot update itself', function () {
            const notice = getUpdateNotice(
                {
                    latestVersion: '5.1.0',
                    install: {version: '5.1.0', status: 'manual', instruction: 'Run: npm install -g bkper@5.1.0'},
                },
                '5.0.0',
                '5.0.0'
            );

            expect(notice).to.deep.equal({
                kind: 'manual',
                current: '5.0.0',
                latest: '5.1.0',
                instruction: 'Run: npm install -g bkper@5.1.0',
            });
            expect(formatUpdateNotice(notice!)).to.equal(
                'bkper 5.1.0 available (current 5.0.0). Run: npm install -g bkper@5.1.0'
            );
        });

        it('should point to bkper upgrade when the automatic install failed', function () {
            const notice = getUpdateNotice(
                {latestVersion: '5.1.0', install: {version: '5.1.0', status: 'failed'}},
                '5.0.0',
                '5.0.0'
            );

            expect(formatUpdateNotice(notice!)).to.equal(
                'bkper 5.1.0 available (current 5.0.0). Run: bkper upgrade'
            );
        });

        it('should report an install that the running process is not using yet', function () {
            const notice = getUpdateNotice(
                {latestVersion: '5.1.0', install: {version: '5.1.0', status: 'installed'}},
                '5.0.0',
                '5.1.0'
            );

            expect(notice).to.deep.equal({kind: 'installed', current: '5.0.0', latest: '5.1.0'});
        });

        it('should ignore an install record for an older release', function () {
            const notice = getUpdateNotice(
                {latestVersion: '5.2.0', install: {version: '5.1.0', status: 'manual', instruction: 'x'}},
                '5.0.0',
                '5.0.0'
            );

            expect(notice).to.be.undefined;
        });
    });
});
