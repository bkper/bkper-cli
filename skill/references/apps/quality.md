# App Quality Guidelines

Use these guidelines when building, changing, or reviewing a Bkper app. They complement the detailed architecture, security, and feature documentation.

After implementation, review the changed code against these guidelines before considering the work complete. Automated checks support this review but do not replace it.

## Bkper behavior

Always:

- Model financial activity as balanced resource movements between Accounts.
- Keep calculations deterministic and cover financial behavior with focused unit tests.
- Use canonical Bkper SDK and API types instead of recreating Bkper data structures.
- Add meaning with properties before introducing new structural complexity.

## User interface

Always:

- Prefer Web Awesome for all UI controls. Do not use native controls when Web Awesome provides an equivalent.
- If no equivalent exists, first compose existing Web Awesome components. Create a reusable Lit web component only when necessary, keeping any native controls encapsulated within it.
- Style with Bkper design tokens instead of ad-hoc design constants.
- Support the active Bkper light or dark theme.
- Keep interactions accessible and provide clear loading, empty, and error states.

Apps opened from a Book context menu should feel like part of the Book. Keep their layout focused, make them work in the configured sidebar or expanded width, and preserve context when the Book URL changes.

## Startup

Always render the app shell or a meaningful loading state before waiting for authentication, API calls, or other initialization. Start asynchronous work after the first render and update the interface as results arrive.

Prefer loading only the client code and Web Awesome components needed for the initial experience.

## API contracts

When an app exposes its own HTTP API:

- Define and publish its OpenAPI contract at `/openapi.json`.
- Generate client types from that contract.
- Call the API through the generated typed boundary rather than duplicating request or response types.
- Validate untrusted request data at the server boundary.
- Keep published routes backward compatible or introduce a new API version for breaking changes.

UI-only and event-only apps without an app-owned HTTP API do not need to add one. Direct calls to Bkper should use the canonical Bkper SDK and API types.

## Focused modules

Prefer modules with one clear responsibility, high cohesion, and few dependencies.

- Components render state and communicate user intent. They should delegate API and Bkper operations to client API or service modules.
- HTTP routes and event handlers adapt transport concerns and delegate app behavior.
- Business modules contain domain decisions without depending on UI, HTTP, storage, or external-service details.
- Connectors isolate external APIs and storage concerns from business behavior.
- Add a repository or another layer when connection or storage complexity justifies it, not by default.
- Avoid layers that only forward calls without creating a useful boundary.

Split a module when unrelated behavior changes for different reasons or when mixed responsibilities make it difficult to understand or test.

## Security

Keep the security boundary simple and explicit:

- Authorize sensitive app operations on the server.
- Validate untrusted requests, events, and browser messages at their boundaries.
- Keep application secrets and privileged credentials out of client bundles.
- Access only the Book data needed for the operation.
- Make event handling safe to retry and prevent event loops.

See [App Security](https://bkper.com/docs/platform/apps/security.md) and [Event Handlers](https://bkper.com/docs/platform/apps/event-handlers.md) for implementation details.

## Verification

After implementation:

1. Review the changed code against these guidelines.
2. Run the app's deterministic checks, including unit tests, typechecking, and production builds.
3. Confirm generated API types and contract snapshots are current when the API changed.
4. Verify user interfaces in their intended Book context, including first rendering, loading, errors, theme, and configured width.

App reviews should report concrete findings with file locations and suggested fixes. If no issues are found, a short confirmation is enough.

## Next Steps

- [App Architecture](https://bkper.com/docs/platform/apps/architecture.md) — Client, server, API, and event structure.
- [App Security](https://bkper.com/docs/platform/apps/security.md) — Authentication and authorization boundaries.
- [Context Menu](https://bkper.com/docs/platform/apps/context-menu.md) — Embedded Book context and open modes.
- [Development Experience](https://bkper.com/docs/platform/apps/development.md) — Local development and deterministic checks.
