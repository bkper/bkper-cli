import type {
    AgentSessionRuntimeDiagnostic,
    TuiMode,
} from '@earendil-works/pi-coding-agent';

type SettingsError = {
    scope: 'global' | 'project';
    error: Error;
};

type BkperAgentSettingsDefaultsManager = {
    getGlobalSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
    };
    getProjectSettings(): {
        showCacheMissNotices?: boolean;
        tuiMode?: TuiMode;
    };
    setShowCacheMissNotices(show: boolean): void;
    setTuiMode(mode: TuiMode): void;
};

export function applyBkperAgentSettingsDefaults(
    settingsManager: BkperAgentSettingsDefaultsManager
): void {
    const globalSettings = settingsManager.getGlobalSettings();
    const projectSettings = settingsManager.getProjectSettings();
    const hasExplicitCacheMissNotices = [
        globalSettings.showCacheMissNotices,
        projectSettings.showCacheMissNotices,
    ].some(value => value !== undefined);
    const hasExplicitTuiMode = [globalSettings.tuiMode, projectSettings.tuiMode].some(
        value => value !== undefined
    );

    if (!hasExplicitCacheMissNotices) {
        settingsManager.setShowCacheMissNotices(true);
    }

    if (!hasExplicitTuiMode) {
        settingsManager.setTuiMode('fullscreen');
    }
}

export function collectSettingsDiagnostics(
    settingsManager: {drainErrors(): SettingsError[]},
    context: string
): AgentSessionRuntimeDiagnostic[] {
    return settingsManager.drainErrors().map(({scope, error}) => ({
        type: 'warning',
        message: `(${context}, ${scope} settings) ${error.message}`,
    }));
}

export function createStartupSessionManager<TSessionManager>(
    cwd: string,
    settingsManager: {getSessionDir(): string | undefined},
    createSessionManager: (cwd: string, sessionDir?: string) => TSessionManager
): TSessionManager {
    return createSessionManager(cwd, settingsManager.getSessionDir());
}
