import { App } from 'bkper-js';
import sinon from 'sinon';
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

    it('should preserve hidden and tags in the SDK App update while changing webhookUrlDev', async function () {
        const payload = {
            id: 'my-app',
            hidden: true,
            tags: ['Currencies', 'Finance & Accounting'],
            webhookUrlDev: 'https://old.example.com/events',
        };
        const app = new App(payload, {});
        const updater = { getApp: sinon.stub().resolves(app) };
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves(new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        try {
            await updateWebhookUrlDev('my-app', 'https://example.trycloudflare.com/events', updater);

            expect(fetchStub.calledOnce).to.equal(true);
            const [url, options] = fetchStub.firstCall.args;
            expect(new URL(String(url)).pathname).to.equal('/v5/apps');
            expect(options?.method).to.equal('PUT');
            expect(JSON.parse(String(options?.body))).to.deep.equal({
                ...payload,
                webhookUrlDev: 'https://example.trycloudflare.com/events',
            });
        } finally {
            fetchStub.restore();
        }
    });
});
