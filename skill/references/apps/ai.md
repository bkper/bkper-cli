# Add Bkper AI to an App

Bkper AI is the preferred inference provider for Bkper Platform apps. It uses the authenticated user's included AI allowance, attributes usage to the app, and does not require the app to store provider credentials.

Use another provider only when Bkper AI lacks a required capability, model, compliance boundary, or customer-mandated provider. External providers require their own authentication, secrets, billing, and privacy review.

This guide covers the preferred current pattern: a non-streaming response with strict structured output. Streaming, tool calls, file inputs, and agent runtimes require additional design.

## Request flow

Keep model calls behind the app's typed `/api/*` contract:

1. The web client calls an app `/api/*` route with a Bkper bearer token. The template's `auth.authenticatedFetch()` handles this.
2. Bkper validates the token, mounts the user and app identity as outbound context, and removes the token before invoking the app Worker.
3. The Worker calls `https://ai.bkper.app/v1/*` without reading, storing, or forwarding the token.
4. Platform outbound injects Bkper authorization and overwrites `bkper-agent-id` and `bkper-ai-source` with the authenticated app identity.

Event handlers use the same Worker-to-Bkper-AI step. Their outbound context comes from the authenticated Bkper event. A normal page request does not establish user outbound context, so start interactive inference from an authenticated `/api/*` route rather than a page handler.

## Call the app API from the client

Use the authenticated fetch provider already configured by the app template:

```ts
interface AnalyzeRequest {
    first: {
        date: string;
        amount: string;
        description: string;
        fromAccount: string | null;
        toAccount: string | null;
    };
    second: {
        date: string;
        amount: string;
        description: string;
        fromAccount: string | null;
        toAccount: string | null;
    };
}

export async function analyzePair(auth: AuthProvider, request: AnalyzeRequest): Promise {
    return auth.authenticatedFetch('/api/v1/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
    });
}
```

In a full app, define this operation in the server's Zod/OpenAPI schemas and call it through the generated typed client. The important boundary is that the client authenticates the app API request; the Worker never handles that bearer token directly.

## Discover the current default model

The live model catalog is authoritative. It publishes the current default, model IDs, modalities, structured-output support, reasoning levels, context and output limits, and effective usage rates.

```ts
const AI_BASE_URL = 'https://ai.bkper.app/v1';
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function getStructuredOutputModel(fetcher: Fetcher = fetch): Promise<string> {
    const response = await fetcher(`${AI_BASE_URL}/models`);
    if (!response.ok) {
        throw new Error(`Bkper AI model discovery failed (${response.status}).`);
    }

    const catalog: unknown = await response.json();
    if (
        !isRecord(catalog) ||
        typeof catalog.default_model !== 'string' ||
        !Array.isArray(catalog.data)
    ) {
        throw new Error('Bkper AI returned an invalid model catalog.');
    }

    const defaultModel = catalog.default_model;
    const model = catalog.data.find(item => isRecord(item) && item.id === defaultModel);
    if (
        !isRecord(model) ||
        !isRecord(model.structured_output) ||
        model.structured_output.json_schema !== true ||
        model.structured_output.strict !== true
    ) {
        throw new Error('The default Bkper AI model does not support strict structured output.');
    }
    return defaultModel;
}
```

This example uses `default_model` after validating the capability required by the request. If an app requires another modality, file type, reasoning level, or limit, intentionally select and validate another model from the catalog's `data` array. Apps may cache the catalog briefly rather than fetching it for every inference request.

## Request strict structured output

Keep inference in a server service and make `fetch` injectable for unit tests. This example sends only the transaction facts needed for duplicate evaluation. It omits transaction IDs, Account IDs, unrelated properties, and other Book data.

```ts
const EvaluationJsonSchema = {
    type: 'object',
    properties: {
        duplicate: { type: 'boolean' },
        strength: { type: 'string', enum: ['Strong', 'Possible'] },
        explanation: { type: 'string', maxLength: 180 },
    },
    required: ['duplicate', 'strength', 'explanation'],
    additionalProperties: false,
} as const;

export interface DuplicateEvaluation {
    duplicate: boolean;
    strength: 'Strong' | 'Possible';
    explanation: string;
}

export class BkperAiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'BkperAiError';
    }
}

export async function evaluateDuplicate(
    candidate: AnalyzeRequest,
    fetcher: Fetcher = fetch
): Promise {
    const model = await getStructuredOutputModel(fetcher);
    const response = await fetcher(`${AI_BASE_URL}/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            model,
            instructions:
                'Decide whether both records represent the same movement. ' +
                'Return Strong only when the evidence is compelling.',
            input: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: JSON.stringify(candidate),
                        },
                    ],
                },
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'duplicate_evaluation',
                    schema: EvaluationJsonSchema,
                    strict: true,
                },
            },
            stream: false,
            store: false,
        }),
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
        const error = readAiError(payload);
        throw new BkperAiError(response.status, error.code, error.message);
    }

    const value: unknown = JSON.parse(getOutputText(payload));
    if (!isDuplicateEvaluation(value)) {
        throw new Error('Bkper AI output did not match the required schema.');
    }
    return value;
}
```

Do not add an `Authorization`, `bkper-agent-id`, or `bkper-ai-source` header to the Worker's Bkper AI request. Platform outbound derives those values from the authenticated app request or event and overwrites them before dispatch.

## Validate the response and preserve errors

Strict structured output constrains generation, but the app must still parse and validate the returned value before using it.

```ts
function getOutputText(payload: unknown): string {
    if (!isRecord(payload) || payload.status !== 'completed' || !Array.isArray(payload.output)) {
        throw new Error('Bkper AI did not return a complete response.');
    }

    const texts: string[] = [];
    for (const item of payload.output) {
        if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
            if (isRecord(part) && part.type === 'output_text' && typeof part.text === 'string') {
                texts.push(part.text);
            }
        }
    }
    if (texts.length === 0) throw new Error('Bkper AI returned no output text.');
    return texts.join('');
}

function isDuplicateEvaluation(value: unknown): value is DuplicateEvaluation {
    return (
        isRecord(value) &&
        typeof value.duplicate === 'boolean' &&
        (value.strength === 'Strong' || value.strength === 'Possible') &&
        typeof value.explanation === 'string' &&
        value.explanation.length <= 180
    );
}

function readAiError(payload: unknown): { code: string; message: string } {
    if (
        isRecord(payload) &&
        isRecord(payload.error) &&
        typeof payload.error.code === 'string' &&
        typeof payload.error.message === 'string'
    ) {
        return { code: payload.error.code, message: payload.error.message };
    }
    return { code: 'bkper_ai_error', message: 'Bkper AI request failed.' };
}
```

Preserve the upstream HTTP status, error code, and message when mapping a `BkperAiError` into the app's typed error envelope. Bkper AI centralizes actionable messages such as allowance guidance and pricing links. Bot event responses may reuse that message directly when the surface supports it. Interactive apps can use the status and code to provide a tailored experience without duplicating the upstream policy or CTA.

## Test the boundary

Use a mocked `fetch` to protect the integration contract without making live model calls:

```ts
expect(capturedRequest.headers.get('authorization')).toBeNull();
expect(requestBody.store).toBe(false);
expect(requestBody.stream).toBe(false);
expect(requestBody.text).toMatchObject({
    format: { type: 'json_schema', strict: true },
});
```

Also test that the service:

- validates that the catalog's `default_model` supports strict structured output;
- rejects malformed or schema-incompatible output;
- preserves Bkper AI error status, code, and message;
- does not send internal identifiers or unrelated Book data.

## Implementation checklist

Before considering the integration complete:

- [ ] The client calls a typed `/api/*` route through authenticated fetch.
- [ ] Worker code never reads, stores, or forwards the Bkper bearer token.
- [ ] The app discovers models from `GET /v1/models` and intentionally chooses a returned ID.
- [ ] Inference runs in a server service with an injectable `fetch`.
- [ ] The request uses strict structured output, `stream: false`, and `store: false`.
- [ ] Only data required for the task is sent to inference.
- [ ] Returned JSON is parsed and independently validated.
- [ ] Error status, code, and message remain available to the caller.
- [ ] Unit tests cover the request, response, validation, and error boundaries.
- [ ] The app's normal `npm run check` or `bun run check` succeeds.

## Next steps

- [Read the client-agnostic Bkper AI Provider guide](https://bkper.com/docs/ai/bkper-ai-provider.md) for privacy boundaries, the complete supported profile, and advanced features.
- [Inspect the live model catalog](https://ai.bkper.app/v1/models).
- [Browse the generated AI API reference](https://bkper.com/docs/api/ai.md) when exact request or response schema details are needed.
- [Review the Merge Duplicates implementation](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) for a platform-app example with deterministic candidate filtering, strict structured output, and human-confirmed merges.
