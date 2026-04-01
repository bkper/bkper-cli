import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import {
    appendBkperAgentPrompt,
    registerBkperAgentStartupExtension,
    runAgentMode,
    type AgentModeDependencies,
} from '../../../src/agent/run-agent-mode.js';
import { getBkperAgentAppendPrompt } from '../../../src/agent/system-prompt.js';

describe('runAgentMode', function () {
    it('should append Bkper prompt after existing append prompts', function () {
        expect(appendBkperAgentPrompt(['existing prompt'])).to.deep.equal([
            'existing prompt',
            getBkperAgentAppendPrompt(),
        ]);
    });

    it('should register startup extension that shows ready message and starts maintenance once', async function () {
        let sessionStartHandler:
            | ((
                  event: unknown,
                  context: {
                      ui: {
                          notify: (message: string, type?: 'info' | 'warning' | 'error') => void;
                      };
                  }
              ) => Promise<void>)
            | undefined;

        const startupMaintenance = sinon.stub().resolves();
        const notify = sinon.stub();

        registerBkperAgentStartupExtension(
            {
                on: (
                    event: 'session_start',
                    handler: (
                        event: unknown,
                        context: {
                            ui: {
                                notify: (
                                    message: string,
                                    type?: 'info' | 'warning' | 'error'
                                ) => void;
                            };
                        }
                    ) => Promise<void>
                ) => {
                    if (event === 'session_start') {
                        sessionStartHandler = handler;
                    }
                },
            },
            startupMaintenance
        );

        expect(sessionStartHandler).to.not.equal(undefined);

        await sessionStartHandler?.({}, {ui: {notify}});
        await sessionStartHandler?.({}, {ui: {notify}});

        expect(notify.calledWithExactly('Bkper Agent ready.', 'info')).to.be.true;
        expect(startupMaintenance.calledOnce).to.be.true;
        expect(startupMaintenance.firstCall.args[0]).to.have.property('notify');
        expect(startupMaintenance.firstCall.args[0].notify).to.be.a('function');
    });

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
