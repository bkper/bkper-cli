function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Serializes an event for CLI output.
 *
 * Keeps the full event payload (including botResponses for debugging) and drops
 * agent logos, which are image payloads rather than information:
 * - `agent.logo` / `agent.logoDark` (the agent is identified by `agent.id`/`name`)
 * - `agentLogo` / `agentLogoDark` on the embedded `data.object.transaction`
 *
 * @param event - The event payload
 * @returns A new payload object; the input is not mutated
 */
export function eventToJson(event: bkper.Event): bkper.Event {
    const json: bkper.Event = { ...event };

    if (json.agent) {
        const agent: bkper.Agent = { ...json.agent };
        delete agent.logo;
        delete agent.logoDark;
        json.agent = agent;
    }

    const transaction: unknown = json.data?.object?.transaction;
    if (json.data?.object && isRecord(transaction)) {
        const cleanTransaction: Record<string, unknown> = { ...transaction };
        delete cleanTransaction.agentLogo;
        delete cleanTransaction.agentLogoDark;
        json.data = {
            ...json.data,
            object: { ...json.data.object, transaction: cleanTransaction },
        };
    }

    return json;
}
