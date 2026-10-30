import {expect} from '../helpers/test-setup.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {Skill} from '@earendil-works/pi-coding-agent';
import {withUserContextAgentsFile, withUserContextSkills} from '../../../src/agent/context-resources.js';

describe('agent user context resources', function () {
    let root: string;
    let clone: string;
    let agentDir: string;

    const skillFile = (name: string, description = `About ${name}.`) => {
        const folder = path.join(clone, '.agents', 'skills', name);
        fs.mkdirSync(folder, {recursive: true});
        fs.writeFileSync(path.join(folder, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\nBody\n`);
    };
    const projectSkill = (name: string): Skill => ({
        name,
        description: 'From the project.',
        filePath: `/project/.agents/skills/${name}/SKILL.md`,
        baseDir: `/project/.agents/skills/${name}`,
        sourceInfo: {path: `/project/.agents/skills/${name}/SKILL.md`, source: 'local', scope: 'project', origin: 'top-level'},
        disableModelInvocation: false,
    });

    beforeEach(function () {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-context-resources-'));
        clone = path.join(root, 'context', 'user');
        agentDir = path.join(root, 'agent');
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it('changes nothing without a clone', function () {
        const base = {skills: [projectSkill('close')], diagnostics: []};
        expect(withUserContextSkills(base, clone)).to.deep.equal(base);
        const files = {agentsFiles: [{path: '/project/AGENTS.md', content: 'Project'}]};
        expect(withUserContextAgentsFile(files, clone, agentDir)).to.deep.equal(files);
    });

    it("adds the clone's skills after the project's, which win on a name collision", function () {
        skillFile('close');
        skillFile('report');
        const result = withUserContextSkills({skills: [projectSkill('close')], diagnostics: []}, clone);
        expect(result.skills.map(skill => [skill.name, skill.filePath])).to.deep.equal([
            ['close', '/project/.agents/skills/close/SKILL.md'],
            ['report', path.join(clone, '.agents', 'skills', 'report', 'SKILL.md')],
        ]);
        expect(result.diagnostics.map(item => item.type)).to.deep.equal(['collision']);
    });

    it('keeps at most 50 skills from the clone, by name, with a warning', function () {
        for (let index = 0; index < 52; index++) skillFile(`skill-${String(index).padStart(2, '0')}`);
        const result = withUserContextSkills({skills: [], diagnostics: []}, clone);
        expect(result.skills).to.have.length(50);
        expect(result.skills.at(-1)?.name).to.equal('skill-49');
        expect(result.diagnostics.filter(item => item.type === 'warning')).to.have.length(1);
    });

    it("places the user's AGENTS.md after the global one and before the project's, cut at 16,000 characters", function () {
        fs.mkdirSync(clone, {recursive: true});
        fs.writeFileSync(path.join(clone, 'AGENTS.md'), 'x'.repeat(16010));
        const global = {path: path.join(agentDir, 'AGENTS.md'), content: 'Global'};
        const project = {path: '/project/AGENTS.md', content: 'Project'};
        const result = withUserContextAgentsFile({agentsFiles: [global, project]}, clone, agentDir);
        expect(result.agentsFiles.map(file => file.path)).to.deep.equal([global.path, path.join(clone, 'AGENTS.md'), project.path]);
        expect(result.agentsFiles[1]?.content.startsWith('x'.repeat(16000))).to.equal(true);
        expect(result.agentsFiles[1]?.content).to.contain('truncated');
        expect(result.agentsFiles[1]?.content.length).to.be.lessThan(16100);
    });
});
