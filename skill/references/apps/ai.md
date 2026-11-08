# Add Bkper AI to an App

Bkper Platform apps can call [Bkper AI models](https://bkper.com/docs/ai/models.md) without storing a model-provider key. The platform authorizes each request as the current user and attributes usage to the app. Scripts and servers outside the platform use the same code with their own Bkper token.

Model output is a suggestion, not permission to change a Book. Keep decisions about resource movements, and any resulting writes, in application code.

## Choose the kind of response

- **A judgment: a yes/no, one of known options, or a level on a scale?** [Ask a System One model](#ask-a-system-one-model) a decision question, with a model such as `jev`.
- **A value read from a document, such as an invoice total, or a likely range for an uncertain number, such as days until an invoice is paid?** [Ask a System One model](#ask-a-system-one-model) an extraction question, with a model such as `clairic`.
- **Text or a custom JSON object?** Ask a language model (LLM), such as `gpt-luna`, with AI SDK's Open Responses provider, `@ai-sdk/open-responses`.
- **A conversation that works on Books?** Reading and comparing Books, computing with scripts, delivering files, remembering earlier messages: [run an agent](#run-an-agent) with the Managed Agent API instead of calling a model.

By default, add the SDK to the **Worker** package. Keep the call in a server service used by your authenticated app API route, and define the route's request and response in the app's Zod/OpenAPI contract. For inference used only by the UI, the client can also [call Bkper AI directly](#call-from-the-browser).

## Keep authentication in the platform

For an interactive app, the flow is:

1. The client calls a typed app `/api/*` route through `auth.authenticatedFetch()` or another authenticated client.
2. Bkper verifies the user's token, removes it before invoking the Worker, and establishes user and app context for outbound requests.
3. The Worker calls Bkper AI. Platform outbound adds authorization and app attribution. **Do not read, forward, or store the user's token in the Worker.**

An authenticated `/events` handler has the same outbound context. A page request does not, so the page handler cannot call Bkper AI.

## Call from the browser

The client can call Bkper AI directly with `auth.authenticatedFetch()`, which sends the signed-in user's token. Choose the path by what the inference needs:

|                                     | App API route                      | Browser                                         |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Usage attribution                   | The app, set by platform outbound  | The `bkper-ai-source` header the client sends   |
| Prompts, questions, and criteria    | Private to the Worker              | Visible to the user                             |
| Reuse by scripts, agents, or events | Yes, through the route             | No                                              |
| Request path                        | Client → app Worker → Bkper AI     | Client → Bkper AI                               |

In both cases usage counts against the user's allowance. See [Call from a browser](https://bkper.com/docs/api/ai-gateway.md#call-from-a-browser) for a request example.

## Ask a System One model

Every System One question, decision or extraction, goes to `POST /v1/systemone`. There are two ways to send it:

- **TypeSafe's SDK**, `@typesafe-ai/sdk`, types decision questions and their answers for you. It does not send extraction questions or images.
- **`fetch`** sends any question type, and images.

Bkper AI validates every answer against its question before responding, so your code can use it directly. Keep the questions, the thresholds, and the function that turns answers and facts into an action in one module.

### With TypeSafe's SDK

```ts
import { noul, TypeSafeClient } from '@typesafe-ai/sdk';

const decisionClient = new TypeSafeClient({
    apiKey: 'bkper-platform-outbound',
    baseURL: 'https://ai.bkper.app',
    defaultModel: 'jev',
});

export async function recurringProbability(description: string): Promise<number> {
    const { answers } = await decisionClient.systemOne({
        state: { description },
        questions: {
            recurring: noul('Is this a recurring charge, such as a subscription or a monthly bill?'),
        },
    });
    return answers.recurring.noul;
}
```

- **`apiKey`** is required by the SDK. In a Platform Worker, pass any placeholder: platform outbound replaces it with the user's authorization.
- **`baseURL`** has no `/v1`. The SDK calls `POST /v1/systemone`, which behaves exactly like `POST /v1/decisions`.
- **The answer is typed** from the question: here, `noul` is the probability of yes, which your code compares with a threshold.

### With fetch

```ts
interface ValueAnswer {
    value: T | null;
    guess?: T;
    p_null: number;
    confidence: number;
}

interface InvoiceReading {
    model: string;
    answers: { total: ValueAnswer<number>; issue_date: ValueAnswer<string> };
    truncated?: boolean;
}

interface BkperAiErrorBody {
    error: { code: string; message: string };
}

export async function readInvoice(email: string): Promise {
    // No Authorization header: the platform adds the user's.
    const response = await fetch('https://ai.bkper.app/v1/systemone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'clairic',
            state: email,
            questions: {
                total: { type: 'number', decimals: 2, instructions: 'Invoice total' },
                issue_date: { type: 'date', instructions: 'Invoice issue date' },
            },
        }),
    });
    if (!response.ok) {
        const { error } = (await response.json()) as BkperAiErrorBody;
        throw new Error(`${error.code}: ${error.message}`);
    }
    // Bkper AI validated each answer against its question.
    return (await response.json()) as InvoiceReading;
}
```

- **`value` can be `null`** when the email probably lacks it. Send such items, and any response with `truncated: true`, to a person with the `guess`.
- **The model reads; code checks.** Compare the total with the invoice lines, and compute dates such as the due date, before anything reaches a Book.
- **Images** go in the same request, as base64 `assets`.

[System One Models](https://bkper.com/docs/ai/system-one-models.md) covers designing the questions, facts, and thresholds, and every question type; the [AI Gateway API](https://bkper.com/docs/api/ai-gateway.md#decision-questions) covers the request, answers, errors, and caching. The open-source [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) uses TypeSafe's SDK to suggest duplicate pairs for human review.

## Generate a language response

```ts
import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const llmClient = createOpenResponses({
    name: 'bkper-ai',
    url: 'https://ai.bkper.app/v1/responses',
});

export async function draftReviewNote(description: string) {
    const { output } = await generateText({
        model: llmClient('gpt-luna'),
        system: 'Draft a short, neutral review note. Do not invent facts.',
        prompt: description,
        output: Output.object({ schema: z.object({ note: z.string() }) }),
    });
    return output;
}
```

- **No `apiKey`.** The provider then sends no `Authorization` header, and platform outbound adds it.
- **`url`** is the full `/v1/responses` URL.
- **`output`** is parsed and validated against your schema by AI SDK. The provider requests strict structured output, which every Bkper language model supports.

Keep schemas simple. Constraints such as a string's minimum or maximum length may not be supported by every model's strict JSON Schema subset; check them in code after generation.

## Run an agent

For a chat that does real work on Books, start a session on the [Managed Agent API](https://bkper.com/docs/api/managed-agent.md) from the app's server. Bkper runs the agent in the user's private cloud workspace, with the `bkper` CLI, files, and durable sessions. Your app keeps its screens, prompts, and instructions.

```ts
// No Authorization header: the platform adds the user's.
const response = await fetch('https://agent.bkper.app/v1/sessions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // Reuse the same key if you retry this request.
        'Idempotency-Key': inputId,
    },
    body: JSON.stringify({
        instructions: 'You help the finance team close each month.',
        input: {
            content: [{ type: 'text', text: question }],
            bookContext: { bookId, query },
        },
    }),
});
const session = await response.json();
```

Then follow the session's stream, or poll the input until it completes, as in the [quick start](https://bkper.com/docs/api/managed-agent.md#quick-start).

- **The user's agent.** Sessions belong to the user, so work started in your app continues in Bkper Agent or any other app.
- **The user's procedures.** The agent follows the user's [agent context](https://bkper.com/docs/ai/agent-context.md): their company's, their own, and the session's Book's, loaded after your instructions.
- **Your services as tools.** The agent can call your app's API as the user. Describe the routes in your instructions, and the agent can run your checks instead of redoing them.
- **Real changes.** Unlike a model call, the agent can change Books with the user's permissions. Say in your instructions when it may.

> **Tip**
> Replies usually come in Markdown. Render them, sanitized, in your chat, or ask for another format in your instructions.
## Outside a Platform app

Scripts, servers, and tools send their own Bkper token. Pass it as `apiKey`: both SDKs send it as a bearer token. Get a client each time you need one, so every call uses a current token:

```ts
import { createOpenResponses } from '@ai-sdk/open-responses';
import { noul, TypeSafeClient } from '@typesafe-ai/sdk';
import { generateText } from 'ai';
import { getOAuthToken } from 'bkper';

const decisionClient = async () =>
    new TypeSafeClient({
        apiKey: await getOAuthToken(),
        baseURL: 'https://ai.bkper.app',
        defaultModel: 'jev',
    });

const llmClient = async () =>
    createOpenResponses({
        name: 'bkper-ai',
        url: 'https://ai.bkper.app/v1/responses',
        apiKey: await getOAuthToken(),
    });

const client = await decisionClient();
const { answers } = await client.systemOne({
    state: { description: 'NETFLIX.COM monthly plan' },
    questions: { streaming: noul('Is this a streaming service?') },
});

const { text } = await generateText({
    model: (await llmClient())('gpt-luna'),
    prompt: 'Describe NETFLIX.COM monthly plan in five words.',
});
```

- **`getOAuthToken()`** reads the credentials from `bkper auth login` and refreshes them when needed. In your own server, use your own token provider.
- **Creating a client is cheap.** Neither SDK makes a request until you ask a question.
- **Label your usage** with a `bkper-ai-source` header, such as `my-script`: `defaultHeaders` in the TypeSafe SDK, `headers` in Open Responses. In a Platform app, outbound sets the source to the app.

## Handle errors

Every Bkper AI error has the same envelope: `{ error: { message, type, param, code } }`. Branch on `error.code`, not only on the HTTP status: a `429` can mean an exhausted allowance or a throttled provider.

- **TypeSafe SDK:** an `APIError` with `status` and the envelope in `body`, so read `error.body.error.code`. Network failures and timeouts throw `APIConnectionError`.
- **AI SDK:** an `APICallError` with `statusCode` and the envelope in `data`, so read `error.data.error.code`. Output that does not match your schema throws `NoObjectGeneratedError`.
- **`fetch`:** a response that is not `ok` has the envelope as its JSON body. `fetch` does not retry.

Both SDKs retry rate limits and server errors twice by default. A failed attempt costs nothing: Bkper AI charges only successful answers.

Map these errors to your route's typed error response. Keep the code and message so users understand failures such as an exhausted allowance, but never return prompts, raw responses, or stack traces.

## SDK notes

- **Passing your own `fetch`.** The TypeSafe SDK calls `fetch` as its own method, which the Workers runtime rejects with `Illegal invocation`. Wrap it: `fetch: (input, init) => myFetch(input, init)`. Without the option, the SDK's default works.
- **No `null` values.** The TypeSafe SDK's types accept `null` for state, instructions, and some criteria. Bkper AI rejects them with `400`.
- **No SDK image uploads.** The TypeSafe SDK uploads images as multipart, which Bkper AI rejects with `400`. Send image requests [with `fetch`](#with-fetch) as JSON, with base64 `assets`. See [System One Models](https://bkper.com/docs/ai/system-one-models.md#models) for each model's image limits.
- **No `client.models.list()`.** It expects TypeSafe's catalog shape. Use the [`GET /v1/models`](https://ai.bkper.app/v1/models) catalog.
- **Other System One clients** take `https://ai.bkper.app/v1` as their base URL.
- **Flexible JSON schemas.** Open Responses always requests `strict: true`. For a schema that needs `strict: false`, such as a typed dynamic map, use `@ai-sdk/openai` with base URL `https://ai.bkper.app/v1`, its `.responses()` model, and `strictJsonSchema: false`.

## Before using the result

- **Send only task-relevant data.** Validate input and Book permissions at the app API boundary.
- **Keep writes deterministic.** An answer or generated text must not create, merge, or alter a Transaction without application rules and any required human confirmation.
- **Test the decision without the model.** Unit-test the function that turns answers and facts into an action with fixed answers, just below and just above each threshold.
- **Test the service.** Mock `fetch` and check what is sent, that the Worker adds no user token, and that errors stay actionable. Then run the app's normal check and build.

## Next steps

- [System One Models](https://bkper.com/docs/ai/system-one-models.md): decision and extraction questions, answers, and thresholds.
- [Models and Usage](https://bkper.com/docs/ai/models.md): models, usage rates, the allowance, and privacy.
- [AI Gateway API](https://bkper.com/docs/api/ai-gateway.md): tokens, raw HTTP requests, capabilities, and errors.
- [Managed Agent API](https://bkper.com/docs/api/managed-agent.md): sessions, instructions, files, and streams.
