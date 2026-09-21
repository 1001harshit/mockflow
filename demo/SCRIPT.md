# MockFlow — demo video script

Everything here assumes the stack is up:

```bash
pnpm db:up
pnpm --filter @mockflow/api dev          # :4000
pnpm --filter @mockflow/dashboard dev    # :3000
```

**Run `source demo/reset.sh` before every take.** It creates a fresh project,
imports the spec, and leaves it un-generated so the before/after scene works.
It exports `$PID`, `$MOCK`, `$AUTH` and the endpoint ids into your shell.

---

## Before you hit record

| | |
|---|---|
| **Capture** | `Cmd+Shift+5` → Record Selected Portion. Free, no watermark. Use OBS only if you want webcam or scene cuts. |
| **Resolution** | Size the window to 1920×1080. Record the *window*, not the whole screen. |
| **Terminal font** | 18–20pt. Default 12pt is unreadable once compressed by YouTube/LinkedIn. |
| **Prompt** | `export PS1="$ "` — hides your machine name and long paths. |
| **Clear between scenes** | `clear` before each command so nothing is half-scrolled. |
| **Hide** | Notifications off (Focus mode). Close unrelated tabs. |
| **Token TTL** | Access tokens last 15 min. Re-run `source demo/reset.sh` if a take runs long. |

Two-window layout works best: terminal on the left, browser (dashboard) on the
right, both visible at once for the chaos scene.

---

## Full cut (~3:30)

### 1 — The problem (0:00–0:20)
**Show:** the spec file, then the mock answering immediately.
```bash
clear
source demo/reset.sh
curl -s $MOCK/products | python3 demo/_table.py
```
**Say:** "I point MockFlow at an OpenAPI spec and the endpoints are live
instantly. But look at the data — every field is the word *string*. That's what
every mocking tool gives you, and it's useless for building a UI."

### 2 — Realistic data (0:20–0:55)
```bash
curl -s -X POST $API/api/projects/$PID/ai/endpoints/$GET_PRODUCTS/generate \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"count":10,"save":true}' > /dev/null
./demo/show-products.sh
```
**Say:** "One call, and it's a catalogue. And it's *coherent* — the brand
belongs to the category that sells it, the model belongs to that brand, the
price sits in a believable band for that category. No API key needed; this is
derived from the schema and the field names."

> The strongest 10 seconds in the video. Let the table sit on screen.

### 3 — Chaos (0:55–1:45) — **the centrepiece**
```bash
curl -s -X PATCH $API/api/projects/$PID/endpoints/$GET_PRODUCTS -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"failureRules":[{"type":"error","percent":30,"statusCode":500},
                       {"type":"db_down","percent":15},
                       {"type":"slow","percent":20,"delayMs":400}]}'
./demo/chaos-watch.sh 30 0.15
```
**Say:** "Now I tell this endpoint to misbehave — 30% of requests return a 500,
15% act like the database is down, 20% are slow. Watch."

Then cut to the dashboard (`localhost:3000/projects/$PID`) and point at the
**Injected** stat card. **Say:** "It tracks deliberate chaos separately from
real errors, so you can tell a chaos run from an actual regression."

Optionally show the editor: click the **Failures** button on the endpoint row.

### 4 — Stateful (1:45–2:20)
```bash
clear
./demo/stateful-demo.sh
```
**Say:** "Flip an endpoint to stateful and it becomes a real store. I POST three
products, and GET returns exactly those — with search and sort on the list.
Most mock tools just replay a canned body no matter what you send."

### 5 — Webhooks (2:20–3:05)
```bash
clear
./demo/webhook-demo.sh
```
**Say:** "MockFlow can also *send* webhooks, signed the way the real provider
signs them. On the left is a receiver running Stripe's own documented
verification algorithm — it has no idea this isn't Stripe. The first two
attempts I make it reject, so you can see the retry and backoff. Every attempt
is re-signed, because Stripe binds the signature to a timestamp."

### 6 — CLI & close (3:05–3:30)
```bash
clear
mockflow chaos /products error:10 slow:20@2000
mockflow logs --limit 8
```
**Say:** "There's a CLI and a typed SDK for all of it. Self-hosted, so your
specs and your traffic stay on your own Postgres. That's MockFlow."

End on the README or the repo page.

---

## Short cut (~60s, for LinkedIn/X)

Scenes **1 → 2 → 3** only, no narration, captions on screen:

1. `"string"` table — caption **"Every mock tool gives you this"** (0:00–0:08)
2. generated table — caption **"MockFlow gives you this"** (0:08–0:20)
3. `./demo/chaos-watch.sh 40 0.12` — caption **"…and lets you break it on purpose"** (0:20–0:50)
4. Dashboard Injected card — caption **"chaos tracked separately from real errors"** (0:50–1:00)

Silent + captions outperforms narration on social; most people watch muted.

---

## After recording

- Trim dead air where commands are still running — nobody needs to watch a
  spinner. Keep the chaos scene real-time though; the rhythm is the point.
- Add captions. QuickTime → iMovie is enough for trimming and titles.
- Export 1080p H.264. Under 100 MB plays inline on most platforms.
- For the README, convert the short cut to a GIF, or upload the MP4 to a
  GitHub issue and paste the resulting URL into the README — GitHub hosts it
  and renders an inline player.
