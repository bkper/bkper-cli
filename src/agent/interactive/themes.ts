import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Pi theme setting that picks the Bkper light or dark theme from the terminal's appearance. */
export const BKPER_THEME_SETTING = 'bkper-light/bkper-dark';

/** Directory of the bundled Bkper themes; `lib/agent/themes` in builds, `src/agent/themes` in sources. */
export function getBkperThemesDir(
    moduleDir: string = path.dirname(fileURLToPath(import.meta.url))
): string {
    return path.resolve(moduleDir, '..', 'themes');
}

const [BKPER_LIGHT_THEME, BKPER_DARK_THEME] = BKPER_THEME_SETTING.split('/');

/** Bkper's counterpart of a Pi built-in theme in a light or dark slot, or the theme itself. */
function toBkperTheme(theme: string, appearance: 'light' | 'dark'): string {
    if (theme === 'light') return BKPER_LIGHT_THEME;
    if (theme === 'dark') return BKPER_DARK_THEME;
    if (theme === 'system') return appearance === 'light' ? BKPER_LIGHT_THEME : BKPER_DARK_THEME;
    return theme;
}

/**
 * The theme setting for this invocation. Pi saves one of its built-in themes (system, dark, or
 * light) at first run, so those are replaced by their Bkper counterparts; custom themes are kept.
 * Nothing is saved, because Bkper shares its settings file with Pi, which does not load these themes.
 */
export function resolveBkperInitialThemeSetting(settingsManager: {
    getThemeSetting(): string | undefined;
}): string | undefined {
    const setting = settingsManager.getThemeSetting();
    if (setting === undefined || setting === 'system') {
        return BKPER_THEME_SETTING;
    }

    const slots = setting.split('/');
    const resolved =
        slots.length === 2
            ? `${toBkperTheme(slots[0], 'light')}/${toBkperTheme(slots[1], 'dark')}`
            : toBkperTheme(setting, 'dark');
    return resolved === setting ? undefined : resolved;
}
