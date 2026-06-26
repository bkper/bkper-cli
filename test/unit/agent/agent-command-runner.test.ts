import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import { buildAgentEntryCommandArgs } from '../../../src/agent/agent-command-runner.js';

describe('agent command runner', function () {
    it('should run the built agent entrypoint with the current Node exec arguments', function () {
        const runnerPath = path.join('repo', 'lib', 'agent', 'agent-command-runner.js');

        expect(buildAgentEntryCommandArgs(runnerPath, ['--enable-source-maps'], ['--help']))
            .to.deep.equal([
                '--enable-source-maps',
                path.join('repo', 'lib', 'agent', 'agent-entry.js'),
                '--help',
            ]);
    });

    it('should run the source agent entrypoint when the CLI is executed through ts-node', function () {
        const runnerPath = path.join('repo', 'src', 'agent', 'agent-command-runner.ts');

        expect(buildAgentEntryCommandArgs(runnerPath, ['--loader', 'ts-node/esm'], []))
            .to.deep.equal([
                '--loader',
                'ts-node/esm',
                path.join('repo', 'src', 'agent', 'agent-entry.ts'),
            ]);
    });
});
