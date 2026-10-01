import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DefaultResourceLoader, SettingsManager} from '@earendil-works/pi-coding-agent';
import {expect} from '../../helpers/test-setup.js';
import {
    BKPER_THEME_SETTING,
    getBkperThemesDir,
    resolveBkperInitialThemeSetting,
} from '../../../../src/agent/interactive/themes.js';

type ThemeFile = {
    name: string;
    vars?: Record<string, string | number>;
    colors: Record<string, string | number>;
};

type ThemeSchema = {
    properties: {colors: {required: string[]; properties: Record<string, unknown>}};
};

const COLOR_LITERAL = /^(#|okhsl\(|oklch\()/;

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

// Pi validates theme files against this schema only in its own CLI, not for SDK hosts like Bkper.
function readPiThemeSchema(): ThemeSchema {
    const piEntry = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
    return readJson<ThemeSchema>(
        path.join(path.dirname(piEntry), 'modes', 'interactive', 'theme', 'theme-schema.json')
    );
}

describe('Bkper agent themes', function () {
    it('define every color token Pi requires, and only known tokens and variables', function () {
        const schema = readPiThemeSchema().properties.colors;

        for (const name of BKPER_THEME_SETTING.split('/')) {
            const theme = readJson<ThemeFile>(path.join(getBkperThemesDir(), `${name}.json`));
            expect(theme.name).to.equal(name);
            expect(Object.keys(theme.colors)).to.include.members(schema.required);
            expect(Object.keys(schema.properties)).to.include.members(Object.keys(theme.colors));
            for (const [token, value] of Object.entries(theme.colors)) {
                if (typeof value === 'string' && value !== '' && !COLOR_LITERAL.test(value)) {
                    expect(theme.vars, `${name}.${token}`).to.have.property(value);
                }
            }
        }
    });

    it('loads the bundled light and dark themes in Pi without diagnostics', async function () {
        const agentDir = mkdtempSync(path.join(tmpdir(), 'bkper-themes-'));
        try {
            const loader = new DefaultResourceLoader({
                cwd: agentDir,
                agentDir,
                settingsManager: SettingsManager.inMemory(),
                additionalThemePaths: [getBkperThemesDir()],
                noExtensions: true,
                noSkills: true,
                noPromptTemplates: true,
                noContextFiles: true,
            });
            await loader.reload();

            const {themes, diagnostics} = loader.getThemes();
            const names = themes.map(theme => theme.name);
            expect(diagnostics).to.deep.equal([]);
            for (const name of BKPER_THEME_SETTING.split('/')) {
                expect(names).to.include(name);
            }
        } finally {
            rmSync(agentDir, {recursive: true, force: true});
        }
    });

    it('uses Bkper themes in place of Pi built-in themes but keeps custom themes', function () {
        const resolve = (theme?: string) =>
            resolveBkperInitialThemeSetting(
                SettingsManager.inMemory(theme === undefined ? {} : {theme})
            );

        expect(resolve()).to.equal(BKPER_THEME_SETTING);
        expect(resolve('system')).to.equal(BKPER_THEME_SETTING);
        expect(resolve('dark')).to.equal('bkper-dark');
        expect(resolve('light')).to.equal('bkper-light');
        expect(resolve('light/dark')).to.equal(BKPER_THEME_SETTING);
        expect(resolve('light/my-dark')).to.equal('bkper-light/my-dark');
        expect(resolve('my-theme')).to.equal(undefined);
        expect(resolve('bkper-dark')).to.equal(undefined);
    });
});
