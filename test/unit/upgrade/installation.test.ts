import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {expect} from '../helpers/test-setup.js';
import {
    detectInstallMethod,
    getInstallCommand,
    getSelfUpdatePlan,
    inferNpmPrefix,
    readInstalledVersion,
    VERSION,
} from '../../../src/upgrade/installation.js';
import type {
    InstallMethod,
    ManualPlan,
    RuntimeLocation,
    SelfUpdateEnvironment,
    SelfUpdatePlan,
} from '../../../src/upgrade/installation.js';

function expectManual(plan: SelfUpdatePlan): ManualPlan {
    if (plan.kind !== 'manual') {
        throw new Error(`Expected a manual plan, got ${plan.kind}`);
    }
    return plan;
}

function location(packageDir: string, overrides: Partial<RuntimeLocation> = {}): RuntimeLocation {
    return {
        packageDir,
        entrypoint: path.join(packageDir, 'lib', 'cli.js'),
        execPath: '/usr/bin/node',
        isBunRuntime: false,
        platform: 'linux',
        ...overrides,
    };
}

function environment(
    homedir: string,
    commandOutputs: Record<string, string> = {},
    overrides: Partial<SelfUpdateEnvironment> = {}
): SelfUpdateEnvironment {
    return {
        homedir,
        readCommandOutput: command => commandOutputs[command],
        isWritable: () => true,
        ...overrides,
    };
}

function writePackage(packageDir: string, version: string): void {
    fs.mkdirSync(path.join(packageDir, 'lib'), {recursive: true});
    fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({name: 'bkper', version})
    );
}

describe('installation', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-install-')));
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    describe('runtime dependencies', function () {
        it('should load Pi TUI and Pi AI through the embedded agent instead of installing second copies', function () {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
                dependencies: Record<string, string>;
                devDependencies: Record<string, string>;
            };
            const piVersion = packageJson.dependencies['@earendil-works/pi-coding-agent'];

            for (const name of ['@earendil-works/pi-tui', '@earendil-works/pi-ai']) {
                expect(packageJson.dependencies, name).not.to.have.property(name);
                // Types come from the dev copy, so it must match the runtime the agent loads.
                expect(packageJson.devDependencies[name], name).to.equal(piVersion);
            }
        });
    });

    describe('VERSION', function () {
        it('should be a valid semver string', function () {
            expect(VERSION).to.match(/^\d+\.\d+\.\d+/);
        });
    });

    describe('detectInstallMethod', function () {
        const cases: Array<{packageDir: string; expected: InstallMethod; extra?: Partial<RuntimeLocation>}> =
            [
                {
                    packageDir:
                        '/home/u/.local/share/pnpm/global/5/.pnpm/bkper@5.0.0/node_modules/bkper',
                    expected: 'pnpm',
                },
                {packageDir: '/home/u/.config/yarn/global/node_modules/bkper', expected: 'yarn'},
                {packageDir: '/home/u/.bun/install/global/node_modules/bkper', expected: 'bun'},
                {packageDir: '/tmp/somewhere/bkper', expected: 'bun', extra: {isBunRuntime: true}},
                {packageDir: '/usr/local/lib/node_modules/bkper', expected: 'npm'},
                {packageDir: '/home/u/.npm/_npx/abc123/node_modules/bkper', expected: 'npm'},
                {
                    packageDir: 'C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\bkper',
                    expected: 'npm',
                    extra: {platform: 'win32', execPath: 'C:\\Program Files\\nodejs\\node.exe'},
                },
                {packageDir: '/workspace/bkper-cli', expected: 'unknown'},
            ];

        for (const {packageDir, expected, extra} of cases) {
            it(`should detect ${expected} for ${packageDir}`, function () {
                expect(detectInstallMethod(location(packageDir, extra))).to.equal(expected);
            });
        }
    });

    describe('inferNpmPrefix', function () {
        it('should infer the prefix of a global npm install', function () {
            expect(inferNpmPrefix('/usr/local/lib/node_modules/bkper', 'linux')).to.equal(
                '/usr/local'
            );
        });

        it('should not infer a prefix for a project-local install', function () {
            expect(inferNpmPrefix('/home/u/project/node_modules/bkper', 'linux')).to.be
                .undefined;
        });

        it('should not infer a prefix on Windows', function () {
            expect(
                inferNpmPrefix('C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\bkper', 'win32')
            ).to.be.undefined;
        });
    });

    describe('getInstallCommand', function () {
        it('should build the install command for each package manager', function () {
            expect(getInstallCommand('npm', '5.1.0')).to.equal('npm install -g bkper@5.1.0');
            expect(getInstallCommand('npm', '5.1.0', '/opt/my prefix')).to.equal(
                'npm --prefix "/opt/my prefix" install -g bkper@5.1.0'
            );
            expect(getInstallCommand('pnpm', '5.1.0')).to.equal('pnpm add -g bkper@5.1.0');
            expect(getInstallCommand('yarn', '5.1.0')).to.equal('yarn global add bkper@5.1.0');
            expect(getInstallCommand('bun', '5.1.0')).to.equal('bun add -g bkper@5.1.0');
            expect(getInstallCommand('unknown', '5.1.0')).to.be.null;
        });
    });

    describe('getSelfUpdatePlan', function () {
        it('should install into the running global npm prefix', function () {
            const prefix = path.join(tempDir, 'prefix');
            const packageDir = path.join(prefix, 'lib', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');

            const plan = getSelfUpdatePlan('5.1.0', location(packageDir), environment(tempDir));

            expect(plan).to.deep.equal({
                kind: 'install',
                method: 'npm',
                packageDir,
                command: `npm --prefix "${prefix}" install -g bkper@5.1.0`,
                packageJsonPath: path.join(packageDir, 'package.json'),
            });
        });

        it('should verify through the prefix of the running copy when npm root -g points elsewhere', function () {
            const prefix = path.join(tempDir, 'nvm-node-20');
            const packageDir = path.join(prefix, 'lib', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');
            const otherRoot = path.join(tempDir, 'nvm-node-22', 'lib', 'node_modules');
            writePackage(path.join(otherRoot, 'bkper'), '5.0.0');

            const plan = getSelfUpdatePlan(
                '5.1.0',
                location(packageDir),
                environment(tempDir, {'npm root -g': otherRoot})
            );

            expect(plan).to.deep.include({
                kind: 'install',
                command: `npm --prefix "${prefix}" install -g bkper@5.1.0`,
                packageJsonPath: path.join(packageDir, 'package.json'),
            });
        });

        it('should refuse a writable-less global install without suggesting sudo', function () {
            const prefix = path.join(tempDir, 'prefix');
            const packageDir = path.join(prefix, 'lib', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');

            const plan = getSelfUpdatePlan(
                '5.1.0',
                location(packageDir),
                environment(tempDir, {}, {isWritable: () => false})
            );

            const manual = expectManual(plan);
            expect(manual.method).to.equal('npm');
            expect(manual.instruction).to.contain(`npm --prefix "${prefix}" install -g bkper@5.1.0`);
            expect(manual.instruction).to.not.contain('sudo');
        });

        it('should refuse a project-local npm install', function () {
            const packageDir = path.join(tempDir, 'project', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');
            const globalRoot = path.join(tempDir, 'global', 'lib', 'node_modules');
            fs.mkdirSync(globalRoot, {recursive: true});

            const plan = getSelfUpdatePlan(
                '5.1.0',
                location(packageDir),
                environment(tempDir, {'npm root -g': globalRoot})
            );

            expect(expectManual(plan).instruction).to.contain(packageDir);
        });

        it('should refuse a source checkout', function () {
            const packageDir = path.join(tempDir, 'bkper-cli');
            writePackage(packageDir, '5.0.0');

            const plan = getSelfUpdatePlan('5.1.0', location(packageDir), environment(tempDir));

            expect(plan.kind).to.equal('manual');
            expect(plan.method).to.equal('unknown');
        });

        it('should install a global bun copy from bun global directory', function () {
            const packageDir = path.join(tempDir, '.bun', 'install', 'global', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');

            const plan = getSelfUpdatePlan('5.1.0', location(packageDir), environment(tempDir));

            expect(plan).to.deep.include({
                kind: 'install',
                method: 'bun',
                command: 'bun add -g bkper@5.1.0',
                packageJsonPath: path.join(packageDir, 'package.json'),
            });
        });

        it('should verify pnpm upgrades through the global root, not the versioned store path', function () {
            const globalDir = path.join(tempDir, 'pnpm', 'global', '5');
            const storeDir = path.join(globalDir, '.pnpm', 'bkper@5.0.0', 'node_modules', 'bkper');
            const rootNodeModules = path.join(globalDir, 'node_modules');
            writePackage(storeDir, '5.0.0');
            fs.mkdirSync(rootNodeModules, {recursive: true});
            fs.symlinkSync(storeDir, path.join(rootNodeModules, 'bkper'), 'dir');

            const plan = getSelfUpdatePlan(
                '5.1.0',
                location(storeDir, {
                    entrypoint: path.join(rootNodeModules, 'bkper', 'lib', 'cli.js'),
                }),
                environment(tempDir, {'pnpm root -g': rootNodeModules})
            );

            expect(plan).to.deep.include({
                kind: 'install',
                method: 'pnpm',
                command: 'pnpm add -g bkper@5.1.0',
                packageJsonPath: path.join(rootNodeModules, 'bkper', 'package.json'),
            });
        });

        it('should refuse non-npm self-update on Windows', function () {
            const packageDir = path.join(tempDir, '.bun', 'install', 'global', 'node_modules', 'bkper');
            writePackage(packageDir, '5.0.0');

            const plan = getSelfUpdatePlan(
                '5.1.0',
                location(packageDir, {platform: 'win32'}),
                environment(tempDir)
            );

            expect(expectManual(plan).instruction).to.contain('bun add -g bkper@5.1.0');
        });
    });

    describe('readInstalledVersion', function () {
        it('should read the version from disk on every call', function () {
            const packageDir = path.join(tempDir, 'bkper');
            writePackage(packageDir, '5.0.0');
            const packageJsonPath = path.join(packageDir, 'package.json');

            expect(readInstalledVersion(packageJsonPath)).to.equal('5.0.0');
            writePackage(packageDir, '5.1.0');
            expect(readInstalledVersion(packageJsonPath)).to.equal('5.1.0');
        });

        it('should return undefined when the file is missing', function () {
            expect(readInstalledVersion(path.join(tempDir, 'missing.json'))).to.be.undefined;
        });
    });
});
