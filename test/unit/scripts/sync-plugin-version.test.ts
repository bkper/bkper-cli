import { expect } from '../helpers/test-setup.js';
import { syncClaudePluginVersions } from '../../../scripts/sync-plugin-version.js';

describe('sync Claude plugin version metadata', function () {
    it('should align the skill plugin version and omit duplicate marketplace plugin versions', function () {
        const result = syncClaudePluginVersions(
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
                        source: './skill',
                        version: '4.17.3',
                    },
                    {
                        name: 'other-plugin',
                        source: './other-plugin',
                        version: '1.0.0',
                    },
                ],
            }
        );

        expect(result.pluginManifest.version).to.equal('5.0.0');
        expect(result.marketplaceManifest.plugins).to.deep.equal([
            {
                name: 'bkper-cli',
                source: './skill',
            },
            {
                name: 'other-plugin',
                source: './other-plugin',
                version: '1.0.0',
            },
        ]);
    });
});
