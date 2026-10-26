import {stripVTControlCharacters} from 'node:util';
import sinon from 'sinon';
import {expect} from '../helpers/test-setup.js';
import {
    AgentStartupError,
    reportAgentCommandError,
} from '../../../src/agent/startup-error.js';

describe('reportAgentCommandError', function () {
    it('reports a startup error as Pi does', function () {
        const log = sinon.stub();

        reportAgentCommandError(new AgentStartupError('File not found: /tmp/x'), log);

        expect(log.callCount).to.equal(1);
        expect(stripVTControlCharacters(log.firstCall.args[0])).to.equal(
            'Error: File not found: /tmp/x'
        );
    });

    it('reports other errors with their details', function () {
        const log = sinon.stub();
        const error = new Error('boom');

        reportAgentCommandError(error, log);

        expect(log.firstCall.args).to.deep.equal(['Error running agent command:', error]);
    });
});
