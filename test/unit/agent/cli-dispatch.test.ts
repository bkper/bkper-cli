import { expect } from '../helpers/test-setup.js';
import {
    getAgentCommandArgs,
    shouldRunAgentCommand,
    shouldShowHelpForBareInvocation,
} from '../../../src/agent/cli-dispatch.js';

const INTERACTIVE_TTY = {
    stdinIsTTY: true,
    stdoutIsTTY: true,
};

const NON_INTERACTIVE_STDIN = {
    stdinIsTTY: false,
    stdoutIsTTY: true,
};

const NON_INTERACTIVE_STDOUT = {
    stdinIsTTY: true,
    stdoutIsTTY: false,
};

describe('agent cli dispatch', function () {
    it('should treat bare bkper as an agent command when stdin and stdout are TTYs', function () {
        expect(shouldRunAgentCommand(['node', 'bkper'], INTERACTIVE_TTY)).to.be.true;
    });

    it('should not treat bare bkper as an agent command when stdin is not a TTY', function () {
        expect(shouldRunAgentCommand(['node', 'bkper'], NON_INTERACTIVE_STDIN)).to.be.false;
    });

    it('should not treat bare bkper as an agent command when stdout is not a TTY', function () {
        expect(shouldRunAgentCommand(['node', 'bkper'], NON_INTERACTIVE_STDOUT)).to.be.false;
    });

    it('should show help for bare bkper when stdin is not a TTY', function () {
        expect(shouldShowHelpForBareInvocation(['node', 'bkper'], NON_INTERACTIVE_STDIN)).to.be
            .true;
    });

    it('should show help for bare bkper when stdout is not a TTY', function () {
        expect(shouldShowHelpForBareInvocation(['node', 'bkper'], NON_INTERACTIVE_STDOUT)).to.be
            .true;
    });

    it('should not show help for bare bkper when it will start agent mode', function () {
        expect(shouldShowHelpForBareInvocation(['node', 'bkper'], INTERACTIVE_TTY)).to.be.false;
    });

    it('should not treat top-level help as an agent command', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', '--help'], INTERACTIVE_TTY)).to.be.false;
    });

    it('should detect agent command invocations', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', 'agent'], NON_INTERACTIVE_STDIN)).to.be
            .true;
    });

    it('should detect agent command invocations with pi flags', function () {
        expect(shouldRunAgentCommand(['node', 'bkper', 'agent', '--help'], NON_INTERACTIVE_STDIN))
            .to.be.true;
    });

    it('should pass no Pi args for bare bkper agent dispatch', function () {
        expect(getAgentCommandArgs(['node', 'bkper'])).to.deep.equal([]);
    });

    it('should pass only args after the agent command for explicit agent dispatch', function () {
        expect(getAgentCommandArgs(['node', 'bkper', 'agent', '--help'])).to.deep.equal([
            '--help',
        ]);
    });
});
