import {expect} from '../../../helpers/test-setup.js';
import {createPlatformSourceApi} from '../../../../../src/commands/apps/git/platform-source.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {ARTIFACTS_REMOTE} from './helpers.js';

describe('apps git platform source', function () {
    it('activates without a stored login so an outbound proxy can authenticate the request', async function () {
        const requests: Request[] = [];
        const api = createPlatformSourceApi({
            getToken: async () => undefined,
            fetch: async (input, init) => {
                requests.push(new Request(input, init));
                return Response.json({
                    success: true,
                    disposition: 'created',
                    source: {mode: 'managed', appId: 'demo-app', remote: ARTIFACTS_REMOTE},
                });
            },
        });

        const result = await api.activate('demo-app', 'activation-1');

        expect(result.source.remote).to.equal(ARTIFACTS_REMOTE);
        expect(requests).to.have.length(1);
        expect(requests[0].headers.has('Authorization')).to.equal(false);
    });

    it('issues repository credentials only with a stored login', async function () {
        let fetched = false;
        const api = createPlatformSourceApi({
            getToken: async () => undefined,
            fetch: async () => {
                fetched = true;
                return new Response(null, {status: 500});
            },
        });

        try {
            await api.issueCredential('demo-app', 'read');
            expect.fail('expected authentication failure');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('AUTHENTICATION_REQUIRED');
        }
        expect(fetched).to.equal(false);
    });
});
