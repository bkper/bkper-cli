import {expect, getTestPaths} from '../helpers/test-setup.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DefaultResourceLoader, SettingsManager} from '@earendil-works/pi-coding-agent';
import {withContextAgentsFiles, withContextSkills} from '../../../src/agent/context-resources.js';

const {__dirname} = getTestPaths(import.meta.url);
/** The agent context fixture shared with the managed agent (bkper-clients), with the same expected merge. */
const FIXTURE = path.join(__dirname, '..', 'fixtures', 'agent-context');
type Scope = 'domain' | 'user' | 'book';
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'expected.json'), 'utf8')) as {
    agents: Scope[];
    skills: Record<string, Scope>;
    collisions: Array<{name: string; winner: Scope; loser: Scope}>;
};

describe('agent context loading rules (shared fixture with the managed agent)', function () {
    let root: string;
    let folders: {domain: string; user: string; book: string};
    let agentDir: string;
    let project: string;

    beforeEach(function () {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-context-fixture-')));
        // `bkper context pull` keeps the domain's clone beside the user's, and with -b <bookId> the Book's; `bkper agent`
        // loads the domain's and the user's, and with -b <bookId> the Book's.
        folders = {
            domain: path.join(root, 'context', 'domain'),
            user: path.join(root, 'context', 'user'),
            book: path.join(root, 'context', 'books', 'agtzBook'),
        };
        agentDir = path.join(root, 'agent');
        project = path.join(root, 'project');
        fs.cpSync(path.join(FIXTURE, 'domain'), folders.domain, {recursive: true});
        fs.cpSync(path.join(FIXTURE, 'user'), folders.user, {recursive: true});
        fs.cpSync(path.join(FIXTURE, 'book'), folders.book, {recursive: true});
        fs.mkdirSync(path.join(project, '.git'), {recursive: true});
        fs.mkdirSync(agentDir);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it("loads the Book's context over the user's over the domain's through Pi's own loader, as the managed agent does", async function () {
        const loader = new DefaultResourceLoader({
            cwd: project,
            agentDir,
            settingsManager: SettingsManager.inMemory(),
            noExtensions: true,
            noPromptTemplates: true,
            noThemes: true,
            skillsOverride: base => withContextSkills(base, folders),
            agentsFilesOverride: base => withContextAgentsFiles(base, agentDir, folders),
        });
        await loader.reload();

        const scopeOf = (file: string): Scope | undefined =>
            (['domain', 'user', 'book'] as const).find(scope => file.startsWith(folders[scope] + path.sep));
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
        const order = (item: {name: string; loser?: string}) => `${item.name} ${item.loser}`;
        const collisions = diagnostics
            .flatMap(item =>
                item.type === 'collision' && item.collision
                    ? [{name: item.collision.name, winner: scopeOf(item.collision.winnerPath), loser: scopeOf(item.collision.loserPath)}]
                    : []
            )
            .sort((a, b) => order(a).localeCompare(order(b)));
        expect(collisions).to.deep.equal(expected.collisions);
    });
});
