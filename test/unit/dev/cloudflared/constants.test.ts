import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import {
    LINUX_BINARIES,
    MACOS_BINARIES,
    WINDOWS_BINARIES,
    RELEASE_BASE,
} from '../../../../src/dev/cloudflared/constants.js';

describe('cloudflared constants', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    describe('platform binary mappings', function () {
        it('should have Linux binaries for common architectures', function () {
            expect(LINUX_BINARIES['x64']).to.equal('cloudflared-linux-amd64');
            expect(LINUX_BINARIES['arm64']).to.equal('cloudflared-linux-arm64');
        });

        it('should have macOS binaries for common architectures', function () {
            expect(MACOS_BINARIES['x64']).to.equal('cloudflared-darwin-amd64.tgz');
            expect(MACOS_BINARIES['arm64']).to.equal('cloudflared-darwin-arm64.tgz');
        });

        it('should have Windows binaries for common architectures', function () {
            expect(WINDOWS_BINARIES['x64']).to.equal('cloudflared-windows-amd64.exe');
        });
    });

    describe('release URL', function () {
        it('should point to GitHub releases', function () {
            expect(RELEASE_BASE).to.equal('https://github.com/cloudflare/cloudflared/releases/');
        });
    });
});
