# Add Bkper AI to an App

Bkper Platform apps can call [Bkper AI](https://bkper.com/docs/ai/ai-gateway.md) without storing a model-provider key. The platform authorizes the Worker's request using the current user and attributes usage to the app. Model output is a suggestion, not permission to change a Book: keep decisions about resource movements and any resulting writes in application code.

This guide covers a server-side, non-streaming language response. It uses AI SDK to draft a review note from a transaction description. No Book data is written by the example.

## Choose the kind of response

- **A bounded yes/no, choice, or score?** Use a typed evaluation (Jev) at `POST /v1/evaluations`.
- **Generated text or a custom JSON object?** Use a language model at `POST /v1/responses`. AI SDK is an option for this path.

Pick a model of the corresponding `type` from the live [`GET /v1/models` catalog](https://ai.bkper.app/v1/models). The catalog also tells you which language models support strict structured output. AI SDK's **Open Responses provider** covers language responses, not Bkper's typed evaluation endpoint. For Jev, use HTTP or implement an AI SDK evaluation-model adapter for `experimental_evaluate`, as `bkper-agent` does. See [Typed evaluations](https://bkper.com/docs/ai/ai-gateway.md#typed-evaluations) and the [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates) for a human-reviewed HTTP example.

## Keep authentication in the platform

For an interactive app, the flow is:

1. The client calls a typed app `/api/*` route through `auth.authenticatedFetch()` (or another authenticated client). The template's generated API client can use that fetch provider.
2. Bkper verifies the user's token, removes it before invoking the Worker, and establishes user and app context for outbound requests.
3. The Worker calls `https://ai.bkper.app/v1/*`. Platform outbound adds authorization and app attribution. **Do not read, forward, or store the user's token in the Worker.**

An authenticated `/events` handler has the same outbound context. A page request does not; start interactive inference from an authenticated `/api/*` route, not from the page handler or the browser.

## Example: draft a review note with AI SDK

Add `ai`, `@ai-sdk/open-responses`, and `zod` to the **Worker** package. Keep this code in a server service called from your authenticated app API route; define the route's request and response in the app's Zod/OpenAPI contract. The service takes only the description needed for this task, discovers the current language model, and validates its output before returning it to the caller.

```ts
import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const BASE_URL = 'https://ai.bkper.app/v1';
const ReviewNote = z.strictObject({ note: z.string() });

export async function draftReviewNote(
    description: string,
    fetcher: typeof fetch = fetch
): Promise<{ note: string }> {
    const response = await fetcher(`${BASE_URL}/models`);
    if (!response.ok) throw new Error(`Model discovery failed (${response.status}).`);

    const catalog = z
        .object({
            default_model: z.string(),
            data: z.array(
                z.object({
                    id: z.string(),
                    type: z.string(),
                    structured_output: z
                        .object({
                            json_schema: z.boolean(),
                            strict: z.boolean(),
                        })
                        .optional(),
                })
            ),
        })
        .parse(await response.json());
    const model = catalog.data.find(item => item.id === catalog.default_model);
    if (
        model?.type !== 'language' ||
        !model.structured_output?.json_schema ||
        !model.structured_output.strict
    ) {
        throw new Error('The default model does not support strict JSON output.');
    }

    const provider = createOpenResponses({
        name: 'bkper-ai',
        url: `${BASE_URL}/responses`,
        fetch: fetcher,
    });
    const { output } = await generateText({
        model: provider(model.id),
        system: 'Draft a short, neutral review note. Do not invent facts or change Accounts.',
        prompt: description,
        output: Output.object({ schema: ReviewNote }),
        maxRetries: 0,
    });
    return ReviewNote.parse(output);
}
```

**This example is for a Bkper Platform Worker.** With no SDK `apiKey`, the Open Responses provider sends no `Authorization` header; platform outbound supplies authorization and app attribution. A standalone integration such as `bkper-agent` must instead obtain and send its own Bkper OAuth token. Open Responses always requests `strict: true` for structured JSON and omits `store`; Bkper AI treats an omitted `store` as `false` and never persists response state. If you need `strict: false` for a model-supported flexible schema, use `@ai-sdk/openai` with its `.responses()` model and `strictJsonSchema: false`, as `bkper-agent` does. You may cache the catalog briefly instead of fetching it for every call.

The schema deliberately checks only that a `note` string exists. Constraints such as a minimum or maximum string length are **not needed for this example** and may not be supported by every model's strict JSON Schema subset. If your app needs a length limit, check it in application code after generation.

## Before using the result

- Send only task-relevant data. Validate input and Book permissions at the app API boundary. A generated note must not create, merge, or alter a transaction without deterministic application rules and any required human confirmation.
- If model discovery fails or output does not match the schema, fail safely. Avoid automatic retries on actions that may consume allowance.
- When the AI request fails, preserve the upstream HTTP status, error code, and message **when Bkper AI supplies them**, so users can understand failures such as an exhausted allowance. AI SDK exposes HTTP failures as `APICallError`; read the Bkper AI error envelope from `responseBody`, not from the SDK's generic message. For `NoObjectGeneratedError` or transport errors, return a safe app-defined error instead. Do not return prompts, raw responses, or stack traces to clients.
- Unit-test the server service with a mocked `fetch`: verify the model's type and capability, that no `Authorization` or attribution headers leave the Worker, that only necessary data is sent and `store: true` is never requested, that malformed output is rejected, and that errors remain actionable. Then run the app's normal check/build.

For example, a route can extract the safe fields before mapping them into its typed error response:

```ts
import { APICallError } from 'ai';

function bkperAiError(error: unknown) {
    if (!APICallError.isInstance(error)) return null;
    let body: unknown;
    try {
        body = JSON.parse(error.responseBody ?? '');
    } catch {
        return null;
    }
    const parsed = z
        .object({
            error: z.object({ code: z.string(), message: z.string() }),
        })
        .safeParse(body);
    if (!parsed.success) return null;
    return {
        status: error.statusCode ?? 502,
        code: parsed.data.error.code,
        message: parsed.data.error.message,
    };
}
```

For direct HTTP calls, advanced features, or exact request and response fields, use the [Bkper AI API reference](https://bkper.com/docs/api/ai.md) and [AI Gateway guide](https://bkper.com/docs/ai/ai-gateway.md). Bkper AI implements a documented subset of Open Responses, not every OpenAI or AI SDK feature.
