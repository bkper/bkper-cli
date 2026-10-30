import {expect} from '../../helpers/test-setup.js';
import {createPlatformContextApi, type ContextScope} from '../../../../src/commands/context/platform-context.js';

describe('Platform context credentials', function () {
    const issued = (calls: Array<{url: string; init: RequestInit}>) =>
        createPlatformContextApi({
            getToken: async () => 'oauth-token',
            fetch: async (url, init) => {
                calls.push({url, init});
                return new Response(
                    JSON.stringify({token: 't', scope: 'read', expiresAt: '2026-10-01T00:00:00Z', remote: 'r'}),
                    {status: 201}
                );
            },
        });

    const scopes: Array<[ContextScope, string]> = [
        ['user', '/api/workspace/user/credentials'],
        ['domain', '/api/workspace/domain/credentials'],
        ['books/agtzBook', '/api/workspace/books/agtzBook/credentials'],
    ];
    for (const [scope, route] of scopes) {
        it(`asks Platform's Workspace route for the ${scope} scope`, async function () {
            const calls: Array<{url: string; init: RequestInit}> = [];
            await issued(calls).issueCredential('read', scope);
            expect(calls).to.have.length(1);
            expect(new URL(calls[0].url).pathname).to.equal(route);
            expect(calls[0].init.method).to.equal('POST');
            expect(calls[0].init.body).to.equal(JSON.stringify({scope: 'read'}));
        });
    }
});
