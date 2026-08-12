import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {cloneManagedApp} from '../../../../../src/commands/apps/git/clone.js';
import type {PlatformSourceApi} from '../../../../../src/commands/apps/git/platform-source.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {readSourceMarker} from '../../../../../src/commands/apps/git/markers.js';
import {
    ARTIFACTS_REMOTE,
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git clone', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('rejects external apps with provider-clone guidance', async function () {
        const api: PlatformSourceApi = {
            async getStatus() {
                return {
                    mode: 'external',
                    state: 'not_managed',
                    consistency: 'eventual',
                    retryable: true,
                };
            },
            async activate() {
                throw new Error('should not activate source');
            },
            async issueCredential() {
                throw new Error('should not issue credentials');
            },
        };

        try {
            await cloneManagedApp({
                appId: 'external-app',
                cwd: tempDir,
                api,
            });
            expect.fail('expected external clone rejection');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('EXTERNAL_SOURCE_CLONE');
            expect((error as ManagedGitError).message).to.contain('external Git provider');
        }
    });

    it('clones atomically, configures origin helper, and never installs dependencies', async function () {
        const source = path.join(tempDir, 'source-template');
        initRepo(source);
        writeFile(source, 'bkper.yaml', 'id: demo-app\nname: Demo\n');
        writeFile(source, 'package.json', JSON.stringify({name: 'demo-app', scripts: {postinstall: 'echo no'}}) + '\n');
        commitAll(source, 'init');

        const api: PlatformSourceApi = {
            async getStatus() {
                return {
                    mode: 'managed',
                    state: 'active',
                    consistency: 'eventual',
                    appId: 'demo-app',
                    repositoryId: 'repo-1',
                    repositoryName: 'demo-app',
                    namespace: 'bkper-app-sources-dev',
                    remote: ARTIFACTS_REMOTE,
                };
            },
            async activate() {
                throw new Error('should not activate source');
            },
            async issueCredential(_appId, scope) {
                expect(scope).to.equal('read');
                return {
                    token: 'read-token',
                    scope: 'read',
                    expiresAt: new Date(Date.now() + 300_000).toISOString(),
                    remote: ARTIFACTS_REMOTE,
                };
            },
        };

        const destination = path.join(tempDir, 'demo-app');
        const result = await cloneManagedApp({
            appId: 'demo-app',
            destination,
            cwd: tempDir,
            api,
            cloneImpl: async ({tempDir: cloneTemp, remote}) => {
                // Simulate git clone into temp directory with the managed remote as origin.
                runGitSync(['clone', source, cloneTemp], tempDir);
                runGitSync(['remote', 'set-url', 'origin', remote], cloneTemp);
                runGitSync(['config', 'user.email', 'test@example.com'], cloneTemp);
                runGitSync(['config', 'user.name', 'Test User'], cloneTemp);
            },
        });

        expect(result).to.equal(destination);
        expect(fs.existsSync(destination)).to.equal(true);
        expect(fs.existsSync(path.join(destination, 'node_modules'))).to.equal(false);
        expect(runGitSync(['remote', 'get-url', 'origin'], destination).stdout.trim()).to.equal(
            ARTIFACTS_REMOTE
        );
        const helpers = runGitSync(
            ['config', '--get-all', `credential.${ARTIFACTS_REMOTE}.helper`],
            destination
        ).stdout;
        expect(helpers).to.contain("bkper app git-credential 'demo-app'");
        expect(helpers).to.not.contain('--app');
        expect(readSourceMarker(destination)).to.deep.include({
            state: 'managed',
            appId: 'demo-app',
            remote: ARTIFACTS_REMOTE,
        });

        // Temp sibling directories must not remain.
        const leftovers = fs
            .readdirSync(tempDir)
            .filter(name => name.startsWith('.demo-app-clone-'));
        expect(leftovers).to.deep.equal([]);
    });

    it('removes only the temporary directory when validation fails', async function () {
        const api: PlatformSourceApi = {
            async getStatus() {
                return {
                    mode: 'managed',
                    state: 'active',
                    consistency: 'eventual',
                    appId: 'demo-app',
                    repositoryId: 'repo-1',
                    repositoryName: 'demo-app',
                    namespace: 'bkper-app-sources-dev',
                    remote: ARTIFACTS_REMOTE,
                };
            },
            async activate() {
                throw new Error('should not activate source');
            },
            async issueCredential() {
                return {
                    token: 'read-token',
                    scope: 'read',
                    expiresAt: new Date().toISOString(),
                    remote: ARTIFACTS_REMOTE,
                };
            },
        };

        const destination = path.join(tempDir, 'demo-app');
        try {
            await cloneManagedApp({
                appId: 'demo-app',
                destination,
                cwd: tempDir,
                api,
                cloneImpl: async ({tempDir: cloneTemp}) => {
                    writeFile(cloneTemp, 'bkper.yaml', 'id: other-app\n');
                    initRepo(cloneTemp);
                    commitAll(cloneTemp, 'wrong-id');
                },
            });
            expect.fail('expected app id mismatch');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('APP_ID_MISMATCH');
        }

        expect(fs.existsSync(destination)).to.equal(false);
        const leftovers = fs
            .readdirSync(tempDir)
            .filter(name => name.includes('clone'));
        expect(leftovers).to.deep.equal([]);
    });
});
