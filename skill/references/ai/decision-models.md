# Decision Models

A decision model answers bounded questions about a state. Each answer is typed: the probability that a statement is true, one option from a set you define, or a level on a scale you define. The model writes no text. The model evaluates; your code decides.

`POST /v1/decisions` serves decision models: models trained for calibrated decisions. [Jev](#jev-by-typesafe), from TypeSafe, is the first. The interface and its concepts come from TypeSafe's [System One](https://docs.typesafe.ai/concepts/system-one) API, and their documentation is a good companion to this page.

## When to use a decision model

| When your code needs                                          | Use                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| A yes/no, one of known options, or a level on a scale         | A decision model                                                |
| Text, explanations, code, tool calls, or a custom JSON object | A [language model](https://bkper.com/docs/ai/ai-gateway.md#send-a-complete-request) |

Why decision models suit accounting operations is covered in [AI Fundamentals](https://bkper.com/docs/ai/fundamentals.md#decision-models).

## How a request works

A request has one **state** and one or more **questions**. The state is what the model judges: a string, JSON object, or array. Prefer an object with descriptive field names. Decision models currently read text only, so convert images and files to text first.

The model evaluates each question independently, in parallel, against the same state, and returns one typed answer per question. There are three question types:

- **`noul`** — _Is this true?_ Optional `criteria` describe what yes and no mean. Returns `noul`, the probability of yes from 0 to 1.
- **`choice`** — _Which one of these?_ `criteria` maps 1–255 options to descriptions, or `null`. Returns the `choice` with `probabilities` and `confidence`.
- **`score`** — _Which level on this scale?_ `criteria` lists 2–10 levels, lowest first. Returns a weighted `score` with `legend`, `probabilities`, and `confidence`.

Ask one snap judgment per question — something a knowledgeable person decides in seconds. Split bigger judgments into several questions and combine the answers in code. Keep arithmetic, balances, and date comparisons in code too, and ask the model only the part that needs judgment. See TypeSafe's [Primitives](https://docs.typesafe.ai/primitives) and [State](https://docs.typesafe.ai/concepts/state).

## Send a request

For an incoming bank line, this request asks three questions at once: which Account it belongs to, whether it is already recorded, and how urgently it needs review.

```bash
curl --fail-with-body https://ai.bkper.app/v1/decisions \
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
      "review_priority": {
        "type": "score",
        "instructions": "How urgently should a bookkeeper review `bank_line`?",
        "criteria": [
          "Routine: consistent with normal activity",
          "Check: unusual but plausibly legitimate",
          "Urgent: large, unapproved, or suspicious"
        ]
      }
    }
  }'
```

- **`model`** — any model with `type: "decision"` in [`GET /v1/models`](https://bkper.com/docs/ai/ai-gateway.md#model-ids). Each entry lists its `question_types`, `context_window`, and `max_state_question_tokens`.
- **Question IDs** such as `account` are yours. Answers come back under the same IDs, but **IDs are not sent to the model**, so each `instructions` must stand on its own.
- **Refer to state fields by name** in backticks, as in `` `bank_line` ``.
- Each question accepts only `type`, `instructions`, and `criteria`. Instructions, descriptions, and levels can be strings or [structured JSON](https://docs.typesafe.ai/primitives/advanced).

## Read the response

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
                "Office Supplies": 1,
                "Cloud Hosting": 0,
                "Travel": 0,
                "Software Subscriptions": 0
            }
        },
        "already_recorded": {
            "type": "noul",
            "noul": 0.89
        },
        "review_priority": {
            "type": "score",
            "score": 0.09,
            "confidence": 0.86,
            "legend": {
                "0": "Routine: consistent with normal activity",
                "1": "Check: unusual but plausibly legitimate",
                "2": "Urgent: large, unapproved, or suspicious"
            },
            "probabilities": {
                "0": 0.91,
                "1": 0.09,
                "2": 0
            }
        }
    },
    "usage": { "input_tokens": 607, "output_tokens": 86 }
}
```

Bkper validates every answer before returning it, so your code can rely on these guarantees:

- `answers` has exactly one entry per question ID, and each answer's `type` matches its question.
- `choice` is always one of your `criteria` keys.
- `score` is the probability-weighted level, from `0` to the number of levels minus one. It can fall between levels.
- `probabilities` has one entry per option or level, and `legend` maps level indexes back to your text. Read both by key: order is not guaranteed, and values can be exactly `0` or `1`.
- `confidence`, on choice and score answers, runs from 0 to 1 and is higher when probability concentrates on one answer. Noul answers have no `confidence`; the probability itself is the signal. See TypeSafe's [Confidence](https://docs.typesafe.ai/confidence).
- `model` is the concrete revision that answered, such as `jev-1.13.0`.

Usage counts against your allowance at the model's [usage rates](https://bkper.com/docs/ai/models.md#usage-rates).

### Context changes confidence

Ask about the same bank line without `existing_transaction`:

```json
{
    "model": "jev",
    "state": {
        "bank_line": {
            "date": "2025-03-11",
            "description": "AMAZON MKTPL*2K4LM",
            "amount": 89.9,
            "direction": "money out of Checking"
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
        }
    }
}
```

```json
{
    "model": "jev-1.13.0",
    "answers": {
        "account": {
            "type": "choice",
            "choice": "Office Supplies",
            "confidence": 0.75,
            "probabilities": {
                "Software Subscriptions": 0.14,
                "Cloud Hosting": 0.02,
                "Office Supplies": 0.81,
                "Travel": 0.02
            }
        }
    },
    "usage": { "input_tokens": 440, "output_tokens": 52 }
}
```

The top option is the same, but confidence drops from 1 to 0.75: the model reports that it is less sure.

Give the model the context a person would need, such as nearby Transactions, how an Account is usually described, or Book and Account properties. Select that context in code. For example, find Transactions with the same amount inside a date window, then ask the model only whether the descriptions describe the same movement.

## Turn answers into decisions

An answer is a judgment, not permission to change a Book. Your code owns the thresholds and the actions, and sends uncertain cases to a person. This is TypeSafe's [confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing) pattern:

```ts
// Keep questions and thresholds in one reviewable place.
const DUPLICATE_THRESHOLD = 0.8;
const REVIEW_SCORE_THRESHOLD = 1.5;
const AUTO_POST_CONFIDENCE = 0.9;

interface BankLineAnswers {
    account: { type: 'choice'; choice: string; confidence: number };
    already_recorded: { type: 'noul'; noul: number };
    review_priority: { type: 'score'; score: number; confidence: number };
}

type BankLineDecision =
    | { action: 'check-duplicate' }
    | { action: 'review'; suggestedAccount: string }
    | { action: 'post'; toAccount: string; confidence: number };

export function decideBankLine(answers: BankLineAnswers): BankLineDecision {
    if (answers.already_recorded.noul >= DUPLICATE_THRESHOLD) {
        return { action: 'check-duplicate' };
    }
    if (
        answers.review_priority.score >= REVIEW_SCORE_THRESHOLD ||
        answers.account.confidence < AUTO_POST_CONFIDENCE
    ) {
        return { action: 'review', suggestedAccount: answers.account.choice };
    }
    return {
        action: 'post',
        toAccount: answers.account.choice,
        confidence: answers.account.confidence,
    };
}
```

The first response returns `check-duplicate`: the movement is probably already recorded. The bank line on its own, at 0.75 confidence, goes to `review`.

When your code does post, it creates a normal Transaction from `Checking` to the chosen Account, so the Book stays zero-sum whatever the model answered. The risks to control are a wrong Account and a duplicate movement, which is why those checks come before posting. Store `model` and `confidence` as Transaction properties for the audit trail.

Start with conservative thresholds, test them against your own records, and re-check them when the returned `model` changes. For more designs, see TypeSafe's [Patterns](https://docs.typesafe.ai/patterns) and [Cookbooks](https://docs.typesafe.ai/cookbooks), and the open-source [Merge Duplicates app](https://github.com/bkper/bkper-apps/tree/main/merge-duplicates), which suggests duplicate pairs for human review.

## Call from code

TypeSafe's JavaScript SDK, `@typesafe-ai/sdk`, works with Bkper AI and infers answer types from your questions. Any other HTTP client can call `POST /v1/decisions` directly:

- **In a Bkper Platform app Worker**, send no `Authorization` header. Platform outbound adds authorization and app attribution.
- **In scripts and servers**, send your own Bkper access token as a bearer token.
- **In a browser page**, send the signed-in user's access token. Any origin may call, usage counts against that user's allowance, and the user can see your questions. See [Call from a browser](https://bkper.com/docs/ai/ai-gateway.md#call-from-a-browser).
- **In [Bkper CLI Agent](https://bkper.com/docs/ai/bkper-cli-agent.md#what-it-can-do)**, no setup is needed. Describe the outcome and the agent asks the decision model for you.

See [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md#ask-a-decision-model) for the SDK setup in both cases and its limits with Bkper AI.

## Errors and retries

Errors use the same envelope as every [Bkper AI endpoint](https://bkper.com/docs/ai/ai-gateway.md#errors). Branch on `error.code`, not only on the HTTP status:

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

| Status      | `error.code`                                                                                                                                   | What to do                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `400`       | `invalid_request`, `missing_model`, `unsupported_model`, `invalid_state`, `invalid_questions`, `invalid_question`, `unsupported_question_type` | Fix the field named in `error.param`. Do not retry unchanged.              |
| `400`       | `provider_rejected`                                                                                                                            | The model rejected the request. Check its size against the model's limits. |
| `401`–`403` | `unauthorized`, `billing_overdue`, `entitlement_unavailable`                                                                                   | Fix authentication or account access. Do not retry.                        |
| `429`       | `usage_limit_exceeded`                                                                                                                         | The monthly allowance is exhausted. Do not retry.                          |
| `429`       | `provider_rate_limited`                                                                                                                        | Retry with backoff. Honor `retry-after` when present.                      |
| `503`       | `provider_overloaded`, `usage_unavailable`                                                                                                     | Retry with backoff. Honor `retry-after` when present.                      |
| `502`       | `provider_error`, `provider_rejected`                                                                                                          | Retry a limited number of times, then fail.                                |

## Caching

Bkper caches decision results for 15 minutes per user. An identical request in that window returns the same answers without calling the model or consuming allowance, and repeats the original `usage`. Aliases of the same model share one cache entry. To get fresh answers, change the request or wait. See [Privacy, retention, and caching](https://bkper.com/docs/ai/ai-gateway.md#privacy-retention-and-caching).

## Common mistakes

- **Sending Responses fields.** The body accepts only `model`, `state`, and `questions`. `input`, `stream`, `store`, `temperature`, and `metadata` are rejected.
- **Putting the question in the ID.** The model never sees IDs. Write the full question in `instructions`.
- **Asking for analysis.** Ask one snap judgment per question and combine answers in code.
- **Asking the model to calculate.** Match amounts, compute date windows, and check balances in code.
- **Treating `noul` as a boolean or `score` as an integer.** Both are continuous. Compare them with thresholds.
- **Expecting an explanation.** Decision models return no text. Use a [language model](https://bkper.com/docs/ai/ai-gateway.md) when you need one.

## Jev by TypeSafe

[Jev](https://docs.typesafe.ai/introduction) is TypeSafe's flagship model and the first System One model. Its Bkper model ID is `jev`.

- **Versions.** `jev-latest` and versioned IDs are accepted but always select the current Jev; you cannot pin a version. Log the returned `model`, and re-check tuned thresholds when it changes.
- **Input.** Text only. English is Jev's primary training language; other languages work with lower accuracy.
- **Known weak spots.** Literal reading, arithmetic, date comparison, and large states full of irrelevant detail. See [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

### Differences from the TypeSafe API

Request and answer shapes match TypeSafe's [`POST /v1/systemone`](https://docs.typesafe.ai/api), so TypeSafe's guidance on questions, state, confidence, and patterns applies unchanged. Only the surroundings differ:

- **Endpoint and authentication.** Call `https://ai.bkper.app/v1/decisions` with a Bkper access token. TypeSafe API keys do not work here.
- **SDKs.** TypeSafe SDKs work with base URL `https://ai.bkper.app` and a Bkper access token. See [Call from code](#call-from-code).
- **Errors.** Bkper returns `400` where TypeSafe returns `422`, and `503` with `provider_overloaded` where TypeSafe returns `529`. A `429` can also mean your Bkper AI allowance is exhausted.
- **Usage.** Requests count against your [Bkper AI allowance](https://bkper.com/docs/ai/models.md#how-usage-works), not a TypeSafe account.

### Build with a coding agent

TypeSafe's [agent skill](https://docs.typesafe.ai/agent-skill) gives coding agents context on questions and patterns. When you use it for a Bkper integration, point the agent to this page — `https://bkper.com/docs/ai/decision-models.md` — for the endpoint, authentication, model ID, and errors.

## Learn more

- [`createDecision` API reference](https://bkper.com/docs/api/ai/operations/createdecision.md) — the field-by-field contract.
- [Models and Usage](https://bkper.com/docs/ai/models.md) — decision models, limits, and usage rates.
- [Bkper AI Gateway](https://bkper.com/docs/ai/ai-gateway.md) — access, tokens, and privacy.
- [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai.md) — TypeSafe SDK setup for apps and scripts.
- TypeSafe: [System One](https://docs.typesafe.ai/concepts/system-one), [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer), [Primitives](https://docs.typesafe.ai/primitives), [State](https://docs.typesafe.ai/concepts/state), [Confidence](https://docs.typesafe.ai/confidence), and [Patterns](https://docs.typesafe.ai/patterns).
