import { expect } from '../helpers/test-setup.js';
import { shouldRunAgentCommand } from '../../../src/agent/cli-dispatch.js';

describe('agent cli dispatch', function () {
    it('should not treat bare bkper as an agent command', function () {
        expect(shouldRunAgentCommand(['node', 'bkper'])).to.be.false;
    });

    it('should not treat top-level help as an agent command', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', '--help'])).to.be.false;
    });

    it('should detect agent command invocations', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', 'agent'])).to.be.true;
    });

    it('should detect agent command invocations with pi flags', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', 'agent', '--help'])).to.be.true;
    });
});
