import fs from 'fs';
import path from 'path';
import { expect, getTestPaths } from '../helpers/test-setup.js';

interface PackageJsonData {
    scripts?: Record<string, string>;
}

const { __dirname } = getTestPaths(import.meta.url);
const repoRoot = path.resolve(__dirname, '../../..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const packageJsonPath = path.join(repoRoot, 'package.json');

function readWorkflow(name: string): string {
    return fs.readFileSync(path.join(workflowsDir, name), 'utf8');
}

function readPackageJson(): PackageJsonData {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJsonData;
}

describe('github workflows', function () {
    it('should not keep a dedicated PR version bump workflow', function () {
        expect(fs.existsSync(path.join(workflowsDir, 'release-pr-version.yml'))).to.equal(false);
    });

    it('should keep dependabot pi PRs as standard dependency updates', function () {
        const content = readWorkflow('dependabot-automerge-pi-patch.yml');

        expect(content).to.include('@mariozechner/pi-coding-agent');
        expect(content).to.include('Enable auto-merge');
        expect(content).to.not.include('Apply patch release label');
        expect(content).to.not.include('--add-label');
        expect(content).to.not.include('npm pkg set version=');
    });

    it('should publish only from version tags', function () {
        const content = readWorkflow('bkper-cli-delivery.yml');

        expect(content).to.include("tags: ['v*.*.*']");
        expect(content).to.include("startsWith(github.ref, 'refs/tags/v')");
        expect(content).to.include('Validate release tag matches package version');
        expect(content).to.include('Ensure tagged commit is on main');
        expect(content).to.include('git merge-base --is-ancestor');
        expect(content).to.include("registry-url: 'https://registry.npmjs.org'");
        expect(content).to.include('Upgrade npm');
        expect(content).to.include('npm install -g npm@11.11.0');
        expect(content).to.not.include('listPullRequestsAssociatedWithCommit');
        expect(content).to.not.include('release:patch');
        expect(content).to.not.include('npm pkg set version=');
        expect(content).to.not.include('git push origin HEAD:main');
        expect(content).to.not.include('Push release tag');
        expect(content).to.not.include('npm install -g npm@11.12.1');
        expect(content).to.not.include('Ensure tokenless OIDC publishing context');
        expect(content).to.not.include('rm -f .npmrc ~/.npmrc');
    });

    it('should expose npm version release helpers', function () {
        const packageJson = readPackageJson();

        expect(packageJson.scripts).to.not.equal(undefined);
        expect(packageJson.scripts?.['release:patch']).to.equal(
            'npm version patch -m "chore(release): v%s"'
        );
        expect(packageJson.scripts?.['release:minor']).to.equal(
            'npm version minor -m "chore(release): v%s"'
        );
        expect(packageJson.scripts?.['release:major']).to.equal(
            'npm version major -m "chore(release): v%s"'
        );
    });
});
