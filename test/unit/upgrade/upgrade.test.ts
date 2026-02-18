import { expect } from '../helpers/test-setup.js';
import { isNewerVersion } from '../../../src/upgrade/upgrade.js';

describe('upgrade', function () {
    describe('isNewerVersion', function () {
        it('should return true when latest patch is higher', function () {
            expect(isNewerVersion('4.3.0', '4.3.1')).to.be.true;
        });

        it('should return true when latest minor is higher', function () {
            expect(isNewerVersion('4.3.0', '4.4.0')).to.be.true;
        });

        it('should return true when latest major is higher', function () {
            expect(isNewerVersion('4.3.0', '5.0.0')).to.be.true;
        });

        it('should return false when versions are equal', function () {
            expect(isNewerVersion('4.3.0', '4.3.0')).to.be.false;
        });

        it('should return false when current is newer', function () {
            expect(isNewerVersion('4.3.1', '4.3.0')).to.be.false;
        });

        it('should return false when current minor is higher', function () {
            expect(isNewerVersion('4.4.0', '4.3.9')).to.be.false;
        });

        it('should return false when current major is higher', function () {
            expect(isNewerVersion('5.0.0', '4.99.99')).to.be.false;
        });

        it('should handle single-digit versions', function () {
            expect(isNewerVersion('1.0.0', '2.0.0')).to.be.true;
        });

        it('should handle large version numbers', function () {
            expect(isNewerVersion('10.20.30', '10.20.31')).to.be.true;
        });
    });
});
