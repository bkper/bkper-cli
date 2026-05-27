import { expect } from '../helpers/test-setup.js';
import { replaceMyAppInObject, updateEventHandlers } from '../../../src/commands/apps/init.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('app init helpers', function () {
    describe('replaceMyAppInObject', function () {
        it('should replace my-app in plain strings', function () {
            const result = replaceMyAppInObject('https://my-app.bkper.app/logo.svg', 'tax-bot');
            expect(result).to.equal('https://tax-bot.bkper.app/logo.svg');
        });

        it('should replace my-app in nested objects', function () {
            const input = {
                id: 'my-app',
                branding: {
                    logoUrl: 'https://my-app.bkper.app/logo.svg',
                    website: 'https://my-app.bkper.app',
                },
            };
            const result = replaceMyAppInObject(input, 'inventory-bot') as typeof input;
            expect(result.id).to.equal('inventory-bot');
            expect(result.branding.logoUrl).to.equal('https://inventory-bot.bkper.app/logo.svg');
            expect(result.branding.website).to.equal('https://inventory-bot.bkper.app');
        });

        it('should replace my-app in arrays', function () {
            const input = ['my-app', 'https://my-app.bkper.app/events'];
            const result = replaceMyAppInObject(input, 'exchange-bot') as string[];
            expect(result[0]).to.equal('exchange-bot');
            expect(result[1]).to.equal('https://exchange-bot.bkper.app/events');
        });

        it('should leave unrelated strings unchanged', function () {
            const input = {
                description: 'A Bkper app that does something useful',
                ownerName: 'Bkper',
            };
            const result = replaceMyAppInObject(input, 'subledger-bot') as typeof input;
            expect(result.description).to.equal('A Bkper app that does something useful');
            expect(result.ownerName).to.equal('Bkper');
        });

        it('should handle numbers and booleans without error', function () {
            const input = {
                port: 8787,
                active: true,
                url: 'https://my-app.bkper.app',
            };
            const result = replaceMyAppInObject(input, 'test-app') as typeof input;
            expect(result.port).to.equal(8787);
            expect(result.active).to.be.true;
            expect(result.url).to.equal('https://test-app.bkper.app');
        });
    });

    describe('updateEventHandlers', function () {
        let tempDir: string;

        beforeEach(function () {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-init-test-'));
        });

        afterEach(function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should replace single-quoted my-app in event handlers', function () {
            const eventsDir = path.join(tempDir, 'server/src/handlers');
            fs.mkdirSync(eventsDir, { recursive: true });
            const handlerPath = path.join(eventsDir, 'transaction-checked.ts');
            fs.writeFileSync(
                handlerPath,
                "if (agentId === 'my-app') { return { result: false }; }",
                'utf8'
            );

            updateEventHandlers(tempDir, 'portfolio-bot');

            const content = fs.readFileSync(handlerPath, 'utf8');
            expect(content).to.equal("if (agentId === 'portfolio-bot') { return { result: false }; }");
        });

        it('should replace double-quoted my-app in event handlers', function () {
            const eventsDir = path.join(tempDir, 'server/src');
            fs.mkdirSync(eventsDir, { recursive: true });
            const handlerPath = path.join(eventsDir, 'handler.ts');
            fs.writeFileSync(
                handlerPath,
                'if (agentId === "my-app") { return { result: false }; }',
                'utf8'
            );

            updateEventHandlers(tempDir, 'tax-bot');

            const content = fs.readFileSync(handlerPath, 'utf8');
            expect(content).to.equal('if (agentId === "tax-bot") { return { result: false }; }');
        });

        it('should skip files without my-app placeholder', function () {
            const eventsDir = path.join(tempDir, 'server/src');
            fs.mkdirSync(eventsDir, { recursive: true });
            const handlerPath = path.join(eventsDir, 'handler.ts');
            const original = 'if (agentId === "other-app") { return { result: false }; }';
            fs.writeFileSync(handlerPath, original, 'utf8');

            updateEventHandlers(tempDir, 'tax-bot');

            const content = fs.readFileSync(handlerPath, 'utf8');
            expect(content).to.equal(original);
        });

        it('should do nothing when server source directory does not exist', function () {
            expect(() => updateEventHandlers(tempDir, 'any-app')).to.not.throw();
        });
    });
});
