import type {AgentSessionEvent} from '@earendil-works/pi-coding-agent';
import {Container, Text} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    installPendingUserMessage,
    type PendingUserMessageHost,
} from '../../../../src/agent/interactive/pending-user-message.js';

function setup() {
    const chatContainer = new Container();
    const earlier = new Text('earlier message');
    chatContainer.addChild(earlier);
    const requestRender = sinon.spy();
    const prompt = sinon.stub().resolves();
    const host: PendingUserMessageHost = {
        chatContainer,
        ui: {requestRender},
        session: {prompt, isStreaming: false, isCompacting: false},
        addMessageToChat(message) {
            const text =
                typeof message.content === 'string'
                    ? message.content
                    : message.content
                          .filter(block => block.type === 'text')
                          .map(block => block.text)
                          .join('');
            chatContainer.addChild(new Text(text));
        },
        async rebindCurrentSession() {},
        async handleEvent(event) {
            if (event.type === 'message_start' && event.message.role === 'user') {
                this.addMessageToChat(event.message);
            }
        },
    };
    const restore = installPendingUserMessage(host);
    return {host, prompt, chatContainer, earlier, requestRender, restore};
}

function userStart(text: string): AgentSessionEvent {
    return {
        type: 'message_start',
        message: {role: 'user', content: text, timestamp: 1},
    };
}

describe('pending user message', function () {
    it('renders before prompt preflight finishes, then replaces the preview with canonical content', async function () {
        const test = setup();
        let finish!: () => void;
        test.prompt.callsFake(
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                })
        );
        const submitted = test.host.session.prompt('review it');

        expect(test.chatContainer.render(80).join('\n')).to.include('review it');
        expect(test.requestRender.called).to.equal(true);
        expect(test.prompt.calledOnceWithExactly('review it', undefined)).to.equal(true);
        // Preflight may transform the prompt or add image hints.
        await test.host.handleEvent(userStart('expanded prompt'));
        expect(test.chatContainer.render(80).join('\n')).not.to.include('review it');
        expect(test.chatContainer.render(80).join('\n')).to.include('expanded prompt');
        expect(test.chatContainer.children).to.have.length(2);
        finish();
        await submitted;
        expect(test.chatContainer.children).to.have.length(2);
        test.restore();
    });

    it('cleans up intercepted inputs without removing other UI entries', async function () {
        const test = setup();
        const notice = new Text('extension notice');
        test.prompt.callsFake(async () => {
            test.chatContainer.addChild(notice);
        });
        await test.host.session.prompt('intercepted');
        expect(test.chatContainer.children).to.deep.equal([test.earlier, notice]);
        test.restore();
    });

    it('cleans up rejected inputs and propagates the original error', async function () {
        const test = setup();
        const error = new Error('authentication failed');
        test.prompt.rejects(error);
        let caught: unknown;
        try {
            await test.host.session.prompt('review it');
        } catch (err) {
            caught = err;
        }
        expect(caught).to.equal(error);
        expect(test.chatContainer.children).to.deep.equal([test.earlier]);
        test.restore();
    });

    it('does not preview commands, queued prompts, or extension-originated messages', async function () {
        const test = setup();
        test.prompt.callsFake(async () => {
            expect(test.chatContainer.children).to.deep.equal([test.earlier]);
        });
        await test.host.session.prompt('/login');
        await test.host.session.prompt('!pwd');
        await test.host.session.prompt('   ');
        await test.host.session.prompt('extension message', {source: 'extension'});
        test.host.session.isStreaming = true;
        await test.host.session.prompt('steering', {streamingBehavior: 'steer'});
        test.host.session.isStreaming = false;
        test.host.session.isCompacting = true;
        await test.host.session.prompt('compacting');
        expect(test.requestRender.called).to.equal(false);
        test.restore();
    });

    it('rebinds the preview to a replacement session and restores the old session method', async function () {
        const test = setup();
        let finish!: () => void;
        const nextPrompt = sinon.stub().callsFake(
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                })
        );
        const previousSession = test.host.session;
        test.host.session = {prompt: nextPrompt, isStreaming: false, isCompacting: false};
        await test.host.rebindCurrentSession?.({renderBeforeBind: true});
        expect(previousSession.prompt).to.equal(test.prompt);
        const submitted = test.host.session.prompt('new session');
        expect(test.chatContainer.render(80).join('\n')).to.include('new session');
        expect(nextPrompt.calledOnce).to.equal(true);
        test.restore();
        expect(test.host.session.prompt).to.equal(nextPrompt);
        finish();
        await submitted;
    });

    it('restores original methods and removes an outstanding preview on disposal', async function () {
        const test = setup();
        let finish!: () => void;
        test.prompt.callsFake(
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                })
        );
        const submitted = test.host.session.prompt('pending');
        test.restore();
        expect(test.host.session.prompt).to.equal(test.prompt);
        expect(test.chatContainer.children).to.deep.equal([test.earlier]);
        await test.host.handleEvent(userStart('canonical'));
        finish();
        await submitted;
        expect(test.chatContainer.children).to.have.length(2);
    });
});
