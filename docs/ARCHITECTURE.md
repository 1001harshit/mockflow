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
  PostgreSQL ◄────────── Redis (cache + state) ──► BullMQ Queues
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
| `cache`    | Redis wrappers                                             | 4+ |
| `workers`  | BullMQ processors (webhooks, AI jobs)                       | 6+ |
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

- **PostgreSQL** — source of truth (projects, endpoints, users, logs...).
- **Redis** — cache, rate limits, and the stateful CRUD store's hot data.
- **BullMQ** (on Redis) — async queues for webhook delivery and AI jobs.

See `SYSTEM_DESIGN.md` for deeper design decisions and `DATABASE.md` for the schema.
