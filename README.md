# MockFlow

> The Intelligent API Mocking Platform for Modern Development Teams.

Postman Mock Server + Beeceptor + Mockoon + Prism + WireMock — made smarter.

---

## 1. Tech Stack (locked)

| Layer            | Choice                                             | Why |
|------------------|----------------------------------------------------|-----|
| Language         | TypeScript (strict)                                | One language across API, dashboard, SDK, CLI |
| Backend          | **NestJS** (Fastify adapter)                       | Module-per-domain maps 1:1 to phases; DI, guards, queues built in |
| ORM / DB         | **Prisma** + SQLite                                | Type-safe client, declarative migrations, and a single file means no server to run or ship |
| Dashboard        | **Next.js** (App Router) + React + Tailwind        | SSR, shared types with API |
| AI               | **OpenAI API** (ChatGPT / GPT models — capable model for quality, mini model for bulk) | Realistic data generation, example/test synthesis |
| Repo             | **pnpm workspaces + Turborepo**                    | One repo, shared packages, cached builds |
| Auth             | JWT (access + refresh) + API keys                  | Dashboard sessions + programmatic access |
| Testing          | Vitest / Jest + Supertest + Playwright             | Unit, integration, e2e |

---

## 2. Monorepo Layout

```
mockflow/
  apps/
    api/                 # NestJS backend (the platform)
      prisma/            # schema.prisma + migrations
      src/
        auth/            # register, login, refresh, JWT strategy + guard
        users/           # GET /api/me
        workspaces/      # workspaces, projects, roles
        api-keys/        # create/list/revoke keys, x-api-key guard
        projects/        # spec import, endpoints, logs, stats
        parser/          # OpenAPI / Swagger -> internal model
        mock/            # THE mock engine (matching + response generation)
        stateful/        # CRUD store, pagination, sorting, search
        failure/         # error / latency / timeout / network simulator
        ai/              # data, examples, validation and test generation
        webhooks/        # signing, retrying delivery, provider presets
        prisma/          # PrismaModule / PrismaService
        common/          # decorators, hashing, slug helpers
    dashboard/           # Next.js UI
  packages/
    sdk/                 # @mockflow/sdk (TS client)
    cli/                 # mockflow CLI (init/deploy/start/export/logs/chaos)
    shared-types/        # types shared API <-> dashboard <-> sdk <-> cli
  docs/                  # ARCHITECTURE, SYSTEM_DESIGN, DATABASE, API_SPEC,
                         # ROADMAP, FAILURE_SIMULATION
  turbo.json
  pnpm-workspace.yaml
```

> One SQLite file holds everything, so the same build runs as a local web app
> or inside a desktop shell with nothing to install alongside it.

---

## 3. Architecture

```
                      Internet
                          │
                   Load Balancer
                          │
            ┌─────────────┴─────────────┐
            │        API Gateway        │   (NestJS app + rate limiting)
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

**Request flow (a mocked call):**
`incoming request → match route → apply failure rules → stateful store OR generated response → log → respond`

---

## 4. Data Model (Prisma)

Core tables and relationships:

- **Workspace** 1─* **User** (via membership + **Role**)
- **Workspace** 1─* **Project**
- **Project** 1─* **Endpoint** 1─* **Response**
- **Project** 1─* **Collection**, **Environment** 1─* **Variable**
- **Endpoint** 1─* **RequestLog**
- **Project** 1─* **Webhook** 1─* **WebhookDelivery(log)**
- **Workspace** 1─* **ApiKey**, **AiJob**, **Usage**
- **Template** (reusable mock/response presets)

Tables: `users, workspaces, memberships, projects, endpoints, responses, collections, environments, variables, webhooks, webhook_deliveries, request_logs, ai_jobs, api_keys, usage, templates`.

---

## 5. Roadmap (≈5–6 months, part-time)

| Phase | Duration | Goal | Key Deliverables |
|-------|----------|------|------------------|
| **0** | 1 wk  | Research & Design | Monorepo scaffold, all `docs/*.md`, Prisma schema draft |
| **1** | 2 wk  | Core Backend / Auth | Workspaces, projects, users, roles; JWT + refresh + API keys |
| **2** | 2 wk  | Mock Engine | Parser (OpenAPI/Swagger/Postman) → internal model → dynamic routes serving mock responses |
| **3** | 2 wk  | Dashboard | Projects, endpoints, live requests, latency, errors, logs (Vercel-style) |
| **4** | 2 wk  | Stateful APIs | Real CRUD store, pagination, sorting, search |
| **5** | 2 wk  | Failure Simulation | Per-endpoint % rules: 500s, slow responses, timeouts, network/db failures |
| **6** | 2 wk  | AI Generation | OpenAI-powered realistic data, relationships, examples, validation rules, test cases |
| **7** | 2 wk  | Webhooks | Simulate Stripe/GitHub/Slack/Discord/Shopify/Razorpay: send, retry, sign, log |
| **8** | 2 wk  | SDK & CLI | `@mockflow/sdk`; `mockflow init/start/deploy/export` |
| **9** | 2 wk  | Polish & Testing | Benchmarks, tests, UI, docs, README |

### Phase detail highlights

- **Phase 2 pipeline:** `Parser → Validator → Schema Generator → Route Generator → Response Generator → Storage`. Upload a spec, endpoints work automatically.
- **Phase 4:** `POST /user` stores → `GET /users` returns it → `DELETE /user/1` actually removes it. Full CRUD + query semantics.
- **Phase 5:** each endpoint independently configurable, e.g. 10% → 500, 20% → slow, 5% → timeout, 2% → network fail, 1% → db down.
- **Phase 6:** given a "Product" schema, generate realistic categorized inventory (Electronics → Phones → Samsung, with price/stock) instead of random JSON. Also auto-generate examples, validation rules, descriptions, test cases from an uploaded API.
- **Phase 7:** signed, retried outbound webhooks with full delivery logs.

---

## 6. Working Principles

1. **Docs before code** (Phase 0) — companies love documentation.
2. **The mock engine is the heart** — keep it fast and correct before adding intelligence.
3. **Ship each phase runnable** — every phase ends with something you can demo.
4. **Polish is a phase, not an afterthought** — Phase 9 is for hardening, not new features.

---

## 7. Current Status

All ten phases are implemented and verified against a live database.

- [x] **Phase 0** — monorepo scaffold, docs, Prisma schema
- [x] **Phase 1** — auth: register/login/refresh, workspaces, roles, API keys
- [x] **Phase 2** — mock engine: spec import, live mock plane, request logging
- [x] **Phase 3** — dashboard: projects, endpoints, stats, logs, spec import
- [x] **Phase 4** — stateful CRUD with search, sort and pagination
- [x] **Phase 5** — failure simulation: error / slow / timeout / network / db_down
- [x] **Phase 6** — generation: realistic data, examples, validation rules, tests
- [x] **Phase 7** — webhooks: provider-accurate signing, retries, delivery logs
- [x] **Phase 8** — `@mockflow/sdk` and the `mockflow` CLI
- [x] **Phase 9** — 174 tests across the API, SDK and CLI

---

## 8. Quickstart

```bash
pnpm install
cp .env.example .env                        # then edit if you want an OpenAI key
pnpm db:migrate                             # creates the SQLite file
pnpm dev                                    # API :4000, dashboard :3000
```

Open <http://localhost:3000> and register. No database server, no Docker — the
data lives in one SQLite file, and everything reads the single `.env` at the
repo root, so there is nothing to export by hand.

Then, in the dashboard or over the API: register, create a project, import an
OpenAPI document, and the endpoints serve immediately at
`http://localhost:4000/mock/<projectId>/<path>`.

### With the CLI

```bash
export MOCKFLOW_TOKEN=...                   # or MOCKFLOW_API_KEY
mockflow init --project <id> --spec ./openapi.json
mockflow start                              # sync now, and on every save
mockflow chaos /orders error:10 slow:20@2000
mockflow logs --limit 20
mockflow export --out snapshot.json
```

### With the SDK

```ts
import { MockFlowClient } from '@mockflow/sdk';

const client = new MockFlowClient({ baseUrl: 'http://localhost:4000' });
await client.login('you@example.com', 'password');

const project = client.project(projectId);
await project.importSpec(spec);
await project.setFailureRules(endpointId, [{ type: 'error', percent: 10 }]);
await project.generate(endpointId, { count: 20, save: true });
```

---

## 9. What makes it different

- **Self-hosted.** Your specs and traffic stay in a SQLite file you own.
- **Stateful.** `POST /users` then `GET /users` returns what you posted —
  with `q`, `_sort`, `_page` and `_limit` on the list.
- **Chaos by rule.** Per-endpoint percentages of errors, latency, timeouts,
  dropped connections and database outages, reported separately from genuine
  errors so a chaos run can be told apart from a regression.
- **Data that reads like a catalogue.** Generated records are internally
  consistent: the brand matches its category, the email matches the name.
  Works with no API key; a configured model only adds to it.
- **Webhooks you can actually verify.** Deliveries are signed the way Stripe,
  GitHub, Slack, Shopify and Razorpay sign theirs, so the verification code
  you ship is the code that gets exercised.

See [docs/FAILURE_SIMULATION.md](docs/FAILURE_SIMULATION.md) for the failure
rules and [docs/API_SPEC.md](docs/API_SPEC.md) for the full API surface.
