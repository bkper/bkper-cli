import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { updateWebhookUrlDev } from '../../../src/dev/webhook-dev.js';

class FakeApp {
    public webhookUrlDev?: string | null;
    public updated = false;

    setWebhookUrlDev(url: string | null): this {
        this.webhookUrlDev = url;
        return this;
    }

    async update(): Promise<void> {
        this.updated = true;
    }
}

describe('updateWebhookUrlDev', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should update webhookUrlDev for the app', async function () {
        const app = new FakeApp();
        let capturedId: string | undefined;

        const updater = {
            async getApp(appId: string): Promise<FakeApp> {
                capturedId = appId;
                return app;
            },
        };

        await updateWebhookUrlDev('my-app', 'https://example.trycloudflare.com/events', updater);

        expect(capturedId).to.equal('my-app');
        expect(app.webhookUrlDev).to.equal('https://example.trycloudflare.com/events');
        expect(app.updated).to.equal(true);
    });
});
