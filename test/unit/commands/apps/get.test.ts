import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import { AppData, MockApp } from '../../helpers/mock-interfaces.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { loadApps } from '../../helpers/fixture-loader.js';

const { __dirname } = getTestPaths(import.meta.url);
const mockApps: AppData[] = loadApps(__dirname);

const { getApp, getAppFormatted } = await import('../../../../src/commands/apps/index.js');

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

    it('should give the readme once, as Markdown, with the rest of the app', async function () {
        const appData: AppData = {
            id: 'exchange-bot',
            description: 'Convert transactions between currency books',
            website: 'https://exchange-bot.bkper.app',
            readme: '<p>Long readme</p>',
            readmeMd: 'Long readme',
        };
        mockApp = { ...mockApp, json: (): AppData => appData };

        const result = await getAppFormatted('exchange-bot');

        expect(result).to.deep.equal({
            id: 'exchange-bot',
            description: 'Convert transactions between currency books',
            website: 'https://exchange-bot.bkper.app',
            readmeMd: 'Long readme',
        });
        expect(appData.readme).to.equal('<p>Long readme</p>');
    });

});
