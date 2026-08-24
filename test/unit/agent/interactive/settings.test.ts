import path from 'node:path';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    applyBkperAgentSettingsDefaults,
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
            tools: ['read', 'powershell', 'edit', 'write'],
        });
        expect(
            resolveBkperAgentTools(undefined, 'linux', {
                bash: true,
                powershell: false,
            })
        ).to.deep.equal({
            tools: ['read', 'bash', 'edit', 'write'],
        });
    });

    it('falls back to Bash when PowerShell is unavailable on Windows', function () {
        expect(
            resolveBkperAgentTools(undefined, 'win32', {
                bash: true,
                powershell: false,
            })
        ).to.deep.equal({
            tools: ['read', 'bash', 'edit', 'write'],
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
            tools: ['read', 'edit', 'write'],
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

    it('persists Bkper agent defaults when no user settings are present', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({}),
            getProjectSettings: () => ({}),
            setShowCacheMissNotices,
            setTuiMode,
        });

        expect(setShowCacheMissNotices.calledOnceWithExactly(true)).to.be.true;
        expect(setTuiMode.calledOnceWithExactly('fullscreen')).to.be.true;
    });

    it('preserves explicit global Bkper agent settings', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({showCacheMissNotices: false, tuiMode: 'regular'}),
            getProjectSettings: () => ({}),
            setShowCacheMissNotices,
            setTuiMode,
        });

        expect(setShowCacheMissNotices.called).to.be.false;
        expect(setTuiMode.called).to.be.false;
    });

    it('preserves explicit project Bkper agent settings', function () {
        const setShowCacheMissNotices = sinon.stub();
        const setTuiMode = sinon.stub();

        applyBkperAgentSettingsDefaults({
            getGlobalSettings: () => ({}),
            getProjectSettings: () => ({showCacheMissNotices: false, tuiMode: 'regular'}),
            setShowCacheMissNotices,
            setTuiMode,
        });

        expect(setShowCacheMissNotices.called).to.be.false;
        expect(setTuiMode.called).to.be.false;
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
