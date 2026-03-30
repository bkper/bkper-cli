import { expect } from '../helpers/test-setup.js';
import {
    bumpVersion,
    normalizeTagVersion,
    resolveNextVersion,
} from '../../../src/release/versioning.js';

describe('release versioning', function () {
    describe('normalizeTagVersion', function () {
        it('should strip a leading v from tag versions', function () {
            expect(normalizeTagVersion('v4.11.3')).to.equal('4.11.3');
        });

        it('should accept plain semver versions', function () {
            expect(normalizeTagVersion('4.11.3')).to.equal('4.11.3');
        });

        it('should throw on invalid versions', function () {
            expect(() => normalizeTagVersion('release-4.11.3')).to.throw(
                'Invalid semver version: release-4.11.3'
            );
        });
    });

    describe('bumpVersion', function () {
        it('should bump patch versions', function () {
            expect(bumpVersion('4.11.3', 'patch')).to.equal('4.11.4');
        });

        it('should bump minor versions', function () {
            expect(bumpVersion('4.11.3', 'minor')).to.equal('4.12.0');
        });

        it('should bump major versions', function () {
            expect(bumpVersion('4.11.3', 'major')).to.equal('5.0.0');
        });

        it('should throw on invalid current versions', function () {
            expect(() => bumpVersion('4.11', 'patch')).to.throw('Invalid semver version: 4.11');
        });
    });

    describe('resolveNextVersion', function () {
        it('should prefer the latest tag version when present', function () {
            expect(resolveNextVersion('v4.11.3', '4.11.2', 'patch')).to.equal('4.11.4');
        });

        it('should fall back to package version when no tag exists', function () {
            expect(resolveNextVersion(null, '1.0.0', 'minor')).to.equal('1.1.0');
        });
    });
});
