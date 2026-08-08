import path from 'node:path';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    applyBkperAgentSettingsDefaults,
    createStartupSessionManager,
} from '../../../../src/agent/interactive/settings.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

describe('interactive agent settings', function () {
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
