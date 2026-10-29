# Bkper Managed Agent API

> Build apps, chat bots, and scripts on the agent behind Bkper Agent — the guide, with a page for each operation: sessions, instructions, files, and streams.

The Managed Agent API lets you build intelligent apps on Bkper's agent: a private cloud workspace with the `bkper` CLI, Bkper context, files, and durable sessions. Your app owns its screens, prompts, and instructions; Bkper runs the agent.

Build, for example:

- a Bkper platform app with its own chat, in a Book or on its own page;
- a chat bot for Slack, Teams, or Discord, with one session per thread and each message's sender in its `attributes`;
- a scheduled script that asks for a monthly report and saves the file.

Each app has its own workspace for each user: its sessions, files, and sandbox stay apart from that user's other apps and from [Bkper Agent](https://bkper.com/docs/ai/bkper-agent), the agent in Bkper's Books. Calls with a plain Bkper token, such as from a script, work in the user's own workspace, which Bkper Agent shows. Bkper Agent is built only on this API and is its reference implementation. Usage counts against the user's Bkper AI allowance; see [Models and Usage](https://bkper.com/docs/ai/models). To call models directly, without an agent or workspace, use the [AI Gateway API](https://bkper.com/docs/api/ai-gateway). Building a Bkper app? Start with [Add Bkper AI to an App](https://bkper.com/docs/platform/apps/ai).

## Requirements

- A Bkper account with an email address.
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

3. Read the reply. Its `content` holds `text` blocks, plus `thinking` and `tool_call` blocks for the agent's reasoning and steps; a step's `summary` names it in a few plain words.

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
3. **Each message**, with its optional `bookContext` and `attributes` as labeled information, never as instructions or permission.
4. **Each message's attached files**, copied into the workspace and listed with their paths as labeled information.

There is no default. Without `instructions`, the agent follows only Bkper's base, which does not ask anyone before acting. Bkper Agent sends its own instructions, so it asks questions and makes only the changes it is asked for; your interface decides its own.

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
- A fork keeps its parent's instructions unless the create request sets new ones. Continuing someone else's session never takes theirs.
- Sessions keep the text they were given. Updating your client changes only the sessions it creates or patches.

## Who the agent acts as

Every request acts as the user whose token you send. That user's Book permissions and Bkper AI allowance apply.

The workspace (sessions, files, and sandbox) depends on who calls. Bkper sets the app from the platform side, never from the request:

| Caller | Workspace |
| --- | --- |
| Bkper Agent, or a script or CLI with a plain Bkper token | The user's own |
| A [Bkper platform app](https://bkper.com/docs/platform/apps/overview) calling from its server | The user's, for that app |
| A Bkper channel bot, such as a Slack bot | The bot's account, for that bot |

Book changes made in an app's workspace are attributed to that app, with its name and logo.

A workspace's sessions are private to its user, unless the user [shares one](#share-a-session) from their own workspace.

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

### Message attributes

Send `attributes` with an input for what the agent should know about the message but the person did not type: who sent it, from which channel, or the thread messages before it. They are strings by name:

```json
{
  "content": [{ "type": "text", "text": "suggest an answer here" }],
  "attributes": {
    "sender": "Alice (U0123)",
    "channel": "#finance",
    "thread": "Bob: can we pay the March invoice from Acme?"
  }
}
```

The agent receives them after the message as labeled information, never as instructions or permission: identity comes only from the token. The input and the user's entry keep the text as sent, with `attributes` beside it. Send per-message context here rather than in `instructions`, which stay the same for every message.

### Forks

Create a session with `parent` to continue from a point in another session:

- `position: "at"` (default) continues after a finished reply.
- `position: "before"` starts before one of the user's messages, to send an edited version.

A fork copies the conversation only, not workspace files or Book changes.

`parent` may also name a session someone else shares with the user, to [continue it](#continue-a-shared-session) as their own.

## Observe progress

`GET /v1/sessions/{sessionId}/stream` sends server-sent events over an authenticated `fetch`. Browsers' `EventSource` cannot send the token.

- The first event is a `snapshot`: the session, the latest entries, live progress, and queued inputs.
- Then `update` events carry only what changed, about every 100 ms.
- Store entries by `id`; replace `session`, `live`, and `queue` with each update.
- The stream closes after five minutes. Reconnect for a fresh snapshot.
- Disconnecting never stops the agent.

`GET /v1/sessions/stream` streams the user's session list in the same way, for clients that show sessions created elsewhere.

## Share a session

A user can share a session read-only, so colleagues and Book collaborators can follow it live, learn from it, or help. Only the user's own workspace shares: an app's workspace cannot share its sessions or read others'.

Turn sharing on or off with `PATCH /v1/sessions/{sessionId}` and `{ "shared": true }` or `false`. Sessions are not shared by default.

| Session | Shared with |
| --- | --- |
| Started outside a Book | Everyone in the owner's hosted domain |
| Started in a Book | Everyone in the owner's hosted domain, and everyone who can view that Book, also outside the domain |

- A session's Book is its first input's `bookContext`, shown as `bookId`. It is fixed once set.
- The domain is the account's hosted domain as Bkper verified it, never an email address. Without one, a session outside a Book cannot be shared: 409 `share_unavailable`.
- To share a session started in a Book, the user must view that Book: 409 `book_access_required`.
- Viewing a Book means the `OWNER`, `EDITOR`, `POSTER`, or `VIEWER` permission; not `RECORDER`.
- Readers are checked on every request and stream connection, never remembered. Turning sharing off ends their streams at once; copies and exports already made stay with whoever has them.
- When the user can no longer view the session's Book, it leaves that Book: its Book list drops it, and readers outside the user's domain lose it. The domain's audience stays. It returns when the user can view the Book again and sends a message or turns sharing on.
- The user's own list shows `shared: true` on the sessions they share.

### Read a shared session

Readers use the session routes with the shared session's ID: the session, now with `owner.name`, its entries, stream, published files, and [export](#export-a-session). They download its files through `GET /v1/sessions/{sessionId}/files/{fileId}` and `…/content`: files its history shows, published in it or attached to its messages, under the same retention. `/v1/files/{fileId}` serves only the user's own files.

Readers cannot rename, archive, share, send to, stop, or compact someone else's session: those requests return 404, as for any session that is not theirs.

### Find shared sessions

`GET /v1/shared` lists sessions other people share with the user, newest updated first, with their title, owner's name, `updatedAt`, and `bookId`:

- without parameters, those shared with the user's hosted domain (none without one);
- with `?book={bookId}`, those started in that Book, when the user can view it (403 `book_access_required`). People outside the owner's domain find a Book's shared sessions this way.

`GET /v1/shared/stream` sends the first page as `snapshot` events after every change, like the session-list stream. Archived sessions leave these lists, but stay readable while shared.

### Continue a shared session

Create a session with `parent` naming the shared session, as for a [fork](#forks):

| To | `parent` |
| --- | --- |
| Reply at the end | The latest finished reply, `position: "at"` |
| Continue from a reply | That reply, `position: "at"` |
| Edit a message | That user message, `position: "before"`, with the edited text as `input` |

- The new session is the user's own, in their own workspace, and runs with their own access.
- It holds a copy of the history up to that point, titled like the original, and is marked `continuedFrom`, with the original's owner.
- It never takes the original's instructions: send your own `instructions`, as for a new session.
- Files are not copied: the history names them, and the user can upload them again.
- The original is unchanged, and its owner is not notified.
- A session not shared with the user is 404 `parent_not_found`.

## Export a session

`GET /v1/sessions/{sessionId}/export` downloads a session as one JSON file, for support or another agent to read:

- the session, with its model, thinking level and instructions;
- every entry in full, oldest first, including history inherited from a fork or copied from a shared session;
- the session's files, as metadata without their contents;
- each input's Agent and sandbox CLI versions.

`format` and `contractVersion` say which objects it holds. Whoever can read the session can export it, including those it is [shared with](#share-a-session). An export is a record of the session, not a way to resume it elsewhere.

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

type SlackEvent = { event_id: string; thread_ts: string; text: string; user: string };

export async function reply(event: SlackEvent): Promise<string> {
    const input = {
        content: [{ type: 'text', text: event.text }],
        // Who wrote it, as information for the agent: everyone acts as the bot.
        attributes: { sender: event.user },
    };
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

## Connected services

A user can connect other services, such as GitHub or Intercom, once: requests the agent sends to their hosts then carry the user's token, added outside the agent's workspace. The agent never sees the token.

```bash
curl --fail-with-body -X PUT https://agent.bkper.app/v1/services/github \
  -H "Authorization: Bearer ${BKPER_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "GitHub",
    "targets": [{ "host": "api.github.com", "scheme": "bearer" }],
    "secret": "<token>"
  }'
```

- `PUT /v1/services/{serviceId}` connects (201) or replaces (200) the whole service, token included. The ID is yours: lowercase letters, digits and hyphens.
- `GET /v1/services` lists them; `DELETE /v1/services/{serviceId}` disconnects one (204), at once.
- The token is write-only: never returned, logged, or shown to the agent. Choose its permissions in the service: the agent can do whatever the token allows.
- Each host belongs to one service: 409 `host_in_use` names the service that holds it.
- Only calls with the user's own token manage services. Through an app or channel bot these routes are 404.

Google APIs take a service account instead of a token: send its JSON key file as the secret, `google` targets on `*.googleapis.com` hosts, and the scopes to make access tokens for. Access tokens are made and renewed outside the agent's workspace; the response carries the account's `clientEmail`, to share Drive files or an Analytics property with. Change the APIs or scopes by sending the whole service again, key included.

```json
{
  "name": "Google",
  "targets": [{ "host": "analyticsdata.googleapis.com", "scheme": "google" }],
  "google": { "scopes": ["https://www.googleapis.com/auth/analytics.readonly"] },
  "secret": "<the key file's JSON>"
}
```

In the agent's workspace, Google's client libraries find credentials through `GOOGLE_APPLICATION_CREDENTIALS`, a placeholder key that grants nothing, and must use their REST transport (such as `{ fallback: true }`): gRPC does not leave the workspace.

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
| `attributes` | 16 names, 16000 characters in total |
| List page | 50 sessions, entries, or files |
| Connected services | 20 per user, 10 hosts each, tokens and keys up to 8192 characters, 20 Google scopes |

## Errors

Errors are `{ "error": { "code", "type", "message" } }`. Branch on `code`.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request`, `unknown_model`, `unknown_thinking_level` | A field is invalid or unknown |
| 400 | `host_not_allowed` | A connected service names a host that has its own route, such as Bkper's or Google's token endpoint |
| 401 | `unauthorized`, `authentication_failed` | The token is missing, invalid, or expired |
| 403 | `agent_beta_required` | The account cannot use the agent, such as one without an email address |
| 403 | `origin_forbidden` | A browser on another website sent a write |
| 403 | `book_access_required` | The user cannot view the Book whose shared sessions they asked for |
| 404 | `not_found`, `parent_not_found`, `file_not_found` | No such resource for this user |
| 405 | `method_not_allowed` | The path does not support the method |
| 409 | `idempotency_conflict` | The key was used with different content |
| 409 | `invalid_fork_point` | The fork point is not a finished reply or a user message |
| 409 | `input_running` | The input is already running and cannot be withdrawn |
| 409 | `file_quota_exceeded` | The user's upload quota is full |
| 409 | `share_unavailable` | The session cannot be shared: an app's workspace, or outside a Book without a hosted domain |
| 409 | `book_access_required` | The user cannot view the Book the session was started in |
| 409 | `host_in_use`, `service_limit` | Another service holds the host, or the user has 20 services |
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
- [`GET /v1/sessions/{sessionId}/export` — Export a session](https://bkper.com/docs/api/managed-agent/operations/exportsession.md)

### Inputs

- [`POST /v1/sessions/{sessionId}/inputs` — Send an input](https://bkper.com/docs/api/managed-agent/operations/sendinput.md)
- [`GET /v1/sessions/{sessionId}/inputs/{inputId}` — Get an input](https://bkper.com/docs/api/managed-agent/operations/getinput.md)
- [`POST /v1/sessions/{sessionId}/inputs/{inputId}/withdraw` — Withdraw a queued input](https://bkper.com/docs/api/managed-agent/operations/withdrawinput.md)
- [`POST /v1/sessions/{sessionId}/stop` — Stop the current run](https://bkper.com/docs/api/managed-agent/operations/stopsession.md)

### Streams

- [`GET /v1/sessions/stream` — Observe the session list](https://bkper.com/docs/api/managed-agent/operations/observesessions.md)
- [`GET /v1/sessions/{sessionId}/stream` — Observe a session](https://bkper.com/docs/api/managed-agent/operations/observesession.md)

### Shared

- [`GET /v1/shared` — List sessions shared with me](https://bkper.com/docs/api/managed-agent/operations/listshared.md)
- [`GET /v1/shared/stream` — Observe sessions shared with me](https://bkper.com/docs/api/managed-agent/operations/observeshared.md)

### Files

- [`GET /v1/sessions/{sessionId}/files` — List published files](https://bkper.com/docs/api/managed-agent/operations/listfiles.md)
- [`GET /v1/sessions/{sessionId}/files/{fileId}` — Get a session's file](https://bkper.com/docs/api/managed-agent/operations/getsessionfile.md)
- [`GET /v1/sessions/{sessionId}/files/{fileId}/content` — Download a session's file](https://bkper.com/docs/api/managed-agent/operations/downloadsessionfile.md)
- [`POST /v1/files` — Upload a file](https://bkper.com/docs/api/managed-agent/operations/uploadfile.md)
- [`GET /v1/files/{fileId}` — Get file metadata](https://bkper.com/docs/api/managed-agent/operations/getfile.md)
- [`GET /v1/files/{fileId}/content` — Download a file](https://bkper.com/docs/api/managed-agent/operations/downloadfile.md)

### Services

- [`GET /v1/services` — List connected services](https://bkper.com/docs/api/managed-agent/operations/listservices.md)
- [`PUT /v1/services/{serviceId}` — Connect or replace a service](https://bkper.com/docs/api/managed-agent/operations/putservice.md)
- [`DELETE /v1/services/{serviceId}` — Disconnect a service](https://bkper.com/docs/api/managed-agent/operations/deleteservice.md)

### Models

- [`GET /v1/models` — List models](https://bkper.com/docs/api/managed-agent/operations/listmodels.md)

