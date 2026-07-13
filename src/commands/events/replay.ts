import { BotResponse, Event } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Replays one bot response for an event.
 *
 * @param bookId - The book ID containing the event
 * @param eventId - The event ID to replay
 * @param agentId - The bot/agent ID whose response should be replayed
 * @returns The updated event payload after replay
 */
export async function replayEventBotResponse(
    bookId: string,
    eventId: string,
    agentId: string
): Promise<Event> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const event = new Event(book, { id: eventId });
    const botResponse = new BotResponse(event, { agentId });
    await botResponse.replay();
    return event;
}
