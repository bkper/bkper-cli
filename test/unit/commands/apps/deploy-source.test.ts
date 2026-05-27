import { expect, getTestPaths } from '../../helpers/test-setup.js';

const { __dirname } = getTestPaths(import.meta.url);

describe('CLI - apps deploy source paths', function () {
    let resolveSourceDeployPaths: typeof import('../../../../src/commands/apps/deploy.js').resolveSourceDeployPaths;
    let buildPlatformDeployMetadata: typeof import('../../../../src/commands/apps/deploy.js').buildPlatformDeployMetadata;

    before(async function () {
        const deployModule = await import('../../../../src/commands/apps/deploy.js');
        resolveSourceDeployPaths = deployModule.resolveSourceDeployPaths;
        buildPlatformDeployMetadata = deployModule.buildPlatformDeployMetadata;
    });

    it('should resolve server bundle and assets paths', function () {
        const result = resolveSourceDeployPaths({
            server: 'server/src/index.ts',
            client: 'client',
        });

        expect(result.bundlePath).to.include('dist/server/index.js');
        expect(result.bundleDir).to.include('dist/server');
        expect(result.assetsDir).to.include('dist/client');
    });

    it('should resolve server bundle path without assets', function () {
        const result = resolveSourceDeployPaths({
            server: 'server/src/index.ts',
        });

        expect(result.bundlePath).to.include('dist/server/index.js');
        expect(result.bundleDir).to.include('dist/server');
        expect(result.assetsDir).to.be.undefined;
    });

    it('should throw when server worker is missing', function () {
        expect(() =>
            resolveSourceDeployPaths({
                server: '',
            })
        ).to.throw('No server worker configured');
    });

    it('should build platform metadata with KV binding and compatibility date', function () {
        const metadata = buildPlatformDeployMetadata({
            server: 'server/src/index.ts',
            services: ['KV'],
            compatibilityDate: '2026-01-29',
        });

        expect(metadata).to.deep.equal({
            bindings: {
                kv_namespaces: [{ binding: 'KV' }],
            },
            compatibility_date: '2026-01-29',
        });
    });

    it('should omit platform metadata when no deploy metadata is configured', function () {
        const metadata = buildPlatformDeployMetadata({
            server: 'server/src/index.ts',
        });

        expect(metadata).to.be.undefined;
    });
});
