import path from 'node:path';
import sinon from 'sinon';
import {SettingsManager} from '@earendil-works/pi-coding-agent';
import {expect} from '../../helpers/test-setup.js';
import {
    applyBkperAgentSettingsDefaults,
    applyBkperAgentToolSelection,
    createStartupSessionManager,
    resolveBkperAgentTools,
} from '../../../../src/agent/interactive/settings.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

describe('interactive agent settings', function () {
    it('selects the platform shell for implicit defaults', function () {
        expect(
            resolveBkperAgentTools(undefined, 'win32', {
                bash: true,
                powershell: true,
            })
        ).to.deep.equal({
            tools: ['read', 'powershell', 'edit', 'write', 'codemode'],
        });
        expect(
            resolveBkperAgentTools(undefined, 'linux', {
                bash: true,
                powershell: false,
            })
        ).to.deep.equal({
            tools: ['read', 'bash', 'edit', 'write', 'codemode'],
        });
    });

    it('forces PowerShell detection for local development', function () {
        const previousOverride = process.env.BKPER_AGENT_FORCE_PLATFORM;
        const applyOverrides = sinon.stub();
        process.env.BKPER_AGENT_FORCE_PLATFORM = 'win32';

        try {
            const diagnostics = applyBkperAgentToolSelection({
                getDefaultTools: () => undefined,
                getGlobalSettings: () => ({}),
                getProjectSettings: () => ({}),
                getShellPath: () => undefined,
                applyOverrides,
            });

            expect(
                applyOverrides.calledOnceWithExactly({
                    defaultTools: ['read', 'powershell', 'edit', 'write', 'codemode'],
                })
            ).to.be.true;
            expect(diagnostics).to.deep.equal([]);
        } finally {
            if (previousOverride === undefined) {
                delete process.env.BKPER_AGENT_FORCE_PLATFORM;
            } else {
                process.env.BKPER_AGENT_FORCE_PLATFORM = previousOverride;
            }
        }
    });

    it('falls back to Bash when PowerShell is unavailable on Windows', function () {
        expect(
            resolveBkperAgentTools(undefined, 'win32', {
                bash: true,
                powershell: false,
            })
        ).to.deep.equal({
            tools: ['read', 'bash', 'edit', 'write', 'codemode'],
            warning: 'PowerShell is unavailable; using Bash instead.',
        });
    });

    it('starts without a shell when none is available', function () {
        expect(
            resolveBkperAgentTools(undefined, 'win32', {
                bash: false,
                powershell: false,
            })
        ).to.deep.equal({
            tools: ['read', 'edit', 'write', 'codemode'],
            warning: 'No supported shell is available; command execution is disabled.',
        });
    });

    it('omits unavailable explicitly configured shells without substitution', function () {
        expect(
            resolveBkperAgentTools(
                ['read', 'bash', 'powershell', 'edit', 'custom-tool'],
                'win32',
                {bash: false, powershell: true}
            )
        ).to.deep.equal({
            tools: ['read', 'powershell', 'edit', 'custom-tool'],
            warning: 'Unavailable configured shell tools were disabled: bash.',
        });
    });

    it('keeps an explicit tool selection without adding codemode', function () {
        expect(
            resolveBkperAgentTools(['read', 'bash'], 'linux', {
                bash: true,
                powershell: false,
            })
        ).to.deep.equal({tools: ['read', 'bash']});
    });

    it('enables codemode from a +codemode settings entry', function () {
        const settingsManager = SettingsManager.inMemory({
            defaultTools: ['read', 'bash', '+codemode'],
        });

        applyBkperAgentToolSelection(settingsManager, 'linux');

        expect(settingsManager.getDefaultTools()).to.deep.equal(['read', 'bash', 'codemode']);
    });

    it('applies modifier-only settings to the Bkper defaults', function () {
        const settingsManager = SettingsManager.inMemory({defaultTools: ['+grep']});

        applyBkperAgentToolSelection(settingsManager, 'linux');

        expect(settingsManager.getDefaultTools()).to.deep.equal([
            'read',
            'bash',
            'edit',
            'write',
            'codemode',
            'grep',
        ]);
    });

    it('removes only codemode for a -codemode settings entry', function () {
        const settingsManager = SettingsManager.inMemory({defaultTools: ['-codemode']});

        applyBkperAgentToolSelection(settingsManager, 'linux');

        expect(settingsManager.getDefaultTools()).to.deep.equal(['read', 'bash', 'edit', 'write']);
    });

    it('keeps PowerShell on Windows for modifier-only settings', function () {
        const previousOverride = process.env.BKPER_AGENT_FORCE_PLATFORM;
        process.env.BKPER_AGENT_FORCE_PLATFORM = 'win32';

        try {
            const settingsManager = SettingsManager.inMemory({defaultTools: ['+grep']});

            applyBkperAgentToolSelection(settingsManager);

            expect(settingsManager.getDefaultTools()).to.deep.equal([
                'read',
                'powershell',
                'edit',
                'write',
                'codemode',
                'grep',
            ]);
        } finally {
            if (previousOverride === undefined) {
                delete process.env.BKPER_AGENT_FORCE_PLATFORM;
            } else {
                process.env.BKPER_AGENT_FORCE_PLATFORM = previousOverride;
            }
        }
    });

    it('applies global then project modifiers in order', function () {
        const applyOverrides = sinon.stub();

        applyBkperAgentToolSelection(
            {
                getDefaultTools: () => ['read', 'bash', 'edit', 'write', 'grep'],
                getGlobalSettings: () => ({defaultTools: ['+grep']}),
                getProjectSettings: () => ({defaultTools: ['-codemode']}),
                getShellPath: () => undefined,
                applyOverrides,
            },
            'linux'
        );

        expect(
            applyOverrides.calledOnceWithExactly({
                defaultTools: ['read', 'bash', 'edit', 'write', 'grep'],
            })
        ).to.be.true;
    });

    it('uses the resolved selection when any settings layer lists plain tool names', function () {
        const applyOverrides = sinon.stub();

        applyBkperAgentToolSelection(
            {
                getDefaultTools: () => ['read', 'grep'],
                getGlobalSettings: () => ({defaultTools: ['+codemode']}),
                getProjectSettings: () => ({defaultTools: ['read', 'grep']}),
                getShellPath: () => undefined,
                applyOverrides,
            },
            'linux'
        );

        expect(applyOverrides.calledOnceWithExactly({defaultTools: ['read', 'grep']})).to.be
            .true;
    });

    it('disables an unavailable shell added by a modifier', function () {
        expect(
            resolveBkperAgentTools(undefined, 'linux', {bash: true, powershell: false}, [
                '+powershell',
            ])
        ).to.deep.equal({
            tools: ['read', 'bash', 'edit', 'write', 'codemode'],
            warning: 'Unavailable configured shell tools were disabled: powershell.',
        });
    });

    it('disables configured shells even when no configured tool remains', function () {
        const settingsManager = SettingsManager.inMemory({
            defaultTools: ['bash'],
            shellPath: path.join(REPO_ROOT, 'missing-shell'),
        });

        const diagnostics = applyBkperAgentToolSelection(settingsManager, 'linux');

        expect(settingsManager.getDefaultTools()).to.deep.equal([]);
        expect(diagnostics).to.deep.equal([
            {
                type: 'warning',
                message: 'Unavailable configured shell tools were disabled: bash.',
            },
        ]);
    });

    it('persists Bkper agent defaults when no user settings are present', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();
        const setCacheWarmingMode = sinon.stub();
        const setWarnings = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({}),
            getProjectSettings: () => ({}),
            setShowCacheMissNotices,
            setTuiMode,
            setCacheWarmingMode,
            setWarnings,
        });

        expect(setShowCacheMissNotices.calledOnceWithExactly(true)).to.be.true;
        expect(setTuiMode.calledOnceWithExactly('fullscreen')).to.be.true;
        expect(setCacheWarmingMode.calledOnceWithExactly('idle')).to.be.true;
        expect(setWarnings.calledOnceWithExactly({anthropicExtraUsage: false})).to.be.true;
    });

    it('preserves explicit global Bkper agent settings', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();
        const setCacheWarmingMode = sinon.stub();
        const setWarnings = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({
                showCacheMissNotices: false,
                tuiMode: 'regular',
                cacheWarming: 'off',
                warnings: {anthropicExtraUsage: true},
            }),
            getProjectSettings: () => ({}),
            setShowCacheMissNotices,
            setTuiMode,
            setCacheWarmingMode,
            setWarnings,
        });

        expect(setShowCacheMissNotices.called).to.be.false;
        expect(setTuiMode.called).to.be.false;
        expect(setCacheWarmingMode.called).to.be.false;
        expect(setWarnings.called).to.be.false;
    });

    it('preserves explicit project Bkper agent settings', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();
        const setCacheWarmingMode = sinon.stub();
        const setWarnings = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({}),
            getProjectSettings: () => ({
                showCacheMissNotices: false,
                tuiMode: 'regular',
                warnings: {anthropicExtraUsage: true},
            }),
            setShowCacheMissNotices,
            setTuiMode,
            setCacheWarmingMode,
            setWarnings,
        });

        expect(setShowCacheMissNotices.called).to.be.false;
        expect(setTuiMode.called).to.be.false;
        expect(setWarnings.called).to.be.false;
    });

    it('creates the startup session manager with sessionDir from settings', function () {
        const createSessionManager = sinon.stub().returns({id: 'session-manager'});

        const sessionManager = createStartupSessionManager(
            REPO_ROOT,
            {
                getSessionDir: () => '.pi/sessions',
            },
            createSessionManager
        );

        expect(createSessionManager.calledOnceWithExactly(REPO_ROOT, '.pi/sessions')).to.be.true;
        expect(sessionManager).to.equal(createSessionManager.firstCall.returnValue);
    });
});
