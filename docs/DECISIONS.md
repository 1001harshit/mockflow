# Decision record

Why this project is shaped the way it is, in the order the decisions were
actually made. Each entry says what was true at the time, what changed, and
what it cost — including the ones that were later undone.

---

## 1. Web-first, on Postgres (Phases 0–9)

**Decision.** Build MockFlow as a web application: a NestJS API and a Next.js
dashboard, backed by PostgreSQL, with Docker Compose bringing up Postgres and
Redis for local development.

**Why.** A mock server is something a *team* points at. A shared URL that
several developers and a CI pipeline can all call is the obvious shape, and a
networked database is the obvious way to back it. Postgres also gave the
schema room: `Json` columns for response schemas and failure rules, enums for
roles and HTTP methods, and real foreign keys.

**What it cost.** Nothing visible at the time. Ten phases shipped this way and
every one was verified against a live Postgres.

---

## 2. The desktop question

**What prompted it.** Running MockFlow meant starting Docker, waiting for
Postgres, applying migrations, then starting two dev servers. For a tool whose
whole pitch is *"stop waiting for the backend"*, that is a lot of waiting.

The comparison that mattered: **Mockoon** ships as an application you download
and double-click. That convenience is a large part of why people choose it,
and it is not a feature we could match while requiring a database server.

**The blocker.** A desktop app whose first instruction is *"install Docker"*
is not a desktop app. Postgres cannot be bundled inside a `.app` in any way a
normal user would accept.

---

## 3. Both databases at once — and why that lasted an hour

**Decision.** Keep Postgres for the web deployment, add SQLite for the desktop
build, and switch between them at build time.

**How it worked.** Prisma requires the datasource provider to be a string
literal, so one schema cannot serve two providers. The Postgres schema stayed
the source of truth and a script derived the SQLite one from it, emitting a
second generated client. `PrismaService` chose between them on an environment
variable.

**Why it was abandoned.** It worked — both targets ran side by side from one
build — but the cost was a derived schema that could drift, a second generated
client, a runtime switch, and two sets of migrations. All of that existed to
preserve a database the desktop app could never ship.

The honest question was whether Postgres was still earning it. So it was
measured rather than assumed.

---

## 4. One database: SQLite

**The measurement.** Both targets were run at once, on the same machine, from
the same build, against the same spec. Every mock request writes a request-log
row, so this is a write-heavy test by design.

| Concurrency | Postgres | SQLite (WAL) |
|-------------|----------|--------------|
| 20          | 2,496 req/s | **3,401 req/s** |
| 60          | **3,034 req/s** | 2,403 req/s |

Same order of magnitude in both directions, and SQLite ahead at the lower
concurrency. Both are far beyond what a mock server is ever asked for.

**Decision.** SQLite, everywhere. Postgres retired.

**Why.** It was not buying throughput, and it was the one thing preventing a
desktop build. Removing it deleted the derive script, the second client, the
build-time switch, the second migration set, and Docker Compose — which had
been providing Postgres and a Redis that no source file ever imported.

**What it cost, honestly.** SQLite has a single writer. One API process is now
the ceiling: several instances behind a load balancer would mean going back to
a networked database. For a self-hosted developer tool and a desktop app, that
ceiling is far above the need. For a hosted multi-tenant service it would not
be, and that is a door this closes.

**One detail that made it work.** SQLite defaults to a rollback journal, which
serialises readers behind the writer. Since the mock plane writes a log row on
every request, that default would have let logging throttle the very traffic
it exists to observe. WAL, `synchronous = NORMAL` and a busy timeout are set
on connect.

---

## 5. Electron for the shell, not Tauri

**Decision.** Wrap the existing web app in Electron.

**Why not Tauri.** Tauri produces roughly a 10 MB application against
Electron's 100 MB, which is a real advantage. It also compiles a Rust binary,
so it requires the Rust toolchain on every machine that builds the app. That
is a reasonable trade for a team already using Rust and an unreasonable one
for a project whose entire toolchain is otherwise Node.

**What this preserves.** The desktop app is not a fork. It runs the same API
and the same dashboard; the shell starts them as child processes and points a
window at them. A fix to the web app is a fix to the desktop app, because
they are the same build.

---

## 6. What the shift actually changed

| | Before | After |
|---|---|---|
| Database | PostgreSQL | SQLite, one file |
| To run it | Docker, Postgres, Redis, migrate, 2 servers | `pnpm db:migrate && pnpm dev` |
| Infrastructure | `docker-compose.yml` | none |
| Targets | web | web **and** desktop, one codebase |
| Scaling ceiling | horizontal | one process |

The web version did not go away and did not change shape. It got simpler, and
gained a second way to ship.
