# Add Bkper AI to an App

Bkper Platform apps can call [Bkper AI](https://bkper.com/docs/ai/ai-gateway.md) without storing a model-provider key. The platform authorizes each request as the current user and attributes usage to the app. Scripts and servers outside the platform use the same code with their own Bkper token.

Model output is a suggestion, not permission to change a Book. Keep decisions about resource movements, and any resulting writes, in application code.

## Choose the kind of response

- **A yes/no, a choice, or a level on a scale?** Ask a decision model, such as `jev`, with TypeSafe's SDK, `@typesafe-ai/sdk`.
- **Text or a custom JSON object?** Ask a language model (LLM), such as `gpt-luna`, with AI SDK's Open Responses provider, `@ai-sdk/open-responses`.

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

In both cases usage counts against the user's allowance. See [Call from a browser](https://bkper.com/docs/ai/ai-gateway.md#call-from-a-browser) for a request example.

## Ask a decision model

```ts
import { score, TypeSafeClient } from '@typesafe-ai/sdk';

const decisionClient = new TypeSafeClient({
    apiKey: 'bkper-platform-outbound',
    baseURL: 'https://ai.bkper.app',
    defaultModel: 'jev',
});

export async function scoreRecurring(description: string) {
    const { answers } = await decisionClient.systemOne({
        state: { description },
        questions: {
            recurring: score('How likely is this a recurring charge?', [
                'Unlikely',
                'Possible',
                'Likely',
            ]),
        },
    });
    return answers.recurring;
}
```

- **`apiKey`** is required by the SDK. In a Platform Worker, pass any placeholder: platform outbound replaces it with the user's authorization.
- **`baseURL`** has no `/v1`. The SDK calls `POST /v1/systemone`, which behaves exactly like `POST /v1/decisions`.
- **The answer is typed** from the question. Bkper AI validates every answer against its question before responding, so your code can use it directly.

The Decision Models guide covers questions, state, answers, and thresholds. The open-source [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) uses this setup to suggest duplicate pairs for human review.

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

Both SDKs retry rate limits and server errors twice by default. A failed attempt costs nothing: Bkper AI charges only successful answers.

Map these errors to your route's typed error response. Keep the code and message so users understand failures such as an exhausted allowance, but never return prompts, raw responses, or stack traces.

## SDK notes

- **Passing your own `fetch`.** The TypeSafe SDK calls `fetch` as its own method, which the Workers runtime rejects with `Illegal invocation`. Wrap it: `fetch: (input, init) => myFetch(input, init)`. Without the option, the SDK's default works.
- **No `null` values.** The TypeSafe SDK's types accept `null` for state, instructions, and some criteria. Bkper AI rejects them with `400`.
- **No `client.models.list()`.** It expects TypeSafe's catalog shape. Use the [`GET /v1/models`](https://ai.bkper.app/v1/models) catalog.
- **Other System One clients** take `https://ai.bkper.app/v1` as their base URL.
- **Flexible JSON schemas.** Open Responses always requests `strict: true`. For a schema that needs `strict: false`, such as a typed dynamic map, use `@ai-sdk/openai` with base URL `https://ai.bkper.app/v1`, its `.responses()` model, and `strictJsonSchema: false`.

## Before using the result

- **Send only task-relevant data.** Validate input and Book permissions at the app API boundary.
- **Keep writes deterministic.** An answer or generated text must not create, merge, or alter a Transaction without application rules and any required human confirmation.
- **Test the service.** Mock `fetch` and check what is sent, that the Worker adds no user token, and that errors stay actionable. Then run the app's normal check and build.

## Next steps

- [Decision Models](https://bkper.com/docs/ai/decision-models.md): questions, answers, thresholds, and caching.
- [Bkper AI Gateway](https://bkper.com/docs/ai/ai-gateway.md): tokens, raw HTTP requests, errors, and privacy.
- [Models and Usage](https://bkper.com/docs/ai/models.md): model IDs, capabilities, and usage rates.
- [Bkper AI API reference](https://bkper.com/docs/api/ai.md): every request and response field.
