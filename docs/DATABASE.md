# Database

PostgreSQL via Prisma. Source of truth: `apps/api/prisma/schema.prisma`.

## Entities

```
Workspace ─┬─< Membership >─ User
           ├─< Project ─┬─< Endpoint ─┬─< Response
           │            │             └─< RequestLog
           │            ├─< Collection
           │            ├─< Environment ─< Variable
           │            └─< Webhook ─< WebhookDelivery
           ├─< ApiKey
           ├─< AiJob
           ├─< Usage
           └─< Template
```

## Tables

| Table                | Purpose                                             | Phase |
|----------------------|-----------------------------------------------------|-------|
| `workspaces`         | Top-level tenant                                    | 1 |
| `users`              | Accounts (email + password hash)                    | 1 |
| `memberships`        | User ↔ workspace with a `Role`                      | 1 |
| `api_keys`           | Hashed programmatic keys per workspace              | 1 |
| `projects`           | A mock API project                                  | 2 |
| `endpoints`          | Method + path + schemas + stateful/failure config   | 2 |
| `responses`          | Canned responses per endpoint                       | 2 |
| `collections`        | Grouping of endpoints                               | 3 |
| `environments`       | Named variable sets                                 | 3 |
| `variables`          | Key/value within an environment                     | 3 |
| `webhooks`           | Configured outbound webhooks                        | 7 |
| `webhook_deliveries` | Delivery attempts + results                         | 7 |
| `request_logs`       | Every mocked request (method, status, latency)      | 3 |
| `ai_jobs`            | Async AI generation jobs                            | 6 |
| `usage`              | Per-metric usage counters                           | 8 |
| `templates`          | Reusable endpoint/response/project presets          | 9 |

## Enums

- `Role`: OWNER, ADMIN, MEMBER, VIEWER
- `HttpMethod`: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- `AiJobStatus`: QUEUED, RUNNING, SUCCEEDED, FAILED

## Migrations

```bash
pnpm db:up            # start postgres + redis
pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate dev
```
