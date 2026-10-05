# HTTP API

Every T3 Code server exposes an HTTP API so external tools and agents can
drive it without a WebSocket client: list projects and threads, launch a
thread, send follow-up messages, interrupt a run, and read progress.

## Discover the API

The server describes itself at two unauthenticated endpoints:

| Endpoint                      | What it returns                                                        |
| ----------------------------- | ---------------------------------------------------------------------- |
| `/.well-known/t3/environment` | Environment id, label, server version, and capabilities                |
| `/api/openapi.json`           | The full OpenAPI document, generated from the server's typed contracts |

A browsable reference of the same document is served at `/api/docs`. The
document always matches the running server version, so clients can regenerate
bindings after an update by fetching it again.

## Get a token

On the machine that hosts the server, issue a scoped bearer token:

```sh
t3 auth session issue --ttl 30d --label "my integration" --token-only
```

Send it as `Authorization: Bearer <token>` on every request. `t3 auth session
list` shows active sessions and `t3 auth session revoke <id>` invalidates one.

Remote clients pair instead: create a pairing credential in Settings →
Connections (or `t3 auth pairing create`), then exchange it at
`POST /oauth/token`. See [Remote access](./remote-access.md).

Reads need the `orchestration:read` scope; thread and project writes need
`orchestration:operate`. Tokens from `t3 auth session issue` carry both.

## Drive a thread

The thread lifecycle is four endpoints:

1. `POST /api/orchestration/threads/launch` creates a thread (optionally with
   a first message) in a project and starts the agent.
2. `GET /api/orchestration/threads/{threadId}` reads the thread in detail;
   `GET /api/orchestration/shell` lists every project and thread in one
   snapshot.
3. `POST /api/orchestration/threads/{threadId}/send` sends a follow-up. The
   default mode starts or steers depending on thread state; `queue` holds the
   message for the next turn.
4. `POST /api/orchestration/threads/{threadId}/interrupt` stops the active
   run.

Writes carry a client-generated `commandId` (and messages a `messageId`).
Retrying a request with the same ids is safe: the server treats it as the
same command, so network retries never double-send.

Request and response shapes, including launch options such as worktree
strategy and model selection, are in the OpenAPI document. Live streaming is
not part of the HTTP API; poll the snapshot endpoints, or use the WebSocket
protocol that the web and mobile clients use.
