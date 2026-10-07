import { BotResponse, Event } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Deletes one bot response without deleting its event or reversing bot effects.
 *
 * @returns The updated event payload after deletion
 */
export async function deleteEventBotResponse(
    bookId: string,
    eventId: string,
    agentId: string
): Promise<Event> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const event = new Event(book, { id: eventId });
    const botResponse = new BotResponse(event, { agentId });
    await botResponse.remove();
    return event;
}
