# API Spec (draft)

Two surfaces:

1. **Control plane** — `/api/*`, authenticated (JWT or API key). Manages
   workspaces, projects, endpoints, etc.
2. **Mock plane** — user-defined routes served by the mock engine (Phase 2).

Base URL (dev): `http://localhost:4000`

## Health

| Method | Path      | Auth | Description        |
|--------|-----------|------|--------------------|
| GET    | `/health` | none | Liveness check     |

## Auth (Phase 1)

| Method | Path                  | Description                     |
|--------|-----------------------|---------------------------------|
| POST   | `/api/auth/register`  | Create user + first workspace   |
| POST   | `/api/auth/login`     | Returns access + refresh tokens |
| POST   | `/api/auth/refresh`   | Rotate access token             |
| GET    | `/api/me`             | Current user + memberships      |

## Workspaces / Projects (Phase 1–2)

| Method | Path                              | Description          |
|--------|-----------------------------------|----------------------|
| GET    | `/api/workspaces`                 | List my workspaces   |
| POST   | `/api/workspaces`                 | Create workspace     |
| GET    | `/api/workspaces/:id/projects`    | List projects        |
| POST   | `/api/workspaces/:id/projects`    | Create project       |

## Projects and endpoints (Phase 2–5)

| Method | Path                                          | Description                     |
|--------|-----------------------------------------------|---------------------------------|
| POST   | `/api/projects/:id/import`                    | Upload an OpenAPI/Swagger doc   |
| GET    | `/api/projects/:id/endpoints`                 | List endpoints + failure rules  |
| PATCH  | `/api/projects/:id/endpoints/:endpointId`     | Edit response, stateful, chaos  |
| GET    | `/api/projects/:id/logs?limit=`               | Recent mock requests            |
| GET    | `/api/projects/:id/stats`                     | Latency, errors, injected chaos |

`PATCH` accepts `statusCode`, `body`, `description`, `stateful` and
`failureRules`. Rules are validated per-rule and as a set — enabled rules may
not total more than 100%. Send `"failureRules": []` to clear them. See
[FAILURE_SIMULATION.md](FAILURE_SIMULATION.md).

## Generation (Phase 6)

| Method | Path                                                       | Description                        |
|--------|------------------------------------------------------------|------------------------------------|
| GET    | `/api/projects/:id/ai/status`                              | Whether a model is configured      |
| GET    | `/api/projects/:id/ai/jobs?limit=`                         | Generation job history             |
| POST   | `/api/projects/:id/ai/endpoints/:endpointId/generate`      | Realistic response data            |
| POST   | `/api/projects/:id/ai/endpoints/:endpointId/suggest`       | Examples, validation, test cases   |

Both generation routes work without an API key by deriving from the schema;
a configured model is preferred and falls back to local generation on failure.
`generate` takes `count`, `hint`, `seed`, `local` and `save`.

## Webhooks (Phase 7)

| Method | Path                                                     | Description                      |
|--------|----------------------------------------------------------|----------------------------------|
| POST   | `/api/projects/:id/webhooks`                             | Register a target (secret shown once) |
| GET    | `/api/projects/:id/webhooks`                             | List targets                     |
| DELETE | `/api/projects/:id/webhooks/:webhookId`                  | Remove a target                  |
| POST   | `/api/projects/:id/webhooks/:webhookId/send`             | Fire a signed, retried delivery  |
| GET    | `/api/projects/:id/webhooks/:webhookId/deliveries`       | Per-attempt delivery history     |
| GET    | `/api/projects/:id/webhooks/providers`                   | Providers and their events       |
| GET    | `/api/projects/:id/webhooks/providers/:provider/sample`  | Preview a provider's payload     |

Providers: `stripe`, `github`, `slack`, `shopify`, `razorpay`, `discord`,
`custom`. Each is signed in that provider's real format.

## API keys (Phase 1)

| Method | Path                                   | Description        |
|--------|----------------------------------------|--------------------|
| POST   | `/api/workspaces/:id/keys`             | Create API key     |
| GET    | `/api/workspaces/:id/keys`             | List API keys      |
| DELETE | `/api/workspaces/:id/keys/:keyId`      | Revoke API key     |
| GET    | `/api/key-info`                        | Identify an `x-api-key` |

## Mock plane

`ALL /mock/:projectId/*` — no auth. Matches method and path (including
`{param}` segments) against the project's endpoints, applies failure rules,
and serves from the stateful store or the endpoint's example/schema. An
answered response altered by a failure rule carries `x-mockflow-failure`.
