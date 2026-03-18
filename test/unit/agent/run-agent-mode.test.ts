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

    it('should set PI_SKIP_VERSION_CHECK by default for embedded agent mode', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        delete process.env.PI_SKIP_VERSION_CHECK;

        const deps: AgentModeDependencies = {
            createResourceLoader: () => ({
                reload: async () => {},
            }),
            createSession: async () => ({
                session: {},
            }),
            createInteractiveMode: () => ({
                run: async () => {},
            }),
        };

        try {
            await runAgentMode(deps);
            expect(process.env.PI_SKIP_VERSION_CHECK).to.equal('1');
        } finally {
            if (previous === undefined) {
                delete process.env.PI_SKIP_VERSION_CHECK;
            } else {
                process.env.PI_SKIP_VERSION_CHECK = previous;
            }
        }
    });

    it('should keep user-defined PI_SKIP_VERSION_CHECK value', async function () {
        const previous = process.env.PI_SKIP_VERSION_CHECK;
        process.env.PI_SKIP_VERSION_CHECK = '0';

        const deps: AgentModeDependencies = {
            createResourceLoader: () => ({
                reload: async () => {},
            }),
            createSession: async () => ({
                session: {},
            }),
            createInteractiveMode: () => ({
                run: async () => {},
            }),
        };

        try {
            await runAgentMode(deps);
            expect(process.env.PI_SKIP_VERSION_CHECK).to.equal('0');
        } finally {
            if (previous === undefined) {
                delete process.env.PI_SKIP_VERSION_CHECK;
            } else {
                process.env.PI_SKIP_VERSION_CHECK = previous;
            }
        }
    });
});
