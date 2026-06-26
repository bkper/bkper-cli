import { expect } from '../helpers/test-setup.js';
import {
    getUnsupportedNodeVersionMessage,
    isSupportedNodeVersion,
    MINIMUM_NODE_VERSION,
} from '../../../src/utils/node-version.js';

describe('node version support', function () {
    it('should accept the minimum supported Node.js version and newer versions', function () {
        expect(MINIMUM_NODE_VERSION).to.equal('22.19.0');
        expect(isSupportedNodeVersion('v22.19.0')).to.be.true;
        expect(isSupportedNodeVersion('v22.19.1')).to.be.true;
        expect(isSupportedNodeVersion('v22.20.0')).to.be.true;
        expect(isSupportedNodeVersion('v23.0.0')).to.be.true;
    });

    it('should reject Node.js versions older than the minimum supported version', function () {
        expect(isSupportedNodeVersion('v20.19.6')).to.be.false;
        expect(isSupportedNodeVersion('v22.18.9')).to.be.false;
    });

    it('should build an upgrade message for unsupported Node.js versions', function () {
        const message = getUnsupportedNodeVersionMessage('v20.19.6');

        expect(message).to.contain('Bkper CLI requires Node.js >= 22.19.0.');
        expect(message).to.contain('Current Node.js version: v20.19.6');
        expect(message).to.contain('npm install -g bkper@latest');
    });

    it('should not build an upgrade message for supported Node.js versions', function () {
        expect(getUnsupportedNodeVersionMessage('v22.19.0')).to.equal(undefined);
    });
});
