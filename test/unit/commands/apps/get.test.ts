import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import { AppData, MockApp } from '../../helpers/mock-interfaces.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { loadApps } from '../../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);
const mockApps: AppData[] = loadApps(__dirname);

const { getApp } = await import('../../../../src/commands/apps/index.js');

describe('CLI - app get Command', function () {
    let capturedAppId: string | undefined;
    let mockApp: MockApp;

    beforeEach(function () {
        setupTestEnvironment();
        capturedAppId = undefined;

        const appData = mockApps[0];
        mockApp = {
            json: (): AppData => appData,
            getId: (): string | undefined => appData.id,
            getName: (): string | undefined => appData.name,
            isPublished: (): boolean => appData.published || false,
        };

        setMockBkper({
            setConfig: () => {},
            getApp: async (appId: string): Promise<MockApp> => {
                capturedAppId = appId;
                return mockApp;
            },
        });
    });

    it('should request the app by id', async function () {
        await getApp('app-tax-bot');

        expect(capturedAppId).to.equal('app-tax-bot');
    });

    it('should return the app', async function () {
        const result = await getApp('app-tax-bot');

        expect(result).to.equal(mockApp);
    });

    it('should return proper json representation', async function () {
        const result = await getApp('app-tax-bot');
        const json = result.json();

        expect(json).to.deep.equal(mockApps[0]);
    });
});
