import type {
    ExtensionAPI,
    InputEvent,
    InputEventResult,
} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    findDefaultBkperVisionModel,
    registerBkperImageFallbackExtension,
    type ImageFallbackDependencies,
} from '../../../../src/agent/extensions/image-fallback.js';

type ImageContent = NonNullable<InputEvent['images']>[number];

type InputHandler = (
    event: {
        text: string;
        images?: ImageContent[];
        source: 'interactive';
    },
    context: TestContext
) => Promise<InputEventResult | void>;

interface TestToolResult {
    content?: Array<{type: 'text'; text: string} | ImageContent>;
}

type ToolResultHandler = (
    event: {
        toolName: string;
        content: Array<{type: 'text'; text: string} | ImageContent>;
        isError: boolean;
        input: Record<string, unknown>;
    },
    context: TestContext
) => Promise<TestToolResult | void>;

interface TestContext {
    model?: {
        provider: string;
        id: string;
        input: Array<'text' | 'image'>;
    };
    signal?: AbortSignal;
    ui: {
        setStatus: sinon.SinonStub;
        notify: sinon.SinonStub;
    };
}

const image: ImageContent = {
    type: 'image',
    data: 'aW1hZ2U=',
    mimeType: 'image/png',
};

function registerFallback(dependencies: ImageFallbackDependencies) {
    let inputHandler: InputHandler | undefined;
    let toolResultHandler: ToolResultHandler | undefined;

    registerBkperImageFallbackExtension(
        {
            on: ((event: string, handler: unknown) => {
                if (event === 'input') {
                    inputHandler = handler as InputHandler;
                }
                if (event === 'tool_result') {
                    toolResultHandler = handler as ToolResultHandler;
                }
            }) as ExtensionAPI['on'],
        },
        dependencies
    );

    expect(inputHandler).to.not.equal(undefined);
    expect(toolResultHandler).to.not.equal(undefined);

    return {
        inputHandler: inputHandler as InputHandler,
        toolResultHandler: toolResultHandler as ToolResultHandler,
    };
}

function createContext(input: Array<'text' | 'image'> = ['text']): TestContext {
    return {
        model: {provider: 'other', id: 'selected-model', input},
        ui: {
            setStatus: sinon.stub(),
            notify: sinon.stub(),
        },
    };
}

describe('agent image fallback', function () {
    it('transcribes attached images for a text-only selected model', async function () {
        const transcribe = sinon.stub().resolves({text: 'A login form with an error.', truncated: false});
        const {inputHandler} = registerFallback({transcribe});
        const context = createContext();

        const result = await inputHandler(
            {text: 'Why can I not log in?', images: [image], source: 'interactive'},
            context
        );

        expect(transcribe.calledOnce).to.equal(true);
        expect(transcribe.firstCall.args[0]).to.deep.equal({
            images: [image],
            userRequest: 'Why can I not log in?',
            signal: undefined,
        });
        expect(result).to.deep.equal({
            action: 'transform',
            text:
                'Why can I not log in?\n\n' +
                '<image_transcription>\nA login form with an error.\n</image_transcription>',
            images: [],
        });
        expect(context.ui.setStatus.firstCall.args).to.deep.equal([
            'bkper-image-fallback',
            'Reading image with Bkper’s default model…',
        ]);
        expect(context.ui.setStatus.lastCall.args).to.deep.equal([
            'bkper-image-fallback',
            undefined,
        ]);
    });

    it('keeps native image handling for a vision-capable selected model', async function () {
        const transcribe = sinon.stub();
        const {inputHandler} = registerFallback({transcribe});

        const result = await inputHandler(
            {text: 'Describe this', images: [image], source: 'interactive'},
            createContext(['text', 'image'])
        );

        expect(result).to.deep.equal({action: 'continue'});
        expect(transcribe.called).to.equal(false);
    });

    it('replaces read-tool images with a persistent transcription', async function () {
        const transcribe = sinon.stub().resolves({text: 'A dashboard showing $42.', truncated: false});
        const {toolResultHandler} = registerFallback({transcribe});

        const result = await toolResultHandler(
            {
                toolName: 'read',
                content: [
                    {
                        type: 'text',
                        text:
                            'Read image file [image/png]\n' +
                            '[Current model does not support images. The image will be omitted from this request.]',
                    },
                    image,
                ],
                isError: false,
                input: {path: '/tmp/dashboard.png'},
            },
            createContext()
        );

        expect(transcribe.firstCall.args[0]).to.deep.equal({
            images: [image],
            userRequest: 'Read image file: /tmp/dashboard.png',
            signal: undefined,
        });
        expect(result?.content).to.deep.equal([
            {
                type: 'text',
                text:
                    'Read image file [image/png]\n\n' +
                    '<image_transcription>\nA dashboard showing $42.\n</image_transcription>',
            },
        ]);
    });

    it('continues with a warning when auxiliary analysis fails', async function () {
        const transcribe = sinon.stub().rejects(new Error('vision unavailable'));
        const {inputHandler} = registerFallback({transcribe});
        const context = createContext();

        const result = await inputHandler(
            {text: 'Describe this', images: [image], source: 'interactive'},
            context
        );

        expect(result).to.deep.equal({
            action: 'transform',
            text:
                'Describe this\n\n' +
                '<image_transcription>\n' +
                'The image could not be analyzed by Bkper’s default model.\n' +
                '</image_transcription>',
            images: [],
        });
        expect(context.ui.notify.calledOnceWithExactly('Image analysis failed.', 'warning')).to.equal(
            true
        );
        expect(context.ui.setStatus.lastCall.args).to.deep.equal([
            'bkper-image-fallback',
            undefined,
        ]);
    });

    it('requires the Bkper default model to support vision', function () {
        expect(() =>
            findDefaultBkperVisionModel([
                {
                    provider: 'bkper',
                    id: 'default-text-model',
                    input: ['text'],
                    bkperDefault: true,
                },
            ])
        ).to.throw('Bkper default model does not support images.');
    });
});
