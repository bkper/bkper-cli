import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { UnsupportedPlatformError } from '../../../../src/dev/cloudflared/install.js';

describe('cloudflared install', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    describe('UnsupportedPlatformError', function () {
        it('should be an instance of Error', function () {
            const error = new UnsupportedPlatformError('test message');
            expect(error).to.be.instanceOf(Error);
            expect(error.name).to.equal('UnsupportedPlatformError');
            expect(error.message).to.equal('test message');
        });
    });
});
