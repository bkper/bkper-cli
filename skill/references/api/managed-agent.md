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

### Agent context

After your `instructions`, the agent reads its context: an `AGENTS.md` and skills (`.agents/skills/<name>/SKILL.md`) that people, the agent, or any other agent following the [AGENTS.md](https://agents.md/) and [Agent Skills](https://agentskills.io/specification) standards keep in a context repository per scope. A session loads the user's company's (their verified domain's, when they have one: shared by everyone in the domain, changed only by its admin), then the user's own, then its Book's (from its first input's `bookContext`, shared by everyone who can view the Book). Each is more specific than the one before and wins: a Book's skills replace the user's of the same name, and the user's the company's. It loads when the session starts and again at the start of each turn (an input that is not a steer or follow-up: a run never changes its context midway), each scope from the sandbox's working copy when the sandbox is running and the user or agent changed it there (local changes win, as on a local machine), else as published: the session's `contextScopes` show what loaded. When it changed, the agent is told so with that input. A fork starts with what its parent loaded.
It loads as the person in every workspace, an App's included (such as a Slack bot's): permissions are the person's. Context of other Books never loads; the agent clones one only when asked.

- Loading never delays a session by more than about two seconds: at the start, a scope that is slow or fails is skipped and shown as `unavailable`, never as an error in the conversation; at a turn, the session keeps all of what it had.
- Context guides; it never grants anything. The user's messages override it, and it cannot relax Bkper's base.

### Workspace

The Workspace is the agent's computer as people see it: the working copies in the sandbox of the workspace you call through (the user's own, or your app's own for that user), the same files the agent sees, which both the user and the agent change. Nothing in them reaches anyone else, or any agent's context, until the user saves: Save publishes. Readers of shared sessions never reach someone else's.

Repositories are named as one tree: `user` (the user's own context), `domain` (their company's, when they have a verified domain) and `books/{bookId}` (a Book's), the folders the sandbox and a local machine keep in `~/.bkper`, and `apps/{appId}` (the source of an App the user develops, in `/workspace/apps`). `GET /v1/workspace?bookId=` lists the root, as published: the user's domain, when they have one, the Book, named by Bkper, when the user can view it, and every App the user develops, those hosted elsewhere with their `repoUrl` instead of a repository. `GET /v1/workspace/status` reads every working copy in one call: its `fingerprint` (Git's tree id of its files, which changes whenever they do), its `base` (the published commit it builds on) and its marks (the files `added`, `modified` and `deleted` since the base, committed or not), plus the App folders in the sandbox, also those Bkper does not know yet. Opening a repository the sandbox does not have clones it there.

- **Read**: a repository's files and marks (`canEdit` says whether the user may change and save it), one file's text and blob id (`version=base` for the base's), one PNG or JPEG picture's bytes (`/image`, at most 5 MiB, typed by its bytes).
- **Change the working copy**: write a file over the version read (`previous`, the `sha` read: what changed since, such as by the agent, is 409 `file_changed`), move (rename) or delete a file or folder, add files from the user's computer (`/add`: 1 to 100 files at their full paths, each base64 of its exact bytes, a PNG or JPEG up to 5 MiB or text up to 256 KiB, at most 10 MiB together), undo a published commit (`/revert`), and discard changes (`/discard`: back to the base; a file never published goes). `POST /v1/workspace/copy` copies or moves a file or folder between two context repositories' working copies, such as into a Book from `GET /v1/workspace/books` (the Books whose context the user may change). A destination that exists is 409 `file_exists` (never overwritten; an add's lists every such file in `paths` at once, replaced only when it says `replace`), what cannot be written (a path, not text, too large) is 422 `file_invalid` with a `reason`; context may hold drafts agents would not load yet (the listing's `warnings` say so, and Save refuses them), and while Git works in the repository (the agent's, or a sync) 409 `workspace_busy`: nothing changed, try again.
- **Review and save**: `/changes` shows everything Save would publish, each file before and after, with the working copy's `fingerprint`; `POST …/save` with that `fingerprint` publishes exactly what was reviewed: the agent's commits as they are (their messages and trailers in History), plus one commit of the rest, authored and committed by the user with an automatic message, never forced and never deployed. Changed since the review is 409 `review_stale`; someone published changes to the same lines meanwhile is 409 `publish_conflict`, naming the files (`paths`) and who published them (`publishers`), with nothing published and the working copy as before; an App Bkper does not know yet is 409 `app_unregistered` until the agent registers it.
- **App secrets**: the secrets of an App's deployments on Bkper, production and preview, as `bkper app secrets` sets them, without the value ever reaching the agent or a conversation. `GET /v1/workspace/apps/{appId}/secrets` lists each deployment's names, or that the App is not deployed there yet; `PUT …/secrets/{name}?env=` with `{ "value" }` sets one (a name set again is replaced) and `DELETE` removes one, for the App's owner and developers (403 `workspace_forbidden`), only where it is deployed (409 `not_deployed`). Values are write-only. Only with the user's own token: through an app or channel bot these routes are 404.
- **History**, as published: the latest 20 commits with the files each changed and whether each was made with the agent's help (`agent`: its message ends with the trailer `Assisted-by: Bkper Agent`; the user stays its author and committer), and what one of them changed (`/commit`, each file before and after).

When the user changes the working copy, the agent is told which files with its next message. Context changed there applies to the user's sessions from their next turn while the sandbox runs; Save publishes it to everyone in its scope.

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

In the user's own workspace, when the agent shows an App it is building running live (`show_app`), the `tool_result` entry carries a `live_app` part with the App's `appId`, `name`, and `menuUrl`, when it has one.

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

### Domain services

A domain's admin can connect a service for everyone in the domain, with the same requests under `/v1/domain/services`. The agent of every member then uses it, unless the member connected their own service for the same host, which comes first. A domain's token works for everyone in the domain and any app they authorize: choose its permissions as narrowly as you can.

- `GET /v1/domain/services` lists the caller's domain's services, for any member; without a domain, the list is empty.
- `PUT` and `DELETE /v1/domain/services/{serviceId}` are only for the domain's admin (403 `domain_admin_required`). The services belong to the domain, not the admin who connected them.
- Each host belongs to one service within the domain; a member's own services are apart. Through an app or channel bot these routes are 404.

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
| Connected services | 20 per user and 20 per domain, 10 hosts each, tokens and keys up to 8192 characters, 20 Google scopes |
| App secret value | 5 KiB |

## Errors

Errors are `{ "error": { "code", "type", "message" } }`. Branch on `code`.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request`, `unknown_model`, `unknown_thinking_level` | A field is invalid or unknown |
| 400 | `host_not_allowed` | A connected service names a host that has its own route, such as Bkper's or Google's token endpoint |
| 401 | `unauthorized`, `authentication_failed` | The token is missing, invalid, or expired |
| 403 | `origin_forbidden` | A browser on another website sent a write |
| 403 | `book_access_required` | The user cannot view the Book whose shared sessions they asked for |
| 403 | `domain_admin_required` | Only the domain's admin changes its services |
| 403 | `workspace_forbidden` | The user may not change or save this Workspace repository, or change this App's secrets |
| 404 | `not_found`, `parent_not_found`, `file_not_found` | No such resource for this user |
| 405 | `method_not_allowed` | The path does not support the method |
| 409 | `idempotency_conflict` | The key was used with different content |
| 409 | `invalid_fork_point` | The fork point is not a finished reply or a user message |
| 409 | `input_running` | The input is already running and cannot be withdrawn |
| 409 | `file_quota_exceeded` | The user's upload quota is full |
| 409 | `share_unavailable` | The session cannot be shared: an app's workspace, or outside a Book without a hosted domain |
| 409 | `book_access_required` | The user cannot view the Book the session was started in |
| 409 | `host_in_use`, `service_limit` | Another service holds the host, or the user (or domain) has 20 services |
| 409 | `file_changed`, `file_exists` | A Workspace file changed since it was read, or a destination exists |
| 409 | `workspace_busy` | Git is working in the Workspace repository; nothing changed, try again |
| 409 | `not_deployed` | The App is not deployed to that environment: nothing to set there yet |
| 409 | `review_stale`, `publish_conflict`, `app_unregistered` | Save: the files changed since the review, someone published changes to the same lines, or the App is not known to Bkper yet |
| 410 | `file_gone` | The file's stored copy was deleted |
| 411 | `length_required` | An upload has no `Content-Length` |
| 413 | `request_too_large`, `file_too_large` | The JSON body exceeds 64 KiB, or the upload 25 MiB |
| 422 | `file_invalid` | A Workspace change cannot be written or saved; `reason` says why |
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
- [`GET /v1/domain/services` — List domain services](https://bkper.com/docs/api/managed-agent/operations/listdomainservices.md)
- [`PUT /v1/domain/services/{serviceId}` — Connect or replace a domain service](https://bkper.com/docs/api/managed-agent/operations/putdomainservice.md)
- [`DELETE /v1/domain/services/{serviceId}` — Disconnect a domain service](https://bkper.com/docs/api/managed-agent/operations/deletedomainservice.md)

### Workspace

- [`GET /v1/workspace` — Get the Workspace](https://bkper.com/docs/api/managed-agent/operations/getworkspace.md)
- [`GET /v1/workspace/status` — Get the working copies' status](https://bkper.com/docs/api/managed-agent/operations/getworkspacestatus.md)
- [`GET /v1/workspace/books` — List Books to copy to](https://bkper.com/docs/api/managed-agent/operations/listworkspacebooks.md)
- [`POST /v1/workspace/copy` — Copy or move to another repository](https://bkper.com/docs/api/managed-agent/operations/copyworkspaceentry.md)
- [`GET /v1/workspace/user` — Get a repository](https://bkper.com/docs/api/managed-agent/operations/getusercontext.md)
- [`GET /v1/workspace/user/file` — Read a file](https://bkper.com/docs/api/managed-agent/operations/getusercontextfile.md)
- [`PUT /v1/workspace/user/file` — Write a file](https://bkper.com/docs/api/managed-agent/operations/putusercontextfile.md)
- [`GET /v1/workspace/user/image` — Read a picture](https://bkper.com/docs/api/managed-agent/operations/getusercontextimage.md)
- [`GET /v1/workspace/user/history` — List history](https://bkper.com/docs/api/managed-agent/operations/listusercontexthistory.md)
- [`GET /v1/workspace/user/commit` — Get a commit's changes](https://bkper.com/docs/api/managed-agent/operations/getusercontextcommit.md)
- [`POST /v1/workspace/user/revert` — Undo a commit](https://bkper.com/docs/api/managed-agent/operations/revertusercontext.md)
- [`POST /v1/workspace/user/move` — Move or rename a file or folder](https://bkper.com/docs/api/managed-agent/operations/moveusercontextentry.md)
- [`POST /v1/workspace/user/delete` — Delete a file or folder](https://bkper.com/docs/api/managed-agent/operations/deleteusercontextentry.md)
- [`POST /v1/workspace/user/add` — Add files](https://bkper.com/docs/api/managed-agent/operations/addusercontextfiles.md)
- [`POST /v1/workspace/user/discard` — Discard changes](https://bkper.com/docs/api/managed-agent/operations/discardusercontext.md)
- [`GET /v1/workspace/user/changes` — Review the changes](https://bkper.com/docs/api/managed-agent/operations/getusercontextchanges.md)
- [`POST /v1/workspace/user/save` — Save](https://bkper.com/docs/api/managed-agent/operations/saveusercontext.md)
- [`GET /v1/workspace/domain` — Get a repository](https://bkper.com/docs/api/managed-agent/operations/getdomaincontext.md)
- [`GET /v1/workspace/domain/file` — Read a file](https://bkper.com/docs/api/managed-agent/operations/getdomaincontextfile.md)
- [`PUT /v1/workspace/domain/file` — Write a file](https://bkper.com/docs/api/managed-agent/operations/putdomaincontextfile.md)
- [`GET /v1/workspace/domain/image` — Read a picture](https://bkper.com/docs/api/managed-agent/operations/getdomaincontextimage.md)
- [`GET /v1/workspace/domain/history` — List history](https://bkper.com/docs/api/managed-agent/operations/listdomaincontexthistory.md)
- [`GET /v1/workspace/domain/commit` — Get a commit's changes](https://bkper.com/docs/api/managed-agent/operations/getdomaincontextcommit.md)
- [`POST /v1/workspace/domain/revert` — Undo a commit](https://bkper.com/docs/api/managed-agent/operations/revertdomaincontext.md)
- [`POST /v1/workspace/domain/move` — Move or rename a file or folder](https://bkper.com/docs/api/managed-agent/operations/movedomaincontextentry.md)
- [`POST /v1/workspace/domain/delete` — Delete a file or folder](https://bkper.com/docs/api/managed-agent/operations/deletedomaincontextentry.md)
- [`POST /v1/workspace/domain/add` — Add files](https://bkper.com/docs/api/managed-agent/operations/adddomaincontextfiles.md)
- [`POST /v1/workspace/domain/discard` — Discard changes](https://bkper.com/docs/api/managed-agent/operations/discarddomaincontext.md)
- [`GET /v1/workspace/domain/changes` — Review the changes](https://bkper.com/docs/api/managed-agent/operations/getdomaincontextchanges.md)
- [`POST /v1/workspace/domain/save` — Save](https://bkper.com/docs/api/managed-agent/operations/savedomaincontext.md)
- [`GET /v1/workspace/books/{bookId}` — Get a repository](https://bkper.com/docs/api/managed-agent/operations/getbookcontext.md)
- [`GET /v1/workspace/books/{bookId}/file` — Read a file](https://bkper.com/docs/api/managed-agent/operations/getbookcontextfile.md)
- [`PUT /v1/workspace/books/{bookId}/file` — Write a file](https://bkper.com/docs/api/managed-agent/operations/putbookcontextfile.md)
- [`GET /v1/workspace/books/{bookId}/image` — Read a picture](https://bkper.com/docs/api/managed-agent/operations/getbookcontextimage.md)
- [`GET /v1/workspace/books/{bookId}/history` — List history](https://bkper.com/docs/api/managed-agent/operations/listbookcontexthistory.md)
- [`GET /v1/workspace/books/{bookId}/commit` — Get a commit's changes](https://bkper.com/docs/api/managed-agent/operations/getbookcontextcommit.md)
- [`POST /v1/workspace/books/{bookId}/revert` — Undo a commit](https://bkper.com/docs/api/managed-agent/operations/revertbookcontext.md)
- [`POST /v1/workspace/books/{bookId}/move` — Move or rename a file or folder](https://bkper.com/docs/api/managed-agent/operations/movebookcontextentry.md)
- [`POST /v1/workspace/books/{bookId}/delete` — Delete a file or folder](https://bkper.com/docs/api/managed-agent/operations/deletebookcontextentry.md)
- [`POST /v1/workspace/books/{bookId}/add` — Add files](https://bkper.com/docs/api/managed-agent/operations/addbookcontextfiles.md)
- [`POST /v1/workspace/books/{bookId}/discard` — Discard changes](https://bkper.com/docs/api/managed-agent/operations/discardbookcontext.md)
- [`GET /v1/workspace/books/{bookId}/changes` — Review the changes](https://bkper.com/docs/api/managed-agent/operations/getbookcontextchanges.md)
- [`POST /v1/workspace/books/{bookId}/save` — Save](https://bkper.com/docs/api/managed-agent/operations/savebookcontext.md)
- [`GET /v1/workspace/apps/{appId}` — Get a repository](https://bkper.com/docs/api/managed-agent/operations/getappsource.md)
- [`GET /v1/workspace/apps/{appId}/file` — Read a file](https://bkper.com/docs/api/managed-agent/operations/getappsourcefile.md)
- [`PUT /v1/workspace/apps/{appId}/file` — Write a file](https://bkper.com/docs/api/managed-agent/operations/putappsourcefile.md)
- [`GET /v1/workspace/apps/{appId}/image` — Read a picture](https://bkper.com/docs/api/managed-agent/operations/getappsourceimage.md)
- [`GET /v1/workspace/apps/{appId}/history` — List history](https://bkper.com/docs/api/managed-agent/operations/listappsourcehistory.md)
- [`GET /v1/workspace/apps/{appId}/commit` — Get a commit's changes](https://bkper.com/docs/api/managed-agent/operations/getappsourcecommit.md)
- [`POST /v1/workspace/apps/{appId}/revert` — Undo a commit](https://bkper.com/docs/api/managed-agent/operations/revertappsource.md)
- [`POST /v1/workspace/apps/{appId}/move` — Move or rename a file or folder](https://bkper.com/docs/api/managed-agent/operations/moveappsourceentry.md)
- [`POST /v1/workspace/apps/{appId}/delete` — Delete a file or folder](https://bkper.com/docs/api/managed-agent/operations/deleteappsourceentry.md)
- [`POST /v1/workspace/apps/{appId}/add` — Add files](https://bkper.com/docs/api/managed-agent/operations/addappsourcefiles.md)
- [`POST /v1/workspace/apps/{appId}/discard` — Discard changes](https://bkper.com/docs/api/managed-agent/operations/discardappsource.md)
- [`GET /v1/workspace/apps/{appId}/changes` — Review the changes](https://bkper.com/docs/api/managed-agent/operations/getappsourcechanges.md)
- [`POST /v1/workspace/apps/{appId}/save` — Save](https://bkper.com/docs/api/managed-agent/operations/saveappsource.md)
- [`GET /v1/workspace/apps/{appId}/secrets` — List an App's secrets](https://bkper.com/docs/api/managed-agent/operations/listappsecrets.md)
- [`PUT /v1/workspace/apps/{appId}/secrets/{name}` — Set an App's secret](https://bkper.com/docs/api/managed-agent/operations/putappsecret.md)
- [`DELETE /v1/workspace/apps/{appId}/secrets/{name}` — Delete an App's secret](https://bkper.com/docs/api/managed-agent/operations/deleteappsecret.md)

### Models

- [`GET /v1/models` — List models](https://bkper.com/docs/api/managed-agent/operations/listmodels.md)

