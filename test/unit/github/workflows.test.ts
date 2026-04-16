import fs from 'fs';
import path from 'path';
import { expect, getTestPaths } from '../helpers/test-setup.js';

const { __dirname } = getTestPaths(import.meta.url);
const repoRoot = path.resolve(__dirname, '../../..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

function readWorkflow(name: string): string {
    return fs.readFileSync(path.join(workflowsDir, name), 'utf8');
}

describe('github workflows', function () {
    it('should not keep a dedicated PR version bump workflow', function () {
        expect(fs.existsSync(path.join(workflowsDir, 'release-pr-version.yml'))).to.equal(false);
    });

    it('should not bump package version on dependabot PR branches', function () {
        const content = readWorkflow('dependabot-automerge-pi-patch.yml');

        expect(content).to.include('Enable auto-merge');
        expect(content).to.not.include('Checkout PR branch');
        expect(content).to.not.include('Bump package version on PR branch');
        expect(content).to.not.include('npm pkg set version=');
    });

    it('should prepare the release version on main after merge', function () {
        const content = readWorkflow('bkper-cli-delivery.yml');

        expect(content).to.include('Prepare release version on main');
        expect(content).to.include('npm pkg set version="$NEXT_VERSION"');
        expect(content).to.include('git add package.json bun.lock');
        expect(content).to.not.include('Validate package version for this release');
    });
});
