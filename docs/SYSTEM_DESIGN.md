# System Design

## Goals

1. Upload an API spec (OpenAPI/Swagger/Postman) → working mock endpoints instantly.
2. Endpoints can be **stateful** (real CRUD) — most mock servers fail here.
3. Per-endpoint **failure simulation** (errors, latency, timeouts).
4. **AI-generated** realistic data instead of random JSON.
5. **Webhook** simulation for third-party providers.
6. First-class **SDK + CLI** DX.

## Key decisions

- **NestJS + Fastify adapter** — module-per-domain matches the phase breakdown;
  Fastify keeps the hot mock-serving path fast.
- **Prisma + PostgreSQL** — type-safe schema, easy migrations.
- **Redis** does triple duty: cache, rate limiting, and the stateful store.
- **BullMQ** for anything slow/retryable (webhook delivery, AI jobs) so the
  request path stays synchronous and fast.
- **Monorepo (pnpm + Turborepo)** — API, dashboard, SDK, CLI share types via
  `@mockflow/shared-types`.

## The mock engine (Phase 2, the heart)

Pipeline:

```
Parser → Validator → Schema Generator → Route Generator → Response Generator → Storage
```

- **Parser** normalizes OpenAPI/Swagger/Postman into one internal model.
- **Route Generator** registers dynamic Fastify routes per endpoint.
- **Response Generator** produces a response from: an explicit example, a
  schema-derived fake, the stateful store, or an AI-generated payload.

## Stateful APIs (Phase 4)

`POST /user` stores → `GET /users` lists it → `GET /users/:id` fetches →
`DELETE /users/:id` removes it. Backed by Redis (hot) with Postgres fallback.
Supports pagination, sorting, filtering/search.

## Failure simulation (Phase 5)

Each endpoint carries independent rules, e.g.:

| Probability | Behavior         |
|-------------|------------------|
| 10%         | 500 error        |
| 20%         | Slow response    |
| 5%          | Timeout          |
| 2%          | Network failure  |
| 1%          | Database down    |

Evaluated per request before the response is produced.

## AI generation (Phase 6)

OpenAI turns a schema into *coherent* data (categories, relationships,
realistic prices/stock) — not random noise. Also generates examples,
validation rules, descriptions, and test cases from an uploaded API. Runs as
async BullMQ jobs (`AiJob`).

## Non-goals (for now)

- Multi-region replication.
- Full billing/metering (usage is tracked but not billed).
