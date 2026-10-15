import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import { buildAgentEntryCommandArgs } from '../../../src/agent/agent-command-runner.js';

describe('agent command runner', function () {
    const builtRunnerPath = path.join('repo', 'lib', 'agent', 'agent-command-runner.js');
    const bundledEntryPath = path.join('repo', 'lib', 'agent', 'bundle', 'agent-entry.js');

    it('should run the bundled agent with the current Node exec arguments when the build produced one', function () {
        const exists = (file: string) => file === bundledEntryPath;

        expect(
            buildAgentEntryCommandArgs(builtRunnerPath, ['--enable-source-maps'], ['--help'], exists)
        ).to.deep.equal(['--enable-source-maps', bundledEntryPath, '--help']);
    });

    it('should run the compiled agent entrypoint when there is no bundle, as with tsc --watch', function () {
        expect(
            buildAgentEntryCommandArgs(builtRunnerPath, [], ['--help'], () => false)
        ).to.deep.equal([path.join('repo', 'lib', 'agent', 'agent-entry.js'), '--help']);
    });

    it('should run the source agent entrypoint when the CLI is executed through ts-node', function () {
        const runnerPath = path.join('repo', 'src', 'agent', 'agent-command-runner.ts');

        expect(
            buildAgentEntryCommandArgs(runnerPath, ['--loader', 'ts-node/esm'], [], () => true)
        ).to.deep.equal([
            '--loader',
            'ts-node/esm',
            path.join('repo', 'src', 'agent', 'agent-entry.ts'),
        ]);
    });
});
