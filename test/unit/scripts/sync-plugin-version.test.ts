import { expect } from '../helpers/test-setup.js';
import { syncPluginVersions } from '../../../scripts/sync-plugin-version.js';

describe('sync plugin version metadata', function () {
    it('should align plugin versions and omit duplicate marketplace versions', function () {
        const result = syncPluginVersions(
            '5.0.0',
            {
                name: 'bkper-cli',
                version: '4.17.3',
                description: 'Plugin description',
            },
            {
                name: 'bkper',
                plugins: [
                    {
                        name: 'bkper-cli',
                        source: './',
                        version: '4.17.3',
                    },
                    {
                        name: 'other-plugin',
                        source: './other-plugin',
                        version: '1.0.0',
                    },
                ],
            },
            {
                name: 'bkper-cli',
                version: '4.17.3',
                description: 'Codex plugin description',
            }
        );

        expect(result.claudePluginManifest.version).to.equal('5.0.0');
        expect(result.codexPluginManifest.version).to.equal('5.0.0');
        expect(result.claudeMarketplaceManifest.plugins).to.deep.equal([
            {
                name: 'bkper-cli',
                source: './',
            },
            {
                name: 'other-plugin',
                source: './other-plugin',
                version: '1.0.0',
            },
        ]);
    });

    it('should reject mismatched Claude and Codex plugin names', function () {
        expect(() =>
            syncPluginVersions(
                '5.0.0',
                {name: 'bkper-cli'},
                {plugins: []},
                {name: 'other-plugin'}
            )
        ).to.throw('Claude and Codex plugin names must match');
    });
});
