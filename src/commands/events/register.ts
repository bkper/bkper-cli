import type { Command } from 'commander';
import { EventType } from 'bkper-js';
import { withAction } from '../action.js';
import { parsePositiveInteger } from '../cli-helpers.js';
import { renderItem, renderList } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { listEventsFormatted, replayEventBotResponse, deleteEventBotResponse } from './index.js';
import { eventToJson } from './event-json.js';

const EVENT_TYPE_VALUES = new Set<string>(Object.values(EventType));

interface EventResponseOptions extends Record<string, unknown> {
    book?: string;
    agentId?: string;
}

/**
 * Commander parser for EventType values.
 */
export function parseEventType(value: string): EventType {
    if (!EVENT_TYPE_VALUES.has(value)) {
        throw new Error(
            `Invalid event type '${value}'. Valid types: ${Object.values(EventType).join(', ')}`
        );
    }
    return value as EventType;
}

export function registerEventCommands(program: Command): void {
    const eventCommand = program.command('event').description('Inspect book events and bot responses');

    eventCommand
        .command('list')
        .description('List events in a book (includes bot responses)')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--after <date>', 'Start date inclusive (RFC3339)')
        .option('--before <date>', 'End date exclusive (RFC3339)')
        .option('--resource <resourceId>', 'Filter by resource ID (Transaction, Account, or Group)')
        .option('--error', 'Only events with at least one error bot response')
        .option('--type <type>', 'Filter by event type', parseEventType)
        .option(
            '--limit <limit>',
            'Fetch one page with up to this many events (default 50, max 200)',
            parsePositiveInteger
        )
        .option('--cursor <cursor>', 'Cursor for fetching the next page')
        .action(options =>
            withAction('listing events', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const result = await listEventsFormatted(options.book, {
                    afterDate: options.after,
                    beforeDate: options.before,
                    resourceId: options.resource,
                    onError: options.error === true ? true : undefined,
                    type: options.type,
                    limit: options.limit,
                    cursor: options.cursor,
                });
                renderList(result);
            })()
        );

    const responseCommand = eventCommand.command('response').description('Manage event bot responses');

    responseCommand
        .command('replay <eventId>')
        .description('Replay one bot response for an event')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--agent-id <agentId>', 'Bot/agent ID to replay')
        .action((eventId: string, options: EventResponseOptions) =>
            withAction('replaying event bot response', async () => {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'agentId', flag: '--agent-id' },
                    ])
                );
                const event = await replayEventBotResponse(options.book!, eventId, options.agentId!);
                renderItem(eventToJson(event.json()));
            })()
        );

    responseCommand
        .command('delete <eventId>')
        .description('Delete one bot response; preserves the event and does not undo bot effects')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--agent-id <agentId>', 'Bot/agent ID whose response should be deleted')
        .action((eventId: string, options: EventResponseOptions) =>
            withAction('deleting event bot response', async () => {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'agentId', flag: '--agent-id' },
                    ])
                );
                const event = await deleteEventBotResponse(options.book!, eventId, options.agentId!);
                renderItem(eventToJson(event.json()));
            })()
        );
}
