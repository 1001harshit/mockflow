# Roadmap

≈5–6 months part-time, 10 phases. Every phase ends with something demoable.

| Phase | Duration | Goal | Exit criteria |
|-------|----------|------|---------------|
| **0** | 1 wk | Research & Design | Monorepo scaffold boots; docs + Prisma schema drafted |
| **1** | 2 wk | Core Backend / Auth | Register/login, workspaces, projects, roles, JWT + API keys |
| **2** | 2 wk | Mock Engine | Upload a spec → endpoints auto-serve mock responses |
| **3** | 2 wk | Dashboard | See projects, endpoints, live requests, latency, errors, logs |
| **4** | 2 wk | Stateful APIs | Real CRUD with pagination/sort/search |
| **5** | 2 wk | Failure Simulation | Per-endpoint % error/slow/timeout/network/db-down |
| **6** | 2 wk | AI Generation | Realistic data + examples/tests via OpenAI |
| **7** | 2 wk | Webhooks | Signed, retried, logged outbound webhooks |
| **8** | 2 wk | SDK & CLI | `@mockflow/sdk`; `mockflow init/start/deploy/export` |
| **9** | 2 wk | Polish & Testing | Benchmarks, tests, UI, docs, README |

## Current status

Complete. Every phase shipped and was verified against a live Postgres.

- [x] **Phase 0** — scaffold + docs + schema
- [x] **Phase 1** — auth
- [x] **Phase 2** — mock engine
- [x] **Phase 3** — dashboard
- [x] **Phase 4** — stateful APIs
- [x] **Phase 5** — failure simulation
- [x] **Phase 6** — generation (local + OpenAI)
- [x] **Phase 7** — webhooks
- [x] **Phase 8** — SDK & CLI
- [x] **Phase 9** — tests & docs

### Known gaps, worth picking up next

- **Spec formats.** OpenAPI/Swagger JSON only — no YAML, and no Postman
  collection importer yet. `$ref` resolution is one hop deep.
- **Response variants.** One default response per endpoint; the `Response`
  table supports more, but nothing selects between them yet.
- **Queueing.** Webhook delivery and generation run inline. BullMQ is in the
  stack for when fan-out justifies it.
- **Dashboard coverage.** Failure rules are editable in the UI; webhooks and
  generation are API- and CLI-only so far.
