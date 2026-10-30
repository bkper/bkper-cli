import fs from 'node:fs';
import path from 'node:path';
import {
    loadSkillsFromDir,
    type ResourceDiagnostic,
    type Skill,
} from '@earendil-works/pi-coding-agent';
import {getUserContextDir} from '../commands/context/user-context.js';

/**
 * Agent context clones (`~/.bkper/context/user`, and with `bkper agent -b <bookId>` the Book's in
 * `~/.bkper/context/books/<bookId>`, kept up to date by `bkper context pull` and startup maintenance) in Pi's own resources:
 * their skills and AGENTS.md, read again at every start and `/reload`. Limits as the managed agent's: AGENTS.md at most
 * 16,000 characters, at most 50 skills, per scope.
 */
export const MAX_CONTEXT_AGENTS_CHARS = 16000;
export const MAX_CONTEXT_SKILLS = 50;

type SkillsResult = {skills: Skill[]; diagnostics: ResourceDiagnostic[]};
type AgentsFiles = {agentsFiles: Array<{path: string; content: string}>};
/** The clones a session loads: the user's, and the Book's it works on. */
export interface ContextDirs {
    user: string;
    book?: string;
}

const defaultDirs = (): ContextDirs => ({user: getUserContextDir()});

/** One clone's skills, in name order, at most 50, with a warning beyond. */
function cloneSkills(dir: string, whose: string): SkillsResult {
    const skillsDir = path.join(dir, '.agents', 'skills');
    if (!fs.existsSync(skillsDir)) return {skills: [], diagnostics: []};
    const loaded = loadSkillsFromDir({dir: skillsDir, source: 'bkper-context'});
    const sorted = [...loaded.skills].sort((a, b) => a.name.localeCompare(b.name));
    const diagnostics = [...loaded.diagnostics];
    if (sorted.length > MAX_CONTEXT_SKILLS) {
        diagnostics.push({
            type: 'warning',
            message: `${sorted.length} skills in ${whose}; only the first ${MAX_CONTEXT_SKILLS}, by name, load`,
            path: skillsDir,
        });
    }
    return {skills: sorted.slice(0, MAX_CONTEXT_SKILLS), diagnostics};
}

/**
 * Pi's skills, then the Book's, then the user's. Pi keeps the first skill of a name, so a project's and the person's own
 * local skills win over the context's, and a Book's over the user's (as in the managed agent).
 */
export function withContextSkills(base: SkillsResult, dirs: ContextDirs = defaultDirs()): SkillsResult {
    const skills = [...base.skills];
    const diagnostics = [...base.diagnostics];
    const clones = [
        ...(dirs.book ? [{dir: dirs.book, whose: "this Book's agent context"}] : []),
        {dir: dirs.user, whose: 'your agent context'},
    ];
    for (const {dir, whose} of clones) {
        const loaded = cloneSkills(dir, whose);
        diagnostics.push(...loaded.diagnostics);
        for (const skill of loaded.skills) {
            const winner = skills.find(existing => existing.name === skill.name);
            if (!winner) {
                skills.push(skill);
                continue;
            }
            diagnostics.push({
                type: 'collision',
                message: `name "${skill.name}" collision`,
                path: skill.filePath,
                collision: {resourceType: 'skill', name: skill.name, winnerPath: winner.filePath, loserPath: skill.filePath},
            });
        }
    }
    return {skills, diagnostics};
}

/** A clone's AGENTS.md, cut at 16,000 characters; undefined without one. */
function agentsFile(dir: string): {path: string; content: string} | undefined {
    const file = path.join(dir, 'AGENTS.md');
    let content: string;
    try {
        content = fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
    if (content.length > MAX_CONTEXT_AGENTS_CHARS) {
        content =
            content.slice(0, MAX_CONTEXT_AGENTS_CHARS) +
            `\n\n[AGENTS.md truncated at ${MAX_CONTEXT_AGENTS_CHARS} characters]`;
    }
    return {path: file, content};
}

/**
 * Pi's context files with the user's AGENTS.md, then the Book's, after the global one (Pi's agent directory) and before the
 * project's: later is more specific and wins on conflict.
 */
export function withContextAgentsFiles(
    base: AgentsFiles,
    agentDir: string,
    dirs: ContextDirs = defaultDirs()
): AgentsFiles {
    const added = [dirs.user, ...(dirs.book ? [dirs.book] : [])].flatMap(dir => agentsFile(dir) ?? []);
    if (!added.length) return base;
    const paths = new Set(added.map(file => file.path));
    const global = base.agentsFiles.filter(item => path.dirname(item.path) === path.resolve(agentDir));
    const rest = base.agentsFiles.filter(item => !global.includes(item) && !paths.has(item.path));
    return {agentsFiles: [...global, ...added, ...rest]};
}

/**
 * With `bkper agent -b <bookId>`: which Book the session works on, and where its context clone is. Its AGENTS.md and skills
 * are loaded beside the user's.
 */
export function bookContextNote(bookId: string, dir: string): string {
    return [
        '## Book agent context',
        '',
        `This session works on Book ${bookId}. Its agent context clone is ${dir}: its AGENTS.md and .agents/skills say how that ` +
            'Book works, for everyone who can view it, and load with your other context. Its procedures apply to that Book only. It never ' +
            'holds Book data, documents or reports. Pushing publishes to everyone who can view the Book (only its editors can ' +
            'push): before pushing, show the user the diff and who it affects. If a push is rejected, pull, rebase and ask again; ' +
            'never force-push.',
    ].join('\n');
}
