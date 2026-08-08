import {
    VERSION as PI_VERSION,
    type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import {getKeybindings, KeybindingsManager, setKeybindings} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {registerBkperAgentStartupExtension} from '../../../../src/agent/extensions/startup.js';

type NotificationType = 'info' | 'warning' | 'error';

type StartupTheme = {
    bold: (text: string) => string;
    fg: (color: string, text: string) => string;
};

type StartupHeaderFactory = (
    tui: unknown,
    theme: StartupTheme
) => {
    render: (width: number) => string[];
};

type RegisteredSessionStartHandler = (
    event: unknown,
    context: {
        ui: {
            notify: (message: string, type?: NotificationType) => void;
            setHeader: (factory: StartupHeaderFactory | undefined) => void;
        };
        modelRegistry: {
            getAvailable: () => Array<{
                provider: string;
                id: string;
            }>;
        };
    }
) => Promise<void>;

function createThemeStub(): StartupTheme {
    return {
        bold: (text: string) => text,
        fg: (_color: string, text: string) => text,
    };
}

const STARTUP_TEST_KEYBINDINGS = {
    'app.interrupt': {defaultKeys: 'escape'},
    'app.clear': {defaultKeys: 'ctrl+c'},
    'app.editor.external': {defaultKeys: 'ctrl+g'},
    'app.session.resume': {defaultKeys: 'ctrl+s'},
    'app.session.fork': {defaultKeys: 'ctrl+x'},
    'app.session.tree': {defaultKeys: 'ctrl+r'},
} as const;

function renderStartupHeaderWithKeybindings(
    factory: StartupHeaderFactory,
    userBindings: Record<string, string | string[]> = {}
): string {
    const previousKeybindings = getKeybindings();
    setKeybindings(new KeybindingsManager(STARTUP_TEST_KEYBINDINGS, userBindings));

    try {
        return factory(undefined, createThemeStub()).render(120).join('\n');
    } finally {
        setKeybindings(previousKeybindings);
    }
}

function registerStartupExtension(
    startupMaintenance = sinon.stub().resolves(),
    settingsManager?: {getQuietStartup: () => boolean},
    bkperAiBaseUrlOverride?: string
): {
    sessionStartHandler: RegisteredSessionStartHandler;
    startupMaintenance: typeof startupMaintenance;
} {
    let sessionStartHandler: RegisteredSessionStartHandler | undefined;

    registerBkperAgentStartupExtension(
        {
            on: ((event: 'session_start', handler: RegisteredSessionStartHandler) => {
                if (event === 'session_start') {
                    sessionStartHandler = handler;
                }
            }) as unknown as ExtensionAPI['on'],
        },
        startupMaintenance,
        settingsManager,
        bkperAiBaseUrlOverride
    );

    expect(sessionStartHandler).to.not.equal(undefined);

    return {
        sessionStartHandler: sessionStartHandler as RegisteredSessionStartHandler,
        startupMaintenance,
    };
}

describe('Bkper agent startup extension', function () {
    it('replaces the Pi startup header with Bkper hints and starts maintenance once', async function () {
        const notify = sinon.stub();
        let startupHeaderFactory: StartupHeaderFactory | undefined;
        const setHeader = sinon
            .stub()
            .callsFake((factory: StartupHeaderFactory | undefined) => {
                startupHeaderFactory = factory;
            });

        const {sessionStartHandler, startupMaintenance} = registerStartupExtension();

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [{provider: 'anthropic', id: 'claude-sonnet-4'}],
                },
            }
        );
        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {
                    getAvailable: () => [{provider: 'anthropic', id: 'claude-sonnet-4'}],
                },
            }
        );

        expect(setHeader.called).to.be.true;
        expect(startupHeaderFactory).to.not.equal(undefined);
        const headerText = startupHeaderFactory
            ? renderStartupHeaderWithKeybindings(startupHeaderFactory)
            : '';

        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.include('/resume (ctrl+s)');
        expect(headerText).to.include('to resume a session');
        expect(headerText).to.include('/fork (ctrl+x)');
        expect(headerText).to.include('to branch from a message');
        expect(headerText).to.include('/clone');
        expect(headerText).to.include('to duplicate session');
        expect(headerText).to.include('/tree (ctrl+r)');
        expect(headerText).to.include('/handoff (ctrl+h)');
        expect(
            startupHeaderFactory
                ? renderStartupHeaderWithKeybindings(startupHeaderFactory, {
                      'app.editor.external': 'ctrl+h',
                  })
                : ''
        ).to.not.include('/handoff (ctrl+h)');
        expect(headerText).to.not.include('Pi can explain its own features and look up its docs.');
        expect(notify.called).to.be.false;
        expect(startupMaintenance.calledOnce).to.be.true;
        expect(startupMaintenance.firstCall.args[0]).to.have.property('notify');
        expect(startupMaintenance.firstCall.args[0].notify).to.be.a('function');
    });

    it('suppresses the header override when quietStartup is enabled', async function () {
        const notify = sinon.stub();
        const setHeader = sinon.stub();

        const {sessionStartHandler, startupMaintenance} = registerStartupExtension(
            sinon.stub().resolves(),
            {getQuietStartup: () => true}
        );

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {getAvailable: () => []},
            }
        );

        expect(notify.called).to.be.false;
        expect(setHeader.called).to.be.false;
        expect(startupMaintenance.calledOnce).to.be.true;
    });

    it('warns about a Bkper AI endpoint override during quiet startup', async function () {
        const notify = sinon.stub();
        const setHeader = sinon.stub();

        const {sessionStartHandler} = registerStartupExtension(
            sinon.stub().resolves(),
            {getQuietStartup: () => true},
            'https://ai-dev.bkper.app/v2'
        );

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {getAvailable: () => []},
            }
        );

        expect(setHeader.called).to.be.false;
        expect(
            notify.calledWithExactly(
                'Bkper AI endpoint override active: https://ai-dev.bkper.app/v2',
                'warning'
            )
        ).to.be.true;
    });

    it('shows a setup hint when no models are available', async function () {
        const notify = sinon.stub();
        let startupHeaderFactory: StartupHeaderFactory | undefined;
        const setHeader = sinon
            .stub()
            .callsFake((factory: StartupHeaderFactory | undefined) => {
                startupHeaderFactory = factory;
            });

        const {sessionStartHandler} = registerStartupExtension();

        await sessionStartHandler(
            {},
            {
                ui: {notify, setHeader},
                modelRegistry: {getAvailable: () => []},
            }
        );

        expect(startupHeaderFactory).to.not.equal(undefined);
        const headerText = startupHeaderFactory
            ? renderStartupHeaderWithKeybindings(startupHeaderFactory)
            : '';
        expect(headerText).to.include('██████╗');
        expect(headerText).to.include(`pi v${PI_VERSION}`);
        expect(headerText).to.include('to interrupt');
        expect(headerText).to.include('for session tree');
        expect(headerText).to.include('to clear');
        expect(headerText).to.include('to exit');
        expect(headerText).to.include('for commands');
        expect(headerText).to.include('to run bash');
        expect(headerText).to.include('/resume (ctrl+s)');
        expect(headerText).to.include('to resume a session');
        expect(headerText).to.include('/fork (ctrl+x)');
        expect(headerText).to.include('to branch from a message');
        expect(headerText).to.include('/clone');
        expect(headerText).to.include('to duplicate session');
        expect(headerText).to.include('/tree (ctrl+r)');
        expect(headerText).to.include('Use /login for Bkper AI');
        expect(headerText).to.include('/connect for another model provider');
        expect(notify.called).to.be.false;
    });
});
