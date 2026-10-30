import {expect} from '../../helpers/test-setup.js';
import {runContextCredentialHelper} from '../../../../src/commands/context/git-credential.js';
import type {PlatformContextApi} from '../../../../src/commands/context/platform-context.js';

const REMOTE = 'https://account.artifacts.cloudflare.net/git/bkper-agent-context-dev/user-0123.git';
const STDIN = 'protocol=https\nhost=account.artifacts.cloudflare.net\npath=git/bkper-agent-context-dev/user-0123.git\n';

function platform(): PlatformContextApi & {calls: string[]} {
    const calls: string[] = [];
    return {
        calls,
        async issueCredential(access) {
            calls.push(access);
            return {token: `${access}-secret?expires=1`, scope: access, expiresAt: '2026-10-01T00:00:00Z', remote: REMOTE};
        },
    };
}
async function helper(options: Partial<Parameters<typeof runContextCredentialHelper>[0]> = {}) {
    let stdout = '';
    let stderr = '';
    const code = await runContextCredentialHelper({
        scope: 'user',
        operation: 'get',
        stdin: STDIN,
        environment: {},
        stdout: chunk => {
            stdout += chunk;
        },
        stderr: chunk => {
            stderr += chunk;
        },
        ...options,
    });
    return {code, stdout, stderr};
}

describe('user context Git credential helper', function () {
    it('issues a write credential for an ordinary push, so the first push creates the repository', async function () {
        const api = platform();
        expect(await helper({api})).to.deep.equal({code: 0, stdout: 'username=x\npassword=write-secret\n', stderr: ''});
        expect(api.calls).to.deep.equal(['write']);
    });

    it("uses the background pull's pre-issued read token without asking Platform", async function () {
        const api = platform();
        const result = await helper({api, environment: {BKPER_CONTEXT_TOKEN: 'read-secret?expires=1', BKPER_CONTEXT_REMOTE: REMOTE}});
        expect(result.stdout).to.equal('username=x\npassword=read-secret\n');
        expect(api.calls).to.deep.equal([]);
    });

    it('refuses other remotes, other scopes and plain HTTP, and never prints a token', async function () {
        const api = platform();
        for (const options of [
            {stdin: 'protocol=https\nhost=evil.test\npath=git/x.git\n'},
            {stdin: STDIN.replace('protocol=https', 'protocol=http')},
            {scope: 'books'},
        ]) {
            const result = await helper({api, ...options});
            expect(result.code).to.equal(1);
            expect(result.stdout).to.equal('');
            expect(result.stderr).to.not.contain('secret');
        }
    });

    it('never stores or erases anything', async function () {
        for (const operation of ['store', 'erase']) {
            expect((await helper({operation, api: platform()})).code).to.equal(0);
        }
    });
});
