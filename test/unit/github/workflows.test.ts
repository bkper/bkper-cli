import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { expect, getTestPaths } from '../helpers/test-setup.js';

const { __dirname } = getTestPaths(import.meta.url);
const repoRoot = path.resolve(__dirname, '../../..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

function readDeliveryWorkflow(): unknown {
    const content = fs.readFileSync(
        path.join(workflowsDir, 'bkper-cli-delivery.yml'),
        'utf8'
    );
    const workflow: unknown = YAML.parse(content);
    return workflow;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(
    source: Record<string, unknown>,
    key: string
): Record<string, unknown> {
    const value = source[key];
    if (!isRecord(value)) {
        throw new Error(`Expected ${key} to be an object`);
    }
    return value;
}

function getString(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    if (typeof value !== 'string') {
        throw new Error(`Expected ${key} to be a string`);
    }
    return value;
}

function getStringArray(source: Record<string, unknown>, key: string): string[] {
    const value = source[key];
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new Error(`Expected ${key} to be a string array`);
    }
    return value;
}

function getStepCommands(job: Record<string, unknown>): string[] {
    const steps = job.steps;
    if (!Array.isArray(steps)) {
        throw new Error('Expected job steps to be an array');
    }

    return steps
        .filter(isRecord)
        .map(step => step.run)
        .filter((run): run is string => typeof run === 'string');
}

describe('github delivery workflow', function () {
    it('guards npm publishing behind version-tag releases with OIDC provenance', function () {
        const workflow = readDeliveryWorkflow();
        if (!isRecord(workflow)) {
            throw new Error('Expected workflow to be an object');
        }

        const onConfig = getRecord(workflow, 'on');
        const push = getRecord(onConfig, 'push');
        const release = getRecord(getRecord(workflow, 'jobs'), 'release');
        const permissions = getRecord(release, 'permissions');
        const releaseCommands = getStepCommands(release);

        expect(getStringArray(push, 'tags')).to.deep.equal(['v*.*.*']);
        expect(getString(release, 'if')).to.match(/github\.event_name\s*==\s*'push'/);
        expect(getString(release, 'if')).to.match(/refs\/tags\/v/);
        expect(permissions.contents).to.equal('read');
        expect(permissions['id-token']).to.equal('write');
        expect(
            releaseCommands.some(
                command =>
                    /npm\s+publish\b/.test(command) &&
                    /--provenance\b/.test(command) &&
                    /--access\s+public\b/.test(command)
            )
        ).to.equal(true);
    });
});
