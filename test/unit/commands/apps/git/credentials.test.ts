import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    buildCredentialConfigSection,
    buildCredentialHelperCommand,
    configureManagedCredentialHelper,
    formatCredentialGetResponse,
    parseCredentialInput,
    runGitCredentialHelper,
} from '../../../../../src/commands/apps/git/credentials.js';
import {stripRepositoryTokenSecret} from '../../../../../src/commands/apps/git/platform-source.js';
import type {PlatformSourceApi} from '../../../../../src/commands/apps/git/platform-source.js';
import {
    ARTIFACTS_REMOTE,
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git credentials', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('parses credential input and strips token query suffixes', function () {
        const request = parseCredentialInput(
            ['protocol=https', 'host=example.artifacts.cloudflare.net', 'path=git/ns/app.git', ''].join(
                '\n'
            )
        );
        expect(request).to.deep.equal({
            protocol: 'https',
            host: 'example.artifacts.cloudflare.net',
            path: 'git/ns/app.git',
        });
        expect(stripRepositoryTokenSecret('secret-token?expires=123')).to.equal('secret-token');
        expect(formatCredentialGetResponse('secret-token')).to.equal(
            'username=x\npassword=secret-token\n'
        );
    });

    it('configures exact URL/path-scoped helper and clears inherited helpers', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');

        await configureManagedCredentialHelper(repo, ARTIFACTS_REMOTE, 'demo-app');
        await configureManagedCredentialHelper(repo, ARTIFACTS_REMOTE, 'demo-app');

        const useHttpPath = runGitSync(
            ['config', '--get', `credential.${ARTIFACTS_REMOTE}.useHttpPath`],
            repo
        ).stdout.trim();
        expect(useHttpPath).to.equal('true');

        const helpers = runGitSync(
            ['config', '--get-all', `credential.${ARTIFACTS_REMOTE}.helper`],
            repo
        ).stdout.split('\n').map(line => line.trim());
        expect(helpers[0]).to.equal('');
        expect(helpers[1]).to.equal("!bkper app git-credential 'demo-app'");
        expect(helpers[1]).to.equal(buildCredentialHelperCommand('demo-app'));
        expect(helpers[1]).to.not.contain('--app');
        expect(buildCredentialConfigSection(ARTIFACTS_REMOTE, 'demo-app')).to.contain(
            'useHttpPath = true'
        );
    });

    it('implements noninteractive get and non-persisting store/erase', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');

        const remote = ARTIFACTS_REMOTE;
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
                    remote,
                };
            },
            async activate() {
                throw new Error('should not activate source');
            },
            async issueCredential() {
                return {
                    token: 'write-token-value?expires=999',
                    scope: 'write',
                    expiresAt: new Date(Date.now() + 300_000).toISOString(),
                    remote,
                };
            },
        };

        let stdout = '';
        let stderr = '';
        const parsed = new URL(remote);
        const code = await runGitCredentialHelper({
            appId: 'demo-app',
            operation: 'get',
            api,
            stdin: [
                `protocol=${parsed.protocol.replace(':', '')}`,
                `host=${parsed.host}`,
                `path=${parsed.pathname.replace(/^\//, '')}`,
                '',
            ].join('\n'),
            stdout: chunk => {
                stdout += chunk;
            },
            stderr: chunk => {
                stderr += chunk;
            },
        });

        expect(code).to.equal(0);
        expect(stdout).to.equal('username=x\npassword=write-token-value\n');
        expect(stderr).to.equal('');
        expect(stdout).to.not.contain('expires=');

        const storeCode = await runGitCredentialHelper({
            operation: 'store',
            stdin: 'protocol=https\nhost=example\npassword=should-not-store\n',
            stdout: chunk => {
                stdout += chunk;
            },
            stderr: chunk => {
                stderr += chunk;
            },
            api,
        });
        expect(storeCode).to.equal(0);

        const eraseCode = await runGitCredentialHelper({
            operation: 'erase',
            api,
            stdout: () => undefined,
            stderr: () => undefined,
        });
        expect(eraseCode).to.equal(0);

        // No credential files written by helper.
        const files = fs.readdirSync(repo, {withFileTypes: true}).map(entry => entry.name);
        expect(files).to.not.include('.git-credentials');
    });

    it('fails closed on host/path mismatch without printing secrets', async function () {
        let stdout = '';
        let stderr = '';
        const api: PlatformSourceApi = {
            async getStatus() {
                throw new Error('unused');
            },
            async activate() {
                throw new Error('unused');
            },
            async issueCredential() {
                return {
                    token: 'super-secret-token',
                    scope: 'write',
                    expiresAt: new Date().toISOString(),
                    remote: ARTIFACTS_REMOTE,
                };
            },
        };

        const code = await runGitCredentialHelper({
            appId: 'demo-app',
            operation: 'get',
            api,
            stdin: 'protocol=https\nhost=evil.example\npath=git/ns/app.git\n',
            stdout: chunk => {
                stdout += chunk;
            },
            stderr: chunk => {
                stderr += chunk;
            },
        });

        expect(code).to.equal(1);
        expect(stdout).to.equal('');
        expect(stderr).to.not.contain('super-secret-token');
    });
});
