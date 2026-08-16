# Self-Hosted Alternative

The [Bkper Platform](https://bkper.com/docs/build/apps/overview.md) handles hosting, authentication, and deployment for you. However, you can host event handlers on your own infrastructure if you have specific requirements — existing cloud setup, compliance constraints, or legacy apps.

> **Tip**
> Use the Bkper Platform unless you have a specific reason to self-host. It eliminates the need to manage authentication, secrets, hosting, and deployment yourself.
## Cloud Functions

A Bkper event handler running on [Google Cloud Functions](https://cloud.google.com/functions/) receives authenticated calls from the `bkper-hrd@appspot.gserviceaccount.com` service account. You need to grant this service account the [Cloud Functions Invoker IAM role](https://cloud.google.com/functions/docs/securing/managing-access-iam) (`roles/cloudfunctions.invoker`).

Set the production endpoint in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md):

```yaml
webhookUrl: https://us-central1-my-project.cloudfunctions.net/events
```

### Authentication

An OAuth Access Token **of the user who installed the app** is sent to the production `webhookUrl` endpoint in the `bkper-oauth-token` HTTP header, along with the agent identifier in `bkper-agent-id`, on each event. Your handler uses this token to call the API back on behalf of the user.

Both production (`webhookUrl`) and development (`webhookUrlDev`) endpoints receive OAuth tokens in the `bkper-oauth-token` header.

### Throughput and scaling

Event throughput can be high, especially when processing large batches. Set the [max instance limit](https://cloud.google.com/functions/docs/max-instances#setting_max_instances_limits) — usually **1-2 is enough**. When the function returns `429 Too Many Requests`, the event is automatically retried with incremental backoff until it receives an HTTP `200`.

### Response format

The function response must follow the standard format:

```ts
{ result?: any, error?: any }
```

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md#response-format) for details on response handling.

### Considerations

- Execution environment is subject to [Cloud Function Quotas](https://cloud.google.com/functions/quotas) — quota counts against the developer account, not the end user
- Recommended for scenarios where event throughput exceeds **1 event/second/user** and processing can be handled asynchronously
- Can be combined with context menus built with [Apps Script HTML Service](https://developers.google.com/apps-script/guides/html) or any other UI infrastructure

---

## Generic Webhooks

You can host event handlers on any infrastructure — other cloud providers, containers, on-premise servers.

Configure the same `webhookUrl` property in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md):

```yaml
webhookUrl: https://my-server.example.com/bkper/events
```

### Authentication

Calls to the production webhook URL are signed with a JWT token using the [Service to Function](https://cloud.google.com/functions/docs/securing/authenticating#service-to-function) method. You can verify this token to assert the identity of the Bkper service.

> **Note**
> Cloud Functions handles JWT verification automatically. For other infrastructure, you need to implement verification yourself. We strongly recommend Cloud Functions for this reason.
### Retry behavior

If your infrastructure returns an HTTP `429` status, the event is automatically retried with incremental backoff until it receives an HTTP `200`. Use this to handle temporary overload gracefully.
