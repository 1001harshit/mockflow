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

## Mock endpoints (Phase 2)

| Method | Path                                        | Description                   |
|--------|---------------------------------------------|-------------------------------|
| POST   | `/api/projects/:id/import`                  | Upload OpenAPI/Swagger/Postman|
| GET    | `/api/projects/:id/endpoints`               | List generated endpoints      |
| PATCH  | `/api/endpoints/:id`                        | Edit response/failure/stateful|

## API keys (Phase 1)

| Method | Path                       | Description        |
|--------|----------------------------|--------------------|
| POST   | `/api/keys`                | Create API key     |
| DELETE | `/api/keys/:id`            | Revoke API key     |

> This is a living document; concrete request/response shapes are defined as
> each phase is implemented. The mock plane's routes are dynamic and defined by
> uploaded specs, not listed here.
