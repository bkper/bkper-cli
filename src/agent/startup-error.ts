import {styleText} from 'node:util';

/** An invalid startup argument, reported as Pi reports one: a red `Error: <message>` line. */
export class AgentStartupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentStartupError';
    }
}

export function reportAgentCommandError(
    error: unknown,
    log: (...data: unknown[]) => void = console.error
): void {
    if (error instanceof AgentStartupError) {
        log(styleText('red', `Error: ${error.message}`));
    } else {
        log('Error running agent command:', error);
    }
}
