# Bkper Managed Agent API

> Build apps, chat bots, and scripts on the agent behind Bkper Agent — the guide, with a page for each operation: sessions, instructions, files, and streams.

The Managed Agent API lets you build intelligent apps on Bkper's agent: a private cloud workspace with the `bkper` CLI, Bkper context, files, and durable sessions. Your app owns its screens, prompts, and instructions; Bkper runs the agent.

Build, for example:

- a Bkper platform app with its own chat, in a Book or on its own page;
- a chat bot for Slack, Teams, or Discord, with one session per thread;
- a scheduled script that asks for a monthly report and saves the file.

Sessions belong to the user, not the app: work started in one app continues in any other, including [Bkper Agent](https://bkper.com/docs/ai/bkper-agent), the agent in Bkper's Books. Bkper Agent is built only on this API and is its reference implementation. Usage counts against the user's Bkper AI allowance; see [Models and Usage](https://bkper.com/docs/ai/models). To call models directly, without an agent or workspace, use the [AI Gateway API](https://bkper.com/docs/api/ai-gateway). Building a Bkper app? Start with [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai).

## Requirements

- A Bkper account in the Managed Agent private beta. Other accounts get 403 `agent_beta_required`.
- A Bkper OAuth access token for the user the agent acts as. [Bkper platform apps](https://bkper.com/docs/platform/apps/overview) need none: call the API from the app's server, and the platform adds the user's credentials, as it does for Bkper AI.
- A server, bot, or script to call the API. Browsers on other websites are refused: the API sends no CORS headers and rejects cross-origin writes with 403 `origin_forbidden`.

## Configure your client

| Setting | Value |
| --- | --- |
| Base URL | `https://agent.bkper.app` |
| Authentication | `Authorization: Bearer <Bkper access token>` |
| Contract | [`https://agent.bkper.app/openapi.json`](https://agent.bkper.app/openapi.json), OpenAPI 3.1 |

Treat the token as a secret. Never put it in a URL, a log, or a browser bundle.

## Get a token for local testing

```bash
bkper auth login
export BKPER_TOKEN="$(bkper auth token)"
```

For a bot or a service, get tokens for its Bkper account through your OAuth flow; see [REST API authentication](https://bkper.com/docs/platform/scripts/rest-api).

## Quick start

1. Create a session with instructions and a first message. The response is the new session, with its `id`. The idempotency key is also the input's ID.

```bash
curl --fail-with-body https://agent.bkper.app/v1/sessions \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: first-session-1" \
  --data '{
    "instructions": "Answer in at most three short paragraphs. Never change a Book.",
    "input": { "content": [{ "type": "text", "text": "List my Books and what each one tracks." }] }
  }'
```

2. Wait for the answer. Poll until `status` is `completed`, `failed`, or `withdrawn`. A completed input names the reply in `answerEntryId`.

```bash
curl --fail-with-body \
  https://agent.bkper.app/v1/sessions/${SESSION_ID}/inputs/first-session-1 \
  -H "Authorization: Bearer ${BKPER_TOKEN}"
```

3. Read the reply. Its `content` holds `text` blocks, plus `thinking` and `tool_call` blocks for the agent's reasoning and steps.

```bash
curl --fail-with-body \
  https://agent.bkper.app/v1/sessions/${SESSION_ID}/entries/${ANSWER_ENTRY_ID} \
  -H "Authorization: Bearer ${BKPER_TOKEN}"
```

4. Continue the conversation with `POST /v1/sessions/{sessionId}/inputs` and a new key.

Interactive clients watch the session's stream instead of polling; see [Observe progress](#observe-progress).

## Instructions

`instructions` add context to ground the agent's reasoning: the task, who it works for, how to answer, and what it may change. Set them when you create a session, change them with `PATCH /v1/sessions/{sessionId}`, and clear them with `null`. A change applies from the agent's next step.

The agent receives, in order:

1. **Bkper's base**: the workspace, Bkper's accounting model, and rules no interface can relax.
2. **Your `instructions`.**
3. **Each message**, with its optional `bookContext` as labeled information, never as instructions or permission.
4. **Each message's attached files**, copied into the workspace and listed with their paths as labeled information.

There is no default. Without `instructions`, the agent follows only Bkper's base, which does not ask anyone before acting. Bkper Agent sends its own instructions, so it asks questions and confirms changes; your interface decides its own.

For a Slack bot:

```text
You answer in a Slack thread. Use Slack mrkdwn,
keep replies under 150 words, and end with one
suggested next step. Never change a Book: explain
what you would change instead.
```

For a scheduled close script:

```text
You prepare the monthly close pack for the Book in
the message. Post nothing. Publish one PDF with the
income statement and balance sheet, then reply with
the totals you checked.
```

- Instructions can be up to 16,000 characters.
- A fork keeps its parent's instructions unless the create request sets new ones.
- Sessions keep the text they were given. Updating your client changes only the sessions it creates or patches.

## Who the agent acts as

Every request acts as the user whose token you send. That user's Book permissions, sessions, files, and Bkper AI allowance apply. Their sessions appear in their Bkper Agent too.

- **Personal tools**: use each person's own token, so each person sees only their Books.
- **Shared channel bots**: everyone in the channel acts with the bot's account. Use a dedicated Bkper account, shared only on the Books the channel needs, with the lowest permission that does the job.
- **Read-only bots**: instructions are guidance, not enforcement. To guarantee read-only behavior, share the Books with the bot's account as View only.

Without confirmation in your instructions, Book changes happen at once. Bkper records each change as an event made by the agent, and transactions can still be reviewed, edited, or trashed afterward.

## Sessions and inputs

- **Session**: one conversation, with its history, model, title, and `instructions`.
- **Entry**: one immutable item of history: `user`, `assistant`, `tool_result`, or `compaction`.
- **Input**: one message you sent, with its status: `queued`, `running`, `completed`, `withdrawn`, or `failed`.

`delivery` sets how a new input reaches the agent:

| `delivery` | Effect | Default |
| --- | --- | --- |
| `prompt` | Starts a run | When idle |
| `steer` | Delivered after the current step, to change direction | — |
| `followUp` | Queued until the current run ends | While working |

`POST /v1/sessions/{sessionId}/stop` stops the run and withdraws queued inputs. It returns once the stop is recorded, without waiting.

### Idempotency

Every create, input, and upload request needs an `Idempotency-Key` of 1–128 letters, digits, underscores, or hyphens.

- Repeating a request with the same key returns the original session, input, or file, so retries are safe.
- The same key with different content returns 409 `idempotency_conflict`.
- For bots, derive the key from the platform's message ID. A Slack event delivered twice then reaches the agent once.

### Book context

Send `bookContext: { "bookId": "…", "query": "…" }` with an input when the message is about a Book. Bkper checks the user's access when the agent opens the Book.

### Forks

Create a session with `parent` to continue from a point in another session:

- `position: "at"` (default) continues after a finished reply.
- `position: "before"` starts before one of the user's messages, to send an edited version.

A fork copies the conversation only, not workspace files or Book changes.

## Observe progress

`GET /v1/sessions/{sessionId}/stream` sends server-sent events over an authenticated `fetch`. Browsers' `EventSource` cannot send the token.

- The first event is a `snapshot`: the session, the latest entries, live progress, and queued inputs.
- Then `update` events carry only what changed, about every 100 ms.
- Store entries by `id`; replace `session`, `live`, and `queue` with each update.
- The stream closes after five minutes. Reconnect for a fresh snapshot.
- Disconnecting never stops the agent.

`GET /v1/sessions/stream` streams the user's session list in the same way, for clients that show sessions created elsewhere.

## Files

Files go both ways as the same `File` resource. `origin` tells them apart:

- `upload` — a file the user gave the agent;
- `publish` — a file the agent delivered.

### Give the agent files

Upload each file, then attach the returned IDs to an input.

1. **Upload the raw bytes** with `POST /v1/files`. Any type is accepted.

```bash
curl --fail-with-body https://agent.bkper.app/v1/files \
  -H "Authorization: Bearer $BKPER_TOKEN" \
  -H "Idempotency-Key: statement-2026-03" \
  -H "Content-Type: application/pdf" \
  -H "Content-Disposition: attachment; filename*=UTF-8''extrato-mar%C3%A7o.pdf" \
  --data-binary @extrato-março.pdf
```

| Header                | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `Idempotency-Key`     | Required. The same key and bytes return the same file                   |
| `Content-Length`      | Required; HTTP clients set it. Up to 25 MiB                             |
| `Content-Type`        | Optional. Recorded as declared, unverified                              |
| `Content-Disposition` | Optional. The file name, as `filename*=UTF-8''…` or `filename="…"`. Without it: `upload` |

The response is `201` with the `File`:

```json
{
  "id": "7f3c1a2b-…",
  "origin": "upload",
  "name": "extrato-março.pdf",
  "mediaType": "application/pdf",
  "size": 482113,
  "sha256": "9a1e…",
  "createdAt": "1767225600000",
  "expiresAt": "1769817600000",
  "createdBy": "…"
}
```

2. **Send the IDs as `file` parts** of an input, or of the first input when creating a session. Uploads belong to the user, not to a session.

```json
{
  "content": [
    { "type": "text", "text": "Record these statement lines in the Book" },
    { "type": "file", "fileId": "7f3c1a2b-…" }
  ]
}
```

An input carries up to 10 files, each once, and some text or at least one file. It may name any of the user's files still kept, including files the agent published.

Before the agent reads the input, each file is copied into its workspace, at `/workspace/uploads/<fileId>/<name>`. The agent gets their paths, names, declared types, and sizes, labeled as information, never as instructions. It processes every format with code, and reads images to see them when the session's model accepts images (`inputModalities` in `GET /v1/models`). The user's entry in the history shows their own text and the same `file` parts.

### Files the agent delivers

When the agent publishes a file, a `tool_result` entry carries a `file` part with `fileId`, `name`, `mediaType`, and `size`. List a session's published files with `GET /v1/sessions/{sessionId}/files`.

### Download, retention, and quotas

- `GET /v1/files/{fileId}` returns the `File`; `GET /v1/files/{fileId}/content` its bytes, always as an attachment. The `Content-Type` is the allowlisted type for the name, never an upload's declared type; anything else is `application/octet-stream`.
- Every stored copy is deleted 30 days after creation, at `expiresAt`. Downloads then return `410 file_gone`, and inputs naming the file return `410 file_gone`. The `File` and the parts in the history remain.
- Quotas count only files created in the last 30 days, separately for each origin: 1,000 files and 1 GiB of uploads, and 1,000 files and 1 GiB of published files. Uploads never block publishing. A full upload quota returns `409 file_quota_exceeded`; a full publish quota fails the agent's `publish`.

## Example: a chat bot

A Slack bot that keeps one session per thread. The same shape works for Teams and Discord.

```ts
const AGENT = 'https://agent.bkper.app';
const INSTRUCTIONS =
    'You answer in a Slack thread. Use Slack mrkdwn. Keep it short.';

// Slack thread → session ID. Keep it in your own store.
const sessions = new Map<string, string>();

async function agent(path: string, body?: unknown, key?: string) {
    const response = await fetch(AGENT + path, {
        method: body ? 'POST' : 'GET',
        headers: {
            Authorization: `Bearer ${await botToken()}`,
            'Content-Type': 'application/json',
            ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error.code);
    return result;
}

type SlackEvent = { event_id: string; thread_ts: string; text: string };

export async function reply(event: SlackEvent): Promise<string> {
    const input = { content: [{ type: 'text', text: event.text }] };
    // The event ID is the key: a redelivered event arrives once.
    const key = event.event_id;
    let id = sessions.get(event.thread_ts);
    if (id) {
        await agent(`/v1/sessions/${id}/inputs`, input, key);
    } else {
        const body = { instructions: INSTRUCTIONS, input };
        id = (await agent('/v1/sessions', body, key)).id as string;
        sessions.set(event.thread_ts, id);
    }
    for (;;) {
        const sent = await agent(`/v1/sessions/${id}/inputs/${key}`);
        if (sent.status === 'completed') {
            const answer = await agent(
                `/v1/sessions/${id}/entries/${sent.answerEntryId}`
            );
            type Part = { type: string; text?: string };
            return (answer.content as Part[])
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join('\n');
        }
        if (sent.status === 'failed' || sent.status === 'withdrawn') {
            throw new Error(sent.error?.code ?? sent.status);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
```

`botToken()` returns a current access token for the bot's Bkper account. A message sent while the agent is still working is queued as a follow-up, so a busy thread never loses a message.

Acknowledge each Slack event at once and post the reply when `reply` returns: Slack expects an answer within three seconds, and an agent run usually takes longer.

## Limits

| Limit | Value |
| --- | --- |
| Message text | 16,000 characters in total, up to 16 parts |
| Files per message | 10 |
| Request body (JSON) | 64 KiB |
| Uploaded or published file | 25 MiB |
| Stored files per user | 1,000 files and 1 GiB each for uploads and published files, over 30 days |
| File retention | 30 days after creation |
| `instructions` | 16,000 characters |
| `bookContext.query` | 4,000 characters |
| List page | 50 sessions, entries, or files |

## Errors

Errors are `{ "error": { "code", "type", "message" } }`. Branch on `code`.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request`, `unknown_model`, `unknown_thinking_level` | A field is invalid or unknown |
| 401 | `unauthorized`, `authentication_failed` | The token is missing, invalid, or expired |
| 403 | `agent_beta_required` | The account is not in the private beta |
| 403 | `origin_forbidden` | A browser on another website sent a write |
| 404 | `not_found`, `parent_not_found`, `file_not_found` | No such resource for this user |
| 405 | `method_not_allowed` | The path does not support the method |
| 409 | `idempotency_conflict` | The key was used with different content |
| 409 | `invalid_fork_point` | The fork point is not a finished reply or a user message |
| 409 | `input_running` | The input is already running and cannot be withdrawn |
| 409 | `file_quota_exceeded` | The user's upload quota is full |
| 410 | `file_gone` | The file's stored copy was deleted |
| 411 | `length_required` | An upload has no `Content-Length` |
| 413 | `request_too_large`, `file_too_large` | The JSON body exceeds 64 KiB, or the upload 25 MiB |
| 503 | `service_unavailable`, `authentication_failed` | A dependency is unavailable; retry with backoff |

Model failures appear on the failed input and reply as `error.code`, such as `usage_limit_exceeded` when the monthly Bkper AI allowance is used up.

## Compatibility

The API is versioned under `/v1`. To keep working as it grows:

- ignore fields you do not know;
- show unknown entry, block, and part types generically;
- treat unknown statuses and error codes as generic.

## Reference

Each operation has its own page. The machine-readable contract is [openapi.json](https://agent.bkper.app/openapi.json).

### Sessions

- [`GET /v1/sessions` — List sessions](https://bkper.com/docs/api/managed-agent/operations/listsessions.md)
- [`POST /v1/sessions` — Create or fork a session](https://bkper.com/docs/api/managed-agent/operations/createsession.md)
- [`GET /v1/sessions/{sessionId}` — Get a session](https://bkper.com/docs/api/managed-agent/operations/getsession.md)
- [`PATCH /v1/sessions/{sessionId}` — Update a session](https://bkper.com/docs/api/managed-agent/operations/updatesession.md)
- [`GET /v1/sessions/{sessionId}/entries` — List history entries](https://bkper.com/docs/api/managed-agent/operations/listentries.md)
- [`GET /v1/sessions/{sessionId}/entries/{entryId}` — Get a full entry](https://bkper.com/docs/api/managed-agent/operations/getentry.md)
- [`POST /v1/sessions/{sessionId}/compact` — Compact earlier context](https://bkper.com/docs/api/managed-agent/operations/compactsession.md)

### Inputs

- [`POST /v1/sessions/{sessionId}/inputs` — Send an input](https://bkper.com/docs/api/managed-agent/operations/sendinput.md)
- [`GET /v1/sessions/{sessionId}/inputs/{inputId}` — Get an input](https://bkper.com/docs/api/managed-agent/operations/getinput.md)
- [`POST /v1/sessions/{sessionId}/inputs/{inputId}/withdraw` — Withdraw a queued input](https://bkper.com/docs/api/managed-agent/operations/withdrawinput.md)
- [`POST /v1/sessions/{sessionId}/stop` — Stop the current run](https://bkper.com/docs/api/managed-agent/operations/stopsession.md)

### Streams

- [`GET /v1/sessions/stream` — Observe the session list](https://bkper.com/docs/api/managed-agent/operations/observesessions.md)
- [`GET /v1/sessions/{sessionId}/stream` — Observe a session](https://bkper.com/docs/api/managed-agent/operations/observesession.md)

### Files

- [`GET /v1/sessions/{sessionId}/files` — List published files](https://bkper.com/docs/api/managed-agent/operations/listfiles.md)
- [`POST /v1/files` — Upload a file](https://bkper.com/docs/api/managed-agent/operations/uploadfile.md)
- [`GET /v1/files/{fileId}` — Get file metadata](https://bkper.com/docs/api/managed-agent/operations/getfile.md)
- [`GET /v1/files/{fileId}/content` — Download a file](https://bkper.com/docs/api/managed-agent/operations/downloadfile.md)

### Models

- [`GET /v1/models` — List models](https://bkper.com/docs/api/managed-agent/operations/listmodels.md)

