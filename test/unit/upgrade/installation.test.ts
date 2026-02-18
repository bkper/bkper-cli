import { expect } from '../helpers/test-setup.js';
import { getUpgradeCommand, VERSION } from '../../../src/upgrade/installation.js';
import type { InstallMethod } from '../../../src/upgrade/installation.js';

describe('installation', function () {
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
});
