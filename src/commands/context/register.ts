import type {Command} from 'commander';
import {withAction} from '../action.js';
import {runContextCredentialHelper} from './git-credential.js';
import {getUserContextDir, pullUserContext, type PullOutcome} from './user-context.js';

const PULL_MESSAGES: Record<PullOutcome, string> = {
    synced: 'Up to date with what you published.',
    unpublished: 'Nothing published yet. Commit and push from here to publish to all your agents.',
    unpushed: 'Not updated: this clone has changes not pushed. Push or discard them, then pull again.',
    failed: 'Could not update your agent context. Check your login (bkper auth login) and connection.',
};

/** `bkper context`: the user's agent context clone, shared with all of the user's agents. */
export function registerContextCommands(program: Command): void {
    const context = program
        .command('context')
        .description('Your agent context: AGENTS.md and skills shared with all your agents');

    context
        .command('pull')
        .description('Clone or update ~/.bkper/context/user (fast-forward only)')
        .action(() =>
            withAction(
                'pulling agent context',
                async () => {
                    const outcome = await pullUserContext();
                    console.log(`${getUserContextDir()}: ${PULL_MESSAGES[outcome]}`);
                    if (outcome === 'failed') process.exit(1);
                },
                {skipSetup: true}
            )()
        );

    context
        .command('git-credential <scope> [operation]')
        .description('Internal noninteractive credential helper for agent context clones')
        .action((scope: string, operation: string | undefined) =>
            withAction(
                'running git credential helper',
                async () => {
                    // Git appends get|store|erase to the configured helper command.
                    const exitCode = await runContextCredentialHelper({scope, operation: operation ?? 'get'});
                    if (exitCode !== 0) process.exit(exitCode);
                },
                {skipSetup: true}
            )()
        );
}
