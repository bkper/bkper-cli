import type {
    AgentSession,
    AgentSessionEvent,
    MessageStartEvent,
} from '@earendil-works/pi-coding-agent';
import type {Component, Container, TUI} from '@earendil-works/pi-tui';

type UserMessage = Extract<MessageStartEvent['message'], {role: 'user'}>;

/** Private Pi UI surface, isolated here until Pi supports preflight previews. */
export interface PendingUserMessageHost {
    session: {
        prompt: AgentSession['prompt'];
        isStreaming: boolean;
        isCompacting: boolean;
    };
    chatContainer: Pick<Container, 'children' | 'removeChild'>;
    ui: Pick<TUI, 'requestRender'>;
    addMessageToChat(message: UserMessage): void;
    handleEvent(event: AgentSessionEvent): Promise<void>;
    rebindCurrentSession?(options?: {renderBeforeBind?: boolean}): Promise<void>;
}

/** Preview only in the UI: Pi remains responsible for canonical messages and history. */
export function installPendingUserMessage(host: PendingUserMessageHost): () => void {
    let session = host.session;
    let prompt = session.prompt;
    const handleEvent = host.handleEvent;
    const rebindCurrentSession = host.rebindCurrentSession;
    let pending: Component[] | undefined;

    const clear = () => {
        if (!pending) return;
        for (const component of pending) host.chatContainer.removeChild(component);
        pending = undefined;
        host.ui.requestRender();
    };

    const promptWithPreview: AgentSession['prompt'] = async (text, options) => {
        const trimmed = text.trim();
        const preview =
            !pending &&
            !session.isStreaming &&
            !session.isCompacting &&
            (!options?.source || options.source === 'interactive') &&
            trimmed.length > 0 &&
            !trimmed.startsWith('/') &&
            !trimmed.startsWith('!');
        let components: Component[] | undefined;
        if (preview) {
            const start = host.chatContainer.children.length;
            host.addMessageToChat({role: 'user', content: trimmed, timestamp: Date.now()});
            components = host.chatContainer.children.slice(start);
            pending = components;
            host.ui.requestRender();
        }
        try {
            await prompt.call(session, text, options);
        } finally {
            // Handled/rejected input has no user message event. Do not leave a ghost row.
            if (components && pending === components) clear();
        }
    };
    const handleEventWithPreview = async (event: AgentSessionEvent) => {
        if (event.type === 'message_start' && event.message.role === 'user') clear();
        await handleEvent.call(host, event);
    };
    const rebindWithPreview: PendingUserMessageHost['rebindCurrentSession'] = async options => {
        if (host.session !== session) {
            clear();
            if (session.prompt === promptWithPreview) session.prompt = prompt;
            session = host.session;
            prompt = session.prompt;
            session.prompt = promptWithPreview;
        }
        await rebindCurrentSession?.call(host, options);
    };
    session.prompt = promptWithPreview;
    host.handleEvent = handleEventWithPreview;
    if (rebindCurrentSession) host.rebindCurrentSession = rebindWithPreview;

    return () => {
        clear();
        if (session.prompt === promptWithPreview) session.prompt = prompt;
        if (host.handleEvent === handleEventWithPreview) host.handleEvent = handleEvent;
        if (host.rebindCurrentSession === rebindWithPreview) {
            host.rebindCurrentSession = rebindCurrentSession;
        }
    };
}
