# Bkper AI Gateway API

> Call Bkper AI models from your own client or code — the guide, with a page for each operation: models, responses, streaming, and decisions.

The Bkper AI Gateway serves the models behind Bkper's agents and apps to your own clients and code: typed answers from System One models and the stateless Bkper [Open Responses 2026-04-24](https://www.openresponses.org/specification/2026-04-24) profile for language models.

[Models and Usage](https://bkper.com/docs/ai/models) covers the models, usage rates, the monthly allowance, and privacy. To run an agent that works on Books instead of calling a model, use the [Managed Agent API](https://bkper.com/docs/api/managed-agent). Building a Bkper app? Start with [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai). The canonical machine-readable contract is [https://ai.bkper.app/openapi.json](https://ai.bkper.app/openapi.json).

## Request workflow

1. Call `GET /v1/models` to discover the current public model IDs, types, capabilities, limits, and usage rates.
2. Select a returned model ID.
3. Call `POST /v1/responses` for language models or `POST /v1/systemone` for System One models.

Responses support complete JSON with `stream: false` or semantic server-sent events with `stream: true`. System One models return complete JSON and do not stream.

## Requirements

You need:

- a Bkper account with an eligible subscription or trial allowance;
- a valid Bkper OAuth access token;
- an Open Responses client with a custom base URL for language generation, or an HTTP client or TypeSafe SDK for System One models.

Requests are attributed to the authenticated Bkper user. Business subscriptions use a shared domain allowance. See [Models and Usage](https://bkper.com/docs/ai/models#monthly-allowance) for allowance scope, current rates, and model capabilities.

## Configure your client

| Setting                | Value                                        |
| ---------------------- | -------------------------------------------- |
| Base URL               | `https://ai.bkper.app/v1`                    |
| Authentication         | `Authorization: Bearer <Bkper access token>` |
| Model discovery        | `GET /v1/models`                             |
| Language generation    | `POST /v1/responses`                         |
| System One models      | `POST /v1/systemone`                         |
| Open Responses profile | `2026-04-24` for language generation only    |

The live `GET /v1/models` response is authoritative for available IDs, model types, capabilities, limits, and effective usage rates. The catalog publishes `default_model` as the default language model. Inspect each entry's `type` before choosing its endpoint.

When a client asks for an API key, provide the Bkper access token. The client should send it as a bearer token. Do not use an OpenAI, Anthropic, or xAI API key with the Bkper AI base URL.

Bkper AI implements a documented subset of Open Responses. It does not claim full specification compliance.

## Model IDs

Use the model IDs returned by `GET /v1/models`, such as `gpt-luna`, `grok`, `gemini-flash`, and `jev`.

Language model entries have `type: "language"` and use `POST /v1/responses`. System One model entries have `type: "system-one"`, list the question types they answer in `question_types`, and use `POST /v1/systemone`. Entries with `preview: true` are provider previews whose answers, limits, and availability may change without notice. Sending a model to the wrong endpoint fails explicitly.

Model IDs remain stable as Bkper updates the model behind them. Older versioned and publisher-prefixed IDs still work, but they select the current model, not the older version. Catalogs, responses, and usage reports use the current ID.

## Get a token for local testing

Any supported Bkper OAuth flow can supply the access token. The Bkper CLI is a convenient way to obtain a short-lived token for local testing:

```bash
bkper auth login
export BKPER_TOKEN="$(bkper auth token)"
```

Treat the token as a secret. Do not commit it, print it in shared logs, or put it in a client-side application bundle.

## Call from a browser

Web pages on any origin can call `POST /v1/responses`, `POST /v1/systemone`, and `GET /v1/models` directly. Bkper AI authenticates only the bearer token and uses no cookies, so browser requests carry no credentials.

- **Use the signed-in user's token at runtime.** On `*.bkper.app` pages, `@bkper/web-auth` supplies it. On other domains, use your own Bkper OAuth flow. Never ship a fixed token in a page.
- **Usage counts against the signed-in user's allowance.** Label it with a `bkper-ai-source` header, such as `my-page`.
- **The user can see the whole request,** including prompts, questions, and criteria. Keep private prompts on a server.
- **Retry hints are readable.** Browsers can read the `retry-after` and `x-should-retry` response headers.

```ts
import { BkperAuth } from '@bkper/web-auth';

const auth = new BkperAuth();
await auth.init();

const response = await auth.authenticatedFetch('https://ai.bkper.app/v1/systemone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'bkper-ai-source': 'my-page' },
    body: JSON.stringify({
        model: 'jev',
        state: { description: 'NETFLIX.COM monthly plan' },
        questions: { streaming: { type: 'noul', instructions: 'Is this a streaming service?' } },
    }),
});
```

`authenticatedFetch()` sets the current token and refreshes it once after a `401`.

## Send a complete request

This request uses one current model ID as an example. Use `GET /v1/models` or [Models and Usage](https://bkper.com/docs/ai/models#models) for the current portfolio.

```bash
curl --fail-with-body https://ai.bkper.app/v1/responses \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "bkper-ai-source: my-harness" \
  --data '{
    "model": "gpt-luna",
    "input": "Reply with exactly: connected",
    "store": false
  }'
```

The response is an Open Responses resource. Its `model` contains the canonical public Bkper model ID, and `store` is always `false`.

The `bkper-ai-source` header is optional. Set it to a stable lowercase identifier such as `my-harness` to see which client or application made a request in the usage dashboard. Without a valid identifier, the source appears as unknown.

## Decision questions

`POST /v1/systemone` answers typed questions about a shared state instead of generating text. Each question returns a noul probability, one choice from options you define, or a level on an ordered score, and your code decides what to do with it. Designing the questions, thresholds, and human review is covered in the [System One Models guide](https://bkper.com/docs/ai/system-one-models). `POST /v1/decisions` is a deprecated alias with identical behavior.

For an incoming bank line, this request asks for three judgments at once: which Account it belongs to, whether it is already recorded, and how unusual it is as a business expense. Code combines the answers with facts, such as the amount, into what to do with the line.

```bash
curl --fail-with-body https://ai.bkper.app/v1/systemone \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "bkper-ai-source: my-app" \
  --data '{
    "model": "jev",
    "state": {
      "bank_line": {
        "date": "2025-03-11",
        "description": "AMAZON MKTPL*2K4LM",
        "amount": 89.90,
        "direction": "money out of Checking"
      },
      "existing_transaction": {
        "date": "2025-03-10",
        "amount": 89.90,
        "from": "Checking",
        "to": "Office Supplies",
        "description": "Printer toner, Amazon order 114-2K4LM",
        "origin": "manual entry"
      }
    },
    "questions": {
      "account": {
        "type": "choice",
        "instructions": "Which Account should receive the money that left Checking in `bank_line`?",
        "criteria": {
          "Cloud Hosting": "Servers, cloud infrastructure, storage, and hosting providers",
          "Software Subscriptions": "SaaS tools and per-seat software licenses",
          "Office Supplies": "Physical supplies and equipment for the office",
          "Travel": "Flights, hotels, ground transport, and meals while traveling"
        }
      },
      "already_recorded": {
        "type": "noul",
        "instructions": "Does `existing_transaction` already record the movement in `bank_line`?"
      },
      "unusual": {
        "type": "score",
        "instructions": "How unusual is `bank_line` as a business expense?",
        "criteria": [
          "Routine: a common business expense",
          "Unusual: plausible, but uncommon for a business",
          "Suspicious: looks like fraud, an error, or a personal expense"
        ]
      }
    }
  }'
```

### Decision request

- **`model`** is any model with `type: "system-one"` in `GET /v1/models`, such as `jev` or `clef`. Each entry lists its `question_types`, `context_window`, and `max_state_question_tokens`; a question whose type is not in the model's `question_types` returns `unsupported_question_type`.
- **`state`** is what every question judges: a string, JSON object, or array. Prefer an object with descriptive field names. Convert PDFs and other files to text first, or to image `assets` for models with image input.
- **`questions`** is a nonempty map. Question IDs such as `account` are yours, and answers come back under the same IDs, but **IDs are not sent to the model**, so each `instructions` must stand on its own. Refer to state fields by name in backticks, as in `` `bank_line` ``.
- Each question accepts only `type`, `instructions`, and `criteria`. Instructions, descriptions, and levels can be strings or [structured JSON](https://docs.typesafe.ai/primitives/advanced):
  - **`noul`**: optional `criteria` describe what yes and no mean.
  - **`choice`**: `criteria` maps 1–255 options to descriptions, which may be `null`.
  - **`score`**: `criteria` lists 2–10 levels, lowest first.
- The body accepts only `model`, `state`, and `questions`, plus image `assets` on models with image input. `reference_date` applies only to extraction questions; `jev` and `clef` reject it with `unsupported_parameter`. Responses fields such as `input`, `stream`, `store`, `temperature`, and `metadata` are rejected.
- **`clef`** answers at most 64 questions, named with up to 100 letters, digits, `_`, `.`, or `-`, and needs at least 2 choice options. It reads up to 4 image `assets` (4 MiB each, 8 MiB in total) before the state, in `assets` order. Requests beyond these limits return `unsupported_parameter`; input over its 65,536-token context returns `provider_rejected`.

The model evaluates each question independently and in parallel against the same state.

### Decision answers

A real response to the request above:

```json
{
    "model": "jev-1.13.0",
    "answers": {
        "account": {
            "type": "choice",
            "choice": "Office Supplies",
            "confidence": 1,
            "probabilities": {
                "Cloud Hosting": 0,
                "Software Subscriptions": 0,
                "Office Supplies": 1,
                "Travel": 0
            }
        },
        "already_recorded": {
            "type": "noul",
            "noul": 0.91
        },
        "unusual": {
            "type": "score",
            "score": 0.17,
            "confidence": 0.74,
            "legend": {
                "0": "Routine: a common business expense",
                "1": "Unusual: plausible, but uncommon for a business",
                "2": "Suspicious: looks like fraud, an error, or a personal expense"
            },
            "probabilities": {
                "0": 0.9,
                "1": 0.03,
                "2": 0.07
            }
        }
    },
    "usage": { "input_tokens": 614, "output_tokens": 87 }
}
```

Bkper validates every answer before returning it, so your code can rely on these guarantees:

- `answers` has exactly one entry per question ID, and each answer's `type` matches its question.
- `noul` is the probability of yes, from 0 to 1.
- `choice` is always one of your `criteria` keys.
- `score` is the probability-weighted level, from `0` to the number of levels minus one. It can fall between levels.
- `probabilities` has one entry per option or level, and `legend` maps level indexes back to your text. Read both by key: order is not guaranteed, and values can be exactly `0` or `1`.
- `confidence`, on choice and score answers, runs from 0 to 1 and is higher when probability concentrates on one answer. Noul answers have no `confidence`; the probability itself is the signal. See TypeSafe's [Confidence](https://docs.typesafe.ai/confidence).
- `model` is the concrete revision that answered, such as `jev-1.13.0`. Log it.

Usage counts against the allowance at the model's [usage rates](https://bkper.com/docs/ai/models#usage-rates).

### Decision errors

Decision errors use the shared [error envelope](#errors). Validation failures name the field in `error.param`:

```json
{
    "error": {
        "message": "Unknown field: questions.route.threshold.",
        "type": "invalid_request_error",
        "param": "questions.route.threshold",
        "code": "invalid_request"
    }
}
```

Besides `invalid_request`, decision validation returns `400` with `missing_model`, `unsupported_model`, `invalid_state`, `invalid_questions`, `invalid_question`, `unsupported_question_type`, or `unsupported_parameter`. The last two follow [Open System One](https://github.com/bkper/open-systemone/blob/9c454705012d1b659320340e4846a5824bd8e4fc/SPEC.md#errors): `unsupported_question_type` for a question type the selected model does not answer, and `unsupported_parameter` for a field the specification defines that the model cannot honor, such as `reference_date`. Fix the field named in `error.param`; do not retry unchanged. A `400` with `provider_rejected` means the model rejected the request: check its size against the model's limits. A `502` with `provider_invalid_answer` means the model's answers broke an [Open System One answer guarantee](https://github.com/bkper/open-systemone/blob/9c454705012d1b659320340e4846a5824bd8e4fc/SPEC.md#answer-guarantees); `error.message` names the question and the rule, and no answers are returned.

### TypeSafe compatibility

Decision questions come from TypeSafe's [System One](https://docs.typesafe.ai/concepts/system-one), and request and answer shapes match TypeSafe's [`POST /v1/systemone`](https://docs.typesafe.ai/api). TypeSafe's guidance on questions, state, confidence, and patterns applies unchanged. Only the surroundings differ:

- **Endpoint and authentication.** Call `https://ai.bkper.app/v1/systemone` with a Bkper access token. TypeSafe API keys do not work here.
- **SDKs.** TypeSafe SDKs work with base URL `https://ai.bkper.app`, without `/v1`, and a Bkper access token. See [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai#ask-a-system-one-model).
- **Errors.** Bkper returns `400` where TypeSafe returns `422`, and `503` with `provider_overloaded` where TypeSafe returns `529`. A `429` can also mean the Bkper AI allowance is exhausted.
- **Usage.** Requests count against the Bkper AI allowance, not a TypeSafe account.
- **Images.** Send images as base64 `assets` in a JSON request, as in TypeSafe's [Images](https://docs.typesafe.ai/images) guide. TypeSafe SDKs upload images as multipart, which Bkper does not accept, so send image requests over HTTP. Bkper turns on TypeSafe's experimental image input for you. Jev reads `png`, `jpg`, and `jpeg` images; `webp`, which `clef` and `clairic` read, returns `unsupported_parameter`. Box questions are not supported. Image tokens count as input tokens.
- **Coding agents.** TypeSafe's [agent skill](https://docs.typesafe.ai/agent-skill) teaches questions and patterns. For a Bkper integration, also point the agent to this guide, `https://bkper.com/docs/api/ai-gateway.md`, for the endpoint, authentication, model IDs, and errors.

## Extraction questions

Extraction questions to `POST /v1/systemone` ask for values read, computed, estimated, or forecast from the state instead of judgments: `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast`. `clairic` is a Cloudflare preview (`preview: true` in `GET /v1/models`). Question and answer shapes follow [Open System One](https://github.com/bkper/open-systemone/blob/9c454705012d1b659320340e4846a5824bd8e4fc/SPEC.md#question-types).

This request reads a supplier email: it copies the invoice number, reads the issue date and payment terms, and estimates when the invoice will be paid. An extraction question can also ask for a computed value, such as a due date, but when a value feeds a Book, ask for its inputs and compute it in code.

```bash
curl --fail-with-body https://ai.bkper.app/v1/systemone \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "bkper-ai-source: my-app" \
  --data '{
    "model": "clairic",
    "state": "Hi, this is Marta Silva from Acme Paper. Invoice AP-5531 for 3 boxes of A4 paper is attached: total $184.50, issued 2026-03-02 with net 30 terms. Delivery is booked for March 9 at 10:15 am, and unloading takes about 40 minutes. Our last four monthly invoices were $172.00, $178.25, $181.10 and $184.50.",
    "reference_date": "2026-03-05",
    "questions": {
      "invoice_number": {"type": "text", "instructions": "Invoice number"},
      "contacts": {"type": "list", "items": "text", "instructions": "Each person named"},
      "total": {"type": "number", "decimals": 2, "unit": "USD", "instructions": "Invoice total"},
      "issue_date": {"type": "date", "instructions": "Invoice issue date"},
      "net_days": {"type": "number", "integer": true, "unit": "days", "instructions": "Net payment terms"},
      "delivery_time": {"type": "time", "instructions": "Time the delivery is booked for"},
      "delivery_at": {"type": "datetime", "instructions": "Date and time of the delivery"},
      "unloading": {"type": "duration", "unit": "minutes", "integer": true, "instructions": "How long unloading takes"},
      "monthly_amounts": {"type": "list", "items": "number", "decimals": 2, "instructions": "Each monthly invoice amount"},
      "days_to_pay": {"type": "estimate", "min": 0, "max": 90, "step": 1, "instructions": "Days after issue until this invoice is paid"},
      "next_invoices": {"type": "forecast", "min": 0, "max": 1000, "horizon": 2, "interval": "month", "unit": "USD", "instructions": "Amount of the next monthly invoices", "step": 0.01},
      "po_number": {"type": "text", "instructions": "Purchase order number"}
    }
  }'
```

### Extraction request

- **Settings** are optional except `items` on lists and `min` and `max` (and `horizon` on forecasts) on estimates and forecasts: `null_threshold` on value types; `unit`, `integer`, and `decimals` on numbers and durations; `step` and `scale` on estimates and forecasts; `quantiles: true` on estimates for the 1st to 99th percentiles; `interval` on forecasts. An invalid setting returns `400` with `invalid_question` and the setting in `error.param`.
- **`instructions`** is optional. Structured state and instructions are read as compact JSON text.
- **`reference_date`** (`YYYY-MM-DD`) resolves relative and year-less dates, such as "March 9" above.
- **`clairic`** accepts question names of up to 64 letters, digits, `_`, `.`, or `-`, starting with a letter or `_`, forecasts of up to 64 steps, and up to 4 image `assets` (4 MiB each, 8 MiB in total). Requests beyond these limits return `unsupported_parameter`.

### Extraction answers

A real response to the request above, with probabilities and means rounded:

```json
{
    "model": "clairic",
    "answers": {
        "invoice_number": {"type": "text", "value": "AP-5531", "guess": "AP-5531", "span": [49, 56], "p_null": 0, "confidence": 1},
        "contacts": {"type": "list", "value": ["Marta Silva"], "spans": [[12, 23]], "confidence": 0.28},
        "total": {"type": "number", "value": 184.5, "guess": 184.5, "p_null": 0, "confidence": 1},
        "issue_date": {"type": "date", "value": "2026-03-02", "guess": "2026-03-02", "p_null": 0, "confidence": 1},
        "net_days": {"type": "number", "value": 30, "guess": 30, "p_null": 0, "confidence": 1},
        "delivery_time": {"type": "time", "value": "10:15:00", "guess": "10:15:00", "p_null": 0, "confidence": 1},
        "delivery_at": {"type": "datetime", "value": "2026-03-09T10:15:00", "guess": "2026-03-09T10:15:00", "p_null": 0, "confidence": 1},
        "unloading": {"type": "duration", "value": 40, "guess": 40, "p_null": 0, "confidence": 1, "unit": "minutes"},
        "monthly_amounts": {"type": "list", "value": [172, 178.25, 181.1, 184.5], "confidence": 0.74},
        "days_to_pay": {"type": "estimate", "value": 30, "median": 30, "p10": 24, "p90": 35, "mean": 29.78, "p_below": 0, "p_above": 0},
        "next_invoices": {"type": "forecast", "steps": [{"value": 182.95, "median": 183.47, "p10": 171.24, "p90": 195.86, "mean": 182.95, "p_below": 0, "p_above": 0}, {"value": 183.74, "median": 184.1, "p10": 171.64, "p90": 196.86, "mean": 183.74, "p_below": 0, "p_above": 0}]},
        "po_number": {"type": "text", "value": null, "guess": "AP-5531", "span": [49, 56], "p_null": 1, "confidence": 0.99}
    },
    "truncated": false,
    "usage": { "input_tokens": 1337, "output_tokens": 0 }
}
```

Bkper checks every answer against the [Open System One answer guarantees](https://github.com/bkper/open-systemone/blob/9c454705012d1b659320340e4846a5824bd8e4fc/SPEC.md#answer-guarantees) before returning it:

- Value types have `value`, `p_null`, and `confidence`. `value` is `null` exactly when `p_null` is above the question's `null_threshold` (default 0.5), as for `po_number`; `guess` is still the most likely value.
- `span` is where `guess` was read: a half-open `[start, end)` range of Unicode code point offsets into `state_text` when present, else into `state`. For `text`, it covers exactly the guess. Computed values, and values read from images, have a `null` or absent span.
- Lists are never `null` and keep input order. Text lists have `spans`, one entry per item: its span, or `null` for an item read from an image.
- Estimates and every forecast step are within `[min, max]`, on the `step` grid, with `p10` ≤ `median` ≤ `p90`. A forecast has exactly `horizon` `steps`, nearest first. Estimates have `quantiles` only when their question sets `quantiles: true`; forecast steps never do.
- `state_text`, the text the model read, is returned when it differs from `state`, for example for structured state. `truncated: true` means the model read only the start of the state.

## System One caching

Bkper caches System One results, for decision and extraction questions alike, for 15 minutes per user. An identical request in that window returns the same answers without calling the model or consuming allowance, and repeats the original `usage`. Aliases of the same model share one cache entry. To get fresh answers, change the request or wait. See [Privacy, retention, and caching](https://bkper.com/docs/ai/models#privacy-retention-and-caching).

## Stream a response

Set `stream` to `true` to receive semantic server-sent events:

```bash
curl --no-buffer --fail-with-body https://ai.bkper.app/v1/responses \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "model": "grok",
    "input": "Explain the from-to movement model in one sentence.",
    "stream": true,
    "store": false
  }'
```

Each SSE `event:` name matches the event body's `type`. Sequence numbers increase monotonically. A stream ends with one terminal response event followed by `data: [DONE]`.

## Language model capabilities

For language generation, Bkper AI supports:

- all language model IDs listed by `GET /v1/models`;
- string input and explicit conversation item arrays;
- system, developer, user, and assistant messages;
- text and image input;
- inline PDF input through Base64 `input_file.file_data` on models that support files;
- JSON Schema structured output through `text.format` on models that support it;
- function tools, function calls, function outputs, and multiple tool calls where the model supports them;
- reasoning effort and summaries where supported;
- encrypted reasoning continuity where the provider supplies it;
- `prompt_cache_key` for short cache and session affinity;
- complete JSON responses and semantic SSE streaming.

Check `GET /v1/models` for each model's capabilities and limits. Requests with unsupported settings are rejected rather than silently changed.

### Structured JSON output

Set `text.format.type` to `json_schema` and provide a standard JSON Schema. Bkper AI maps the schema to each model provider's native structured-output mechanism.

- `strict: true` is preserved only when the selected model can enforce the submitted schema subset.
- `strict: false` supports schemas that require provider-supported flexibility, such as typed dynamic maps.
- Malformed supported keywords and incompatible schemas fail before provider dispatch. Bkper AI never silently changes a strict schema to non-strict behavior.

The returned structured JSON is contained in the assistant `output_text` and should still be parsed and validated by the client before use.

### Inline PDF input

Use one inline PDF source with a filename:

```json
{
    "type": "input_file",
    "filename": "document.pdf",
    "file_data": "<base64>"
}
```

Bkper AI validates the Base64 content and selected model capability before dispatch. It sends inline content through the provider's native document input and does not upload it to a hidden provider Files API.

Inline files are available only on models that advertise native support. The current xAI model does not support inline `file_data`. Use `GET /v1/models` to inspect current capabilities.

## Privacy and retention

Bkper disables provider storage on every request and keeps prompt and response content out of usage logs. Provider retention, caching, and Zero Data Retention status are listed in [Privacy, retention, and caching](https://bkper.com/docs/ai/models#privacy-retention-and-caching).

## Stateless behavior

Bkper AI does not persist response state:

- omitted `store` behaves as `false`;
- `store: false` is accepted;
- `store: true` is rejected;
- continue conversations by sending explicit prior items in `input`.

`prompt_cache_key` is a bounded cache hint. It is not a persisted response identifier.

## Unsupported features

The current profile rejects:

- `previous_response_id`;
- background responses;
- response retrieval or deletion;
- client `metadata`;
- `input_file.file_id` and `input_file.file_url`;
- inline file types or models without advertised native support, including xAI inline files;
- remote HTTP/HTTPS image URLs for Gemini; send Gemini images as inline data URLs;
- hosted provider tools;
- compaction endpoints;
- WebSocket transport;
- image generation, audio, speech, batches, and fine-tuning.

Unsupported fields fail explicitly rather than being ignored or passed to only one provider.

## Errors

Errors use an Open Responses-shaped envelope with stable Bkper error codes. `POST /v1/responses` and `POST /v1/systemone` normalize provider failures the same way. Branch on `error.code`, not only on the HTTP status, because `429` has two meanings.

| Status | Meaning                                                                         | `error.code` examples                                             | Retry                               |
| ------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `400`  | Invalid request, unavailable model, unsupported capability, or context overflow | `invalid_request`, `context_length_exceeded`, `provider_rejected` | No. Fix the field in `error.param`. |
| `400`  | The selected model's provider does not serve the caller's region                | `provider_region_unsupported`                                     | No. Choose a model from another provider. |
| `401`  | Missing or invalid Bkper bearer token                                           | `unauthorized`                                                    | No. Get a new Bkper token.          |
| `402`  | The authenticated subscription payment is overdue                               | `billing_overdue`                                                 | No                                  |
| `403`  | The account is not entitled to use Bkper AI                                     | `entitlement_unavailable`                                         | No                                  |
| `429`  | The monthly Bkper AI allowance is exhausted                                     | `usage_limit_exceeded`                                            | No                                  |
| `429`  | The upstream provider is throttled                                              | `provider_rate_limited`                                           | Yes, with backoff                   |
| `499`  | The client aborted the request                                                  | `request_aborted`                                                 | —                                   |
| `502`  | The selected upstream model provider or transport failed                        | `provider_error`, `provider_rejected`, `provider_invalid_answer` | A limited number of times           |
| `503`  | The provider is overloaded or quota usage is temporarily unavailable            | `provider_overloaded`, `usage_unavailable`                        | Yes, with backoff                   |

When a provider sends `retry-after` with a `429` or `503`, Bkper AI forwards it; wait at least that long before retrying. `401` and `403` always refer to your Bkper token or account. Upstream provider credential problems surface as `502`.

Bkper AI blocks new requests once the recorded monthly allowance is exhausted. There are no automatic paid Bkper AI overages and no automatic fallback to another protocol. Review the authenticated [Bkper AI usage dashboard](https://ai.bkper.app) for the current allowance and request attribution.

## Reference

Each operation has its own page. The machine-readable contract is [openapi.json](https://ai.bkper.app/openapi.json).

### Models

- [`GET /v1/models` — List available models](https://bkper.com/docs/api/ai-gateway/operations/listmodels.md)

### Responses

- [`POST /v1/responses` — Generate a response](https://bkper.com/docs/api/ai-gateway/operations/createresponse.md)

### System One

- [`POST /v1/systemone` — Evaluate typed questions](https://bkper.com/docs/api/ai-gateway/operations/createsystemone.md)
- [`POST /v1/decisions` — Evaluate typed questions](https://bkper.com/docs/api/ai-gateway/operations/createdecision.md)

