# Architecture

MockFlow is a monorepo with a NestJS API at its center, a Next.js dashboard,
and shared SDK/CLI packages.

```
                      Internet
                          │
                   Load Balancer
                          │
            ┌─────────────┴─────────────┐
            │        API Gateway        │   NestJS (Fastify adapter) + rate limiting
            └─────────────┬─────────────┘
                          │
      ┌───────────┬───────┼────────┬────────────┐
      │           │       │        │            │
    Auth      Mock Engine │      AI Svc     Webhook API
      │           │       │        │            │
      │       Stateful  Failure    │            │
      │        Store    Sim        │            │
      ▼           ▼       ▼         ▼            ▼
                      SQLite (one file)
                                                       │
                                              Webhook / AI Workers
```

## Modules (NestJS, `apps/api/src/`)

| Module     | Responsibility                                             | Phase |
|------------|------------------------------------------------------------|-------|
| `auth`     | Workspaces, users, roles, JWT, refresh tokens, API keys    | 1 |
| `api`      | Public REST surface consumed by the dashboard              | 1+ |
| `parser`   | OpenAPI / Swagger / Postman → internal model               | 2 |
| `mock`     | Route + response generation; serves mocked APIs            | 2 |
| `stateful` | CRUD store, pagination, sorting, search                    | 4 |
| `failure`  | Error / latency / timeout / network / db-down simulation   | 5 |
| `ai`       | OpenAI-backed data/example/test generation                 | 6 |
| `webhook`  | Outbound webhook simulation (sign, retry, log)             | 7 |
| `storage`  | Persistence services (Prisma wrappers)                     | 1+ |
| `common`   | Guards, interceptors, filters, decorators                  | 1+ |

## Request flow (a mocked call)

```
incoming request
  → route match (mock module)
  → apply failure rules (failure module)
  → stateful store lookup OR generated response
  → write RequestLog
  → respond
```

## Data stores

- **SQLite** — source of truth (projects, endpoints, users, logs...), in one
  file, so there is no database server to run locally or ship in the app.
- Webhook delivery and generation run inline; a queue is the right answer
  only once fan-out justifies one.

See `SYSTEM_DESIGN.md` for deeper design decisions and `DATABASE.md` for the schema.
