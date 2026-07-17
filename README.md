# MockFlow

> The Intelligent API Mocking Platform for Modern Development Teams.

Postman Mock Server + Beeceptor + Mockoon + Prism + WireMock — made smarter.

---

## 1. Tech Stack (locked)

| Layer            | Choice                                             | Why |
|------------------|----------------------------------------------------|-----|
| Language         | TypeScript (strict)                                | One language across API, dashboard, SDK, CLI |
| Backend          | **NestJS** (Fastify adapter)                       | Module-per-domain maps 1:1 to phases; DI, guards, queues built in |
| ORM / DB         | **Prisma** + PostgreSQL                            | Type-safe client, declarative migrations |
| Cache / Queue    | Redis + **BullMQ**                                 | Rate limits, stateful store, webhook + AI job queues |
| Dashboard        | **Next.js** (App Router) + React + Tailwind        | SSR, shared types with API |
| AI               | **OpenAI API** (ChatGPT / GPT models — capable model for quality, mini model for bulk) | Realistic data generation, example/test synthesis |
| Repo             | **pnpm workspaces + Turborepo**                    | One repo, shared packages, cached builds |
| Auth             | JWT (access + refresh) + API keys                  | Dashboard sessions + programmatic access |
| Infra (dev)      | Docker Compose (Postgres, Redis)                   | One-command local stack |
| Testing          | Vitest / Jest + Supertest + Playwright             | Unit, integration, e2e |

---

## 2. Monorepo Layout

```
mockflow/
  apps/
    api/                 # NestJS backend (the platform)
      src/
        auth/            # workspaces, users, roles, JWT, API keys
        api/             # public REST for dashboard
        mock/            # THE mock engine (route + response generation)
        parser/          # OpenAPI / Swagger / Postman -> internal model
        stateful/        # CRUD store, pagination, sorting, search
        failure/         # error / latency / timeout simulator
        ai/              # OpenAI-backed generation
        webhook/         # outbound webhook simulator (Stripe, GitHub...)
        storage/         # persistence services
        cache/           # Redis wrappers
        workers/         # BullMQ processors (webhooks, AI jobs)
        common/          # guards, interceptors, filters, decorators
        utils/
    dashboard/           # Next.js UI (Vercel-style)
  packages/
    sdk/                 # @mockflow/sdk (TS client)
    cli/                 # mockflow CLI (init/start/deploy/export)
    shared-types/        # types shared API <-> dashboard <-> sdk
    config/              # shared tsconfig / eslint
  docs/                  # ARCHITECTURE, SYSTEM_DESIGN, DATABASE, API_SPEC, ROADMAP
  docker-compose.yml     # postgres + redis for local dev
  turbo.json
  pnpm-workspace.yaml
```

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
  PostgreSQL ◄────────── Redis (cache + state) ──► BullMQ Queues
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
| **0** | 1 wk  | Research & Design | Monorepo scaffold, Docker stack, all `docs/*.md`, Prisma schema draft |
| **1** | 2 wk  | Core Backend / Auth | Workspaces, projects, users, roles; JWT + refresh + API keys |
| **2** | 2 wk  | Mock Engine | Parser (OpenAPI/Swagger/Postman) → internal model → dynamic routes serving mock responses |
| **3** | 2 wk  | Dashboard | Projects, endpoints, live requests, latency, errors, logs (Vercel-style) |
| **4** | 2 wk  | Stateful APIs | Real CRUD store, pagination, sorting, search backed by Redis/Postgres |
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

- [x] Repo initialized, stack decided
- [ ] Phase 0 — scaffold + docs  ← **next**
- [ ] Phase 1 — auth
- [ ] Phase 2 — mock engine
- [ ] ...
