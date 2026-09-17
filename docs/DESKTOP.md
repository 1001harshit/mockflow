# Running MockFlow as a desktop app

The desktop build is not a separate product. It starts the same API and the
same dashboard the web build runs, on ports the operating system hands out,
and points a window at them. A fix to the web app is a fix to the desktop app.

## Running it

```bash
pnpm install
pnpm build          # the shell runs the built API and dashboard, not dev servers
pnpm desktop
```

The window opens once both servers answer. There is nothing else to install —
no database server, no Docker.

## What the shell does on launch

1. Asks the OS for two free ports. It cannot claim 4000 and 3000; whoever runs
   this is very likely a developer with something already there — quite
   possibly this project's own web build.
2. Runs `prisma migrate deploy` against the user's database. On a first launch
   there is no database at all; without this the API opens an empty file and
   fails on its first query.
3. Starts the API and the dashboard as child processes, forwarding their output
   with `[api]` and `[web]` prefixes.
4. Waits for both to answer, then loads the dashboard in the window.
5. Stops both children when the app quits.

If any of that fails, the window says what went wrong and what to do about it,
rather than showing a blank page or a connection-refused error.

## Where your data lives

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/@mockflow/desktop/mockflow.db` |
| Linux    | `~/.config/@mockflow/desktop/mockflow.db` |
| Windows  | `%APPDATA%\@mockflow\desktop\mockflow.db` |

**Show Data Folder** in the menu opens it. The database is deliberately kept
outside the application bundle, because an update replaces the bundle whole
and would take the data with it.

JWT secrets are generated fresh on each launch rather than shipped as
constants — a constant baked into a distributed app is the same secret on
every install of it.

## Why Electron and not Tauri

Tauri would produce roughly a 10 MB application against Electron's 100 MB,
which is a real advantage. It also compiles a Rust binary, so it puts the Rust
toolchain in the path of every build. For a project whose toolchain is
otherwise entirely Node, that is a poor trade. See
[DECISIONS.md](DECISIONS.md).

## Packaging — not finished

The `build` block in `apps/desktop/package.json` describes the bundle, but
electron-builder is deliberately **not** installed yet.

It was, briefly. Adding it broke every `pnpm` script in the repo: pnpm checks
dependencies before running any script, and electron-builder pulls
`app-builder-bin`, whose download failed and retried until `pnpm test` hung
instead of finishing in seconds. A dependency that cannot package anything yet
is not worth that, so it comes back when packaging is actually tackled.

The obstacle is dependencies, not configuration. The shell runs the real API
and the real dashboard, so a packaged app has to carry their `node_modules`
too — including Prisma's platform-specific query engine and Next's server
runtime. pnpm stores those as symlinks into a content-addressed store, which
does not survive being copied into a bundle.

Finishing it means resolving that first: either deploying the API and
dashboard with their dependencies flattened, or bundling each server into a
single file. Only then is electron-builder worth adding back.

Until then, `pnpm desktop` runs the app properly from a built checkout, which
is enough for development and for a demo.
