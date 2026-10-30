import {expect, getTestPaths} from '../helpers/test-setup.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DefaultResourceLoader, SettingsManager} from '@earendil-works/pi-coding-agent';
import {withUserContextAgentsFile, withUserContextSkills} from '../../../src/agent/context-resources.js';

const {__dirname} = getTestPaths(import.meta.url);
/** The agent context fixture shared with the managed agent (bkper-clients), with the same expected merge. */
const FIXTURE = path.join(__dirname, '..', 'fixtures', 'agent-context');
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'expected.json'), 'utf8')) as {
    agents: Array<'user' | 'book'>;
    skills: Record<string, 'user' | 'book'>;
    collisions: Array<{name: string; winner: 'user' | 'book'; loser: 'user' | 'book'}>;
};

describe('agent context loading rules (shared fixture with the managed agent)', function () {
    let root: string;
    let folders: {user: string; book: string};
    let agentDir: string;

    beforeEach(function () {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-context-fixture-')));
        folders = {user: path.join(root, 'context', 'user'), book: path.join(root, 'acme')};
        agentDir = path.join(root, 'agent');
        fs.cpSync(path.join(FIXTURE, 'user'), folders.user, {recursive: true});
        // A Book clone, where the person runs the agent: Pi's project.
        fs.cpSync(path.join(FIXTURE, 'book'), folders.book, {recursive: true});
        fs.mkdirSync(path.join(folders.book, '.git'));
        fs.mkdirSync(agentDir);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it("loads the Book clone over the user's context in Pi's own order, as the managed agent does", async function () {
        const loader = new DefaultResourceLoader({
            cwd: folders.book,
            agentDir,
            // Pi's default: a trusted project's skills load (Pi asks the person to trust a new folder).
            settingsManager: SettingsManager.inMemory(),
            noExtensions: true,
            noPromptTemplates: true,
            noThemes: true,
            skillsOverride: base => withUserContextSkills(base, folders.user),
            agentsFilesOverride: base => withUserContextAgentsFile(base, folders.user, agentDir),
        });
        await loader.reload();

        const scopeOf = (file: string) =>
            file.startsWith(folders.book + path.sep) ? 'book' : file.startsWith(folders.user + path.sep) ? 'user' : undefined;
        const agents = loader
            .getAgentsFiles()
            .agentsFiles.map(file => scopeOf(file.path))
            .filter(Boolean);
        expect(agents).to.deep.equal(expected.agents);

        const {skills, diagnostics} = loader.getSkills();
        const loaded = Object.fromEntries(
            skills.flatMap(skill => (scopeOf(skill.filePath) ? [[skill.name, scopeOf(skill.filePath)]] : []))
        );
        expect(loaded).to.deep.equal(expected.skills);
        const collisions = diagnostics.flatMap(item =>
            item.type === 'collision' && item.collision
                ? [{name: item.collision.name, winner: scopeOf(item.collision.winnerPath), loser: scopeOf(item.collision.loserPath)}]
                : []
        );
        expect(collisions).to.deep.equal(expected.collisions);
    });
});
