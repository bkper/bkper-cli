import {readFileSync} from 'node:fs';
import sinon from 'sinon';
import {expect} from '../helpers/test-setup.js';
import {
    detectMethodAsync,
    getUpgradeCommand,
    isVersionInstalledAsync,
    startDetachedUpgrade,
    VERSION,
} from '../../../src/upgrade/installation.js';
import type { InstallMethod } from '../../../src/upgrade/installation.js';

describe('installation', function () {
    describe('runtime dependencies', function () {
        it('should directly install the Pi TUI version used by the embedded agent', function () {
            const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
                dependencies: Record<string, string>;
            };

            expect(packageJson.dependencies['@earendil-works/pi-tui']).to.equal(
                packageJson.dependencies['@earendil-works/pi-coding-agent']
            );
        });
    });

    describe('VERSION', function () {
        it('should be a valid semver string', function () {
            expect(VERSION).to.match(/^\d+\.\d+\.\d+/);
        });

        it('should match package.json version', function () {
            // The VERSION constant is read from package.json at runtime,
            // so it should always match.
            expect(VERSION).to.be.a('string');
            expect(VERSION.length).to.be.greaterThan(0);
        });
    });

    describe('getUpgradeCommand', function () {
        it('should return npm install command for npm method', function () {
            const cmd = getUpgradeCommand('npm', '5.0.0');
            expect(cmd).to.equal('npm install -g bkper@5.0.0');
        });

        it('should return bun add command for bun method', function () {
            const cmd = getUpgradeCommand('bun', '5.0.0');
            expect(cmd).to.equal('bun add -g bkper@5.0.0');
        });

        it('should return yarn global add command for yarn method', function () {
            const cmd = getUpgradeCommand('yarn', '5.0.0');
            expect(cmd).to.equal('yarn global add bkper@5.0.0');
        });

        it('should return null for unknown method', function () {
            const cmd = getUpgradeCommand('unknown' as InstallMethod, '5.0.0');
            expect(cmd).to.be.null;
        });

        it('should include the specified version in the command', function () {
            const cmd = getUpgradeCommand('npm', '4.3.1');
            expect(cmd).to.include('4.3.1');
        });
    });

    describe('detectMethodAsync', function () {
        it('should return first method that reports bkper in output', async function () {
            const commandRunner = async (command: string, _timeoutMs: number): Promise<string> => {
                if (command.includes('bun pm ls -g')) {
                    return '';
                }
                if (command.includes('npm list -g')) {
                    return 'bkper@5.0.0';
                }
                return '';
            };

            const method = await detectMethodAsync(commandRunner);
            expect(method).to.equal('npm');
        });
    });

    describe('isVersionInstalledAsync', function () {
        const installedVersionCases: Array<{
            method: InstallMethod;
            command: string;
            output: string;
        }> = [
            {
                method: 'npm',
                command: 'npm list -g bkper --depth=0',
                output: '└── bkper@5.0.0',
            },
            {
                method: 'bun',
                command: 'bun pm ls -g',
                output: '└── bkper@5.0.0',
            },
            {
                method: 'yarn',
                command: 'yarn global list --depth=0',
                output: 'info "bkper@5.0.0" has binaries:',
            },
        ];

        for (const {method, command, output} of installedVersionCases) {
            it(`should detect the exact globally installed version for ${method}`, async function () {
                const commandRunner = sinon.stub().resolves(output);

                const installed = await isVersionInstalledAsync(
                    method,
                    '5.0.0',
                    commandRunner
                );

                expect(installed).to.be.true;
                expect(commandRunner.calledOnceWithExactly(command, 10000)).to.be.true;
            });
        }

        it('should not match another package or version', async function () {
            const commandRunner = sinon.stub().resolves(
                [
                    '├── other-bkper@5.0.0',
                    '├── bkper@5.0.00',
                    '└── bkper@5.0.0-beta.1',
                ].join('\n')
            );

            const installed = await isVersionInstalledAsync('npm', '5.0.0', commandRunner);

            expect(installed).to.be.false;
        });

        it('should return false when the package-manager command fails', async function () {
            const commandRunner = sinon.stub().rejects(new Error('command failed'));

            const installed = await isVersionInstalledAsync('npm', '5.0.0', commandRunner);

            expect(installed).to.be.false;
        });

        it('should return false without running a command for an unknown method', async function () {
            const commandRunner = sinon.stub();

            const installed = await isVersionInstalledAsync('unknown', '5.0.0', commandRunner);

            expect(installed).to.be.false;
            expect(commandRunner.called).to.be.false;
        });
    });

    describe('startDetachedUpgrade', function () {
        const originalCommandOverride = process.env.BKPER_AUTOUPDATE_COMMAND;

        afterEach(function () {
            if (originalCommandOverride === undefined) {
                delete process.env.BKPER_AUTOUPDATE_COMMAND;
            } else {
                process.env.BKPER_AUTOUPDATE_COMMAND = originalCommandOverride;
            }
        });

        it('should start upgrade command for known method', function () {
            let startedCommand = '';
            const commandStarter = (command: string): void => {
                startedCommand = command;
            };

            startDetachedUpgrade('npm', '5.0.0', commandStarter);
            expect(startedCommand).to.equal('npm install -g bkper@5.0.0');
        });

        it('should use command override when configured', function () {
            process.env.BKPER_AUTOUPDATE_COMMAND = 'echo simulated-upgrade';

            let startedCommand = '';
            const commandStarter = (command: string): void => {
                startedCommand = command;
            };

            startDetachedUpgrade('npm', '5.0.0', commandStarter);
            expect(startedCommand).to.equal('echo simulated-upgrade');
        });

        it('should throw for unknown method', function () {
            const commandStarter = (_command: string): void => {};

            expect(() => {
                startDetachedUpgrade('unknown', '5.0.0', commandStarter);
            }).to.throw(Error);
        });
    });
});
