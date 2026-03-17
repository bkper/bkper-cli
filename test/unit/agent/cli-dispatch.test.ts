import { expect } from '../helpers/test-setup.js';
import { shouldStartAgentMode } from '../../../src/agent/cli-dispatch.js';

describe('agent cli dispatch', function () {
    it('should start agent mode when there are no arguments and terminal is interactive', function () {
        expect(
            shouldStartAgentMode(['node', 'bkper'], {
                stdinIsTTY: true,
                stdoutIsTTY: true,
            })
        ).to.be.true;
    });

    it('should not start agent mode when there are cli arguments', function () {
        expect(
            shouldStartAgentMode(['node', 'bkper', '--help'], {
                stdinIsTTY: true,
                stdoutIsTTY: true,
            })
        ).to.be.false;
    });

    it('should not start agent mode when stdin is not a tty', function () {
        expect(
            shouldStartAgentMode(['node', 'bkper'], {
                stdinIsTTY: false,
                stdoutIsTTY: true,
            })
        ).to.be.false;
    });

    it('should not start agent mode when stdout is not a tty', function () {
        expect(
            shouldStartAgentMode(['node', 'bkper'], {
                stdinIsTTY: true,
                stdoutIsTTY: false,
            })
        ).to.be.false;
    });
});
