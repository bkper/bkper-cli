import { expect } from '../helpers/test-setup.js';
import path from 'path';
import {
    getSkillsDirectory,
    getSkillsStateFile,
} from '../../../src/commands/skills.js';

describe('skills paths', function () {
    it('should use the agnostic .agents skills directory', function () {
        const home = '/tmp/user-home';
        expect(getSkillsDirectory(home)).to.equal(path.join(home, '.agents', 'skills'));
    });

    it('should colocate state file inside the skills directory', function () {
        const home = '/tmp/user-home';
        expect(getSkillsStateFile(home)).to.equal(
            path.join(home, '.agents', 'skills', '.bkper-skills.yaml')
        );
    });
});
