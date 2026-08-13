import { expect } from '../helpers/test-setup.js';
import {
    getAgentGuidanceDisplayPath,
    validateAgentGuidance,
    type AppInitTarget,
} from '../../../src/commands/apps/init.js';

const STANDARDS_START = '<!-- APP_STANDARDS:START -->';
const STANDARDS_END = '<!-- APP_STANDARDS:END -->';
const SPECIFICS_START = '<!-- APP_SPECIFICS:START -->';
const SPECIFICS_END = '<!-- APP_SPECIFICS:END -->';

function guidance(...markers: string[]): string {
    return markers.join('\n');
}

describe('app init agent guidance', function () {
    it('accepts one ordered pair for each guidance section without checking its contents', function () {
        const contents = guidance(
            STANDARDS_START,
            '# Editable standards',
            STANDARDS_END,
            SPECIFICS_START,
            '# App-specific decisions',
            SPECIFICS_END
        );

        expect(validateAgentGuidance(contents)).to.deep.equal([]);
    });

    for (const [name, contents] of [
        [
            'missing markers',
            guidance(STANDARDS_START, STANDARDS_END, SPECIFICS_START),
        ],
        [
            'duplicate markers',
            guidance(
                STANDARDS_START,
                STANDARDS_END,
                SPECIFICS_START,
                SPECIFICS_END,
                SPECIFICS_END
            ),
        ],
        [
            'malformed markers',
            guidance(
                '<!-- APP_STANDARDS:BEGIN -->',
                STANDARDS_END,
                SPECIFICS_START,
                SPECIFICS_END
            ),
        ],
        [
            'nested sections',
            guidance(
                STANDARDS_START,
                SPECIFICS_START,
                STANDARDS_END,
                SPECIFICS_END
            ),
        ],
        [
            'incorrect section order',
            guidance(
                SPECIFICS_START,
                SPECIFICS_END,
                STANDARDS_START,
                STANDARDS_END
            ),
        ],
    ] as const) {
        it(`rejects ${name}`, function () {
            expect(validateAgentGuidance(contents)).not.to.deep.equal([]);
        });
    }

    it('uses explicit relative AGENTS.md paths for agent handoff', function () {
        const currentTarget: AppInitTarget = {
            appName: 'current-app',
            targetDir: '/tmp/current-app',
            displayTarget: '.',
        };
        const childTarget: AppInitTarget = {
            appName: 'child-app',
            targetDir: '/tmp/child-app',
            displayTarget: 'child-app',
        };

        expect(getAgentGuidanceDisplayPath(currentTarget)).to.equal('./AGENTS.md');
        expect(getAgentGuidanceDisplayPath(childTarget)).to.equal('./child-app/AGENTS.md');
    });
});
