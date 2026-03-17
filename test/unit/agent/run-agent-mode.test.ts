import { expect } from '../helpers/test-setup.js';
import { runAgentMode, type AgentModeDependencies } from '../../../src/agent/run-agent-mode.js';

describe('runAgentMode', function () {
    it('should reload resources, create session and run interactive mode', async function () {
        const calls: string[] = [];

        const fakeLoader = {
            reload: async () => {
                calls.push('reload');
            },
        };

        const fakeSession = {
            sessionId: 'test-session',
        };

        const deps: AgentModeDependencies = {
            createResourceLoader: () => fakeLoader,
            createSession: async ({ resourceLoader }) => {
                expect(resourceLoader).to.equal(fakeLoader);
                calls.push('createSession');
                return {
                    session: fakeSession,
                    extensionsResult: {
                        extensions: [],
                        errors: [],
                        runtime: {},
                    },
                };
            },
            createInteractiveMode: (session, modelFallbackMessage) => {
                expect(session).to.equal(fakeSession);
                expect(modelFallbackMessage).to.equal(undefined);
                return {
                    run: async () => {
                        calls.push('run');
                    },
                };
            },
        };

        await runAgentMode(deps);

        expect(calls).to.deep.equal(['reload', 'createSession', 'run']);
    });
});
