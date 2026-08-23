# Failure Simulation (Phase 5)

Real APIs fail. MockFlow lets you rehearse those failures on purpose, per
endpoint, so client code can be tested against the bad paths instead of only
the happy one.

## The model

Every endpoint carries a list of rules on `Endpoint.failureRules`:

```jsonc
[
  { "type": "error",   "percent": 10, "statusCode": 500 },
  { "type": "slow",    "percent": 20, "delayMs": 2000 },
  { "type": "timeout", "percent": 5 },
  { "type": "network", "percent": 2 },
  { "type": "db_down", "percent": 1 }
]
```

Rules are evaluated with **a single roll over their cumulative percentages**, so
at most one rule fires per request and the numbers read the way you'd say them
out loud: the list above is 10% errors, 20% slow, 5% timeouts, 2% dropped
connections, 1% database outages — and 62% healthy. Enabled rules may not total
more than 100%; the API rejects a set that does.

## Failure types

| Type      | What the client sees                                          |
|-----------|---------------------------------------------------------------|
| `error`   | `statusCode` (default 500) with an error body                  |
| `slow`    | The **real** response, after `delayMs` (default 1000)          |
| `timeout` | Stalls for `delayMs` (default 30000), then 504                 |
| `network` | Nothing — the connection is destroyed (`ECONNRESET`)           |
| `db_down` | 503 with a "database connection failed" payload                |

Delays are capped at 120 s so a stray zero can't wedge a worker.

### Fields

| Field        | Applies to          | Default                        |
|--------------|---------------------|--------------------------------|
| `type`       | all                 | — (required)                   |
| `percent`    | all                 | — (required, 0–100)            |
| `statusCode` | `error`             | 500                            |
| `delayMs`    | `slow`, `timeout`   | 1000 / 30000                   |
| `body`       | answering types     | a canned error payload         |
| `enabled`    | all                 | `true` — set `false` to park it|

## Configuring rules

```http
PATCH /api/projects/:id/endpoints/:endpointId
Authorization: Bearer <token>

{ "failureRules": [ { "type": "error", "percent": 25, "statusCode": 502 } ] }
```

Send `"failureRules": []` to clear them. Rules come back on
`GET /api/projects/:id/endpoints`.

## Observing the damage

Answered failures carry an `x-mockflow-failure: <type>` response header, and
every request records which rule fired:

- `GET /api/projects/:id/logs` — each row has a `failureType`
- `GET /api/projects/:id/stats` — `injectedFailures: { count, rate, byType }`

Keeping that separate from `errorRate` is the point: it tells a deliberate
chaos run apart from a genuine regression. A dropped connection is logged with
status `0`, since there is no HTTP status to record.
