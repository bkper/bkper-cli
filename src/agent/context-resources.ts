import fs from 'node:fs';
import path from 'node:path';
import {
    loadSkillsFromDir,
    type ResourceDiagnostic,
    type Skill,
} from '@earendil-works/pi-coding-agent';
import {getUserContextDir} from '../commands/context/user-context.js';

/**
 * The user's agent context clone (`~/.bkper/context/user`, kept up to date by `bkper context pull` and startup maintenance)
 * in Pi's own resources: its skills and its AGENTS.md, read again at every start and `/reload`. Limits as the managed
 * agent's: AGENTS.md at most 16,000 characters, at most 50 skills.
 */
export const MAX_CONTEXT_AGENTS_CHARS = 16000;
export const MAX_CONTEXT_SKILLS = 50;

type SkillsResult = {skills: Skill[]; diagnostics: ResourceDiagnostic[]};
type AgentsFiles = {agentsFiles: Array<{path: string; content: string}>};

/**
 * Pi's skills, then the clone's, in name order. Pi keeps the first skill of a name, so a project's (a Book clone's) and
 * the user's own local skills win over the context's.
 */
export function withUserContextSkills(base: SkillsResult, dir: string = getUserContextDir()): SkillsResult {
    const skillsDir = path.join(dir, '.agents', 'skills');
    if (!fs.existsSync(skillsDir)) return base;
    const loaded = loadSkillsFromDir({dir: skillsDir, source: 'bkper-context'});
    const sorted = [...loaded.skills].sort((a, b) => a.name.localeCompare(b.name));
    const diagnostics = [...base.diagnostics, ...loaded.diagnostics];
    if (sorted.length > MAX_CONTEXT_SKILLS) {
        diagnostics.push({
            type: 'warning',
            message: `${sorted.length} skills in your agent context; only the first ${MAX_CONTEXT_SKILLS}, by name, load`,
            path: skillsDir,
        });
    }
    const skills = [...base.skills];
    for (const skill of sorted.slice(0, MAX_CONTEXT_SKILLS)) {
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
    return {skills, diagnostics};
}

/**
 * Pi's context files with the clone's AGENTS.md after the global one (Pi's agent directory) and before the project's,
 * which are more specific and win on conflict.
 */
export function withUserContextAgentsFile(
    base: AgentsFiles,
    dir: string = getUserContextDir(),
    agentDir: string
): AgentsFiles {
    const file = path.join(dir, 'AGENTS.md');
    let content: string;
    try {
        content = fs.readFileSync(file, 'utf8');
    } catch {
        return base;
    }
    if (content.length > MAX_CONTEXT_AGENTS_CHARS) {
        content =
            content.slice(0, MAX_CONTEXT_AGENTS_CHARS) +
            `\n\n[AGENTS.md truncated at ${MAX_CONTEXT_AGENTS_CHARS} characters]`;
    }
    const global = base.agentsFiles.filter(item => path.dirname(item.path) === path.resolve(agentDir));
    const rest = base.agentsFiles.filter(item => !global.includes(item) && item.path !== file);
    return {agentsFiles: [...global, {path: file, content}, ...rest]};
}
