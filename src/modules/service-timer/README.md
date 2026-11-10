# Service Timer API

Backend for the Service Timer app (`church-workflow-service-timer`). Read the
Service Timer Product Plan and Developer Handoff for the product side.

## What is stored

| Collection       | Scope                | Holds                                                                                                                               |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `timersettings`  | one per branch       | display look (colours, font, 11 toggles, logo), warning minutes, keep-running, shortcuts, operator PIN (hashed), display link token |
| `timertemplates` | shared by the church | saved service flows: name, start time, items                                                                                        |
| `timersessions`  | one per branch       | the live timer: items, current index, timer run, note to the speaker, service start time, version                                   |

All three are created with defaults the first time they are read.

## Access

The `SERVICE_TIMER` permission section, with three system roles seeded at
start-up (Super Admin always has full access):

| Role           | Level       | Can                                                           |
| -------------- | ----------- | ------------------------------------------------------------- |
| Timer Viewer   | VIEW        | see the timer                                                 |
| Timer Operator | MANAGE      | run the timer, edit the program, templates, settings and logo |
| Timer Admin    | FULL_ACCESS | also set the operator PIN and change the display link         |

Without an account:

- **Display link**: anyone with the settings' `displayToken` can watch.
- **Operator PIN**: `displayToken` + PIN gives a 12-hour token that can run the
  timer but not manage it. Five wrong PINs lock it for five minutes. Changing
  the PIN ends every PIN session; changing the links also disconnects every
  display. Displays are never dropped by a PIN change.

Churches record which product they signed up through in `Church.products`
(`POST /church` takes `product: "SERVICE_TIMER"`).

## REST (`/api/v1/service-timer`, signed in)

Everything applies to the user's active branch, except templates (whole church).

| Method        | Path                            | Level         |                                                                                      |
| ------------- | ------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| GET           | `/bootstrap`                    | VIEW          | `{ settings, templates, session, serverNow }`                                        |
| GET / PATCH   | `/settings`                     | VIEW / MANAGE | PATCH is partial; `colors` and `show` can be patched key by key                      |
| POST / DELETE | `/settings/logo`                | MANAGE        | multipart `file` (image, 10 MB)                                                      |
| PUT / DELETE  | `/settings/pin`                 | FULL_ACCESS   | `{ pin }`, 4–8 digits                                                                |
| POST          | `/settings/display-link/rotate` | FULL_ACCESS   | new `displayToken`                                                                   |
| GET / POST    | `/templates`                    | VIEW / MANAGE | POST answers 409 if the name exists: PUT that template to replace it                 |
| PUT / DELETE  | `/templates/:id`                | MANAGE        |                                                                                      |
| GET / PUT     | `/session`                      | VIEW / MANAGE | PUT is the same as the socket's `session:push`, for sending queued changes over HTTP |

## REST (`/api/v1/service-timer/public`, no login)

| Method | Path                      |                                                  |
| ------ | ------------------------- | ------------------------------------------------ |
| GET    | `/:displayToken`          | `{ settings, session, serverNow }` for a display |
| POST   | `/:displayToken/operator` | `{ pin }` → `{ operatorToken, expiresIn }`       |

## Live sync (Socket.IO, namespace `/service-timer`)

Connect with one of these as `auth`:

```js
io(`${API}/service-timer`, { auth: { token: accessToken, branchId } }); // signed in
io(`${API}/service-timer`, { auth: { operatorToken } }); // PIN operator
io(`${API}/service-timer`, { auth: { displayToken } }); // display
```

| Direction       | Event          | Payload                                                                                                                              |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| server → client | `hello`        | `{ settings, session, templates, access: { kind, canControl, canManage }, serverNow }` on connect                                    |
| server → client | `denied`       | `{ message }`, then the server disconnects                                                                                           |
| server → client | `session`      | `{ session, serverNow }` after any controller's change                                                                               |
| server → client | `settings`     | `{ settings, serverNow }` after a settings change                                                                                    |
| server → client | `templates`    | `{ templates, serverNow }` after a template change, to the whole church                                                              |
| client → server | `session:push` | the whole session (`items, index, timer, message, serviceStart, origin`); ack `{ ok, version, serverNow }` or `{ ok: false, error }` |
| client → server | `time`         | ack `{ serverNow }`                                                                                                                  |

Rules carried over from live use (handoff, section 6):

- Every message carries `serverNow`; devices correct their clock by it.
- The latest write wins. Ignore a `session` whose `origin` is your own client id.
  A device that reconnects with unsent changes sends them instead of taking the
  server's copy.
- Socket.IO pings every 5 seconds; reconnect as soon as the page is visible again.
- Templates are saved over REST only, so they cannot be saved while offline.
- An admin's socket keeps the access it had when it connected; reconnect with a
  fresh token after it is refreshed.

## Smart import (`/api/v1/service-timer/imports`, signed in)

| Method | Path     | Level  |                                                                                                                                                                                                            |
| ------ | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/usage` | VIEW   | `{ used, limit, resetsOn }` for this month                                                                                                                                                                 |
| POST   | `/`      | MANAGE | multipart `file` (PDF, .docx, JPG/PNG/WebP/GIF, 10 MB) **or** JSON/form `text` (pasted program, 20,000 characters) → `{ serviceName, serviceStart, items: [{ name, person, minutes, confident }], usage }` |

- One Claude request per import. PDFs and photos go to Claude as they are (it reads them directly, no separate OCR); Word documents are converted to text with `mammoth`. The answer is a structured output validated against `import/program-extraction.ts`, then tidied (trimmed, whole minutes 0–600, valid `HH:MM`).
- Nothing is saved: the app shows a review screen, and the church saves it as a template or loads it into the program.
- `confident: false` marks minutes or names that were estimated or hard to read, for the review screen to highlight.
- Allowance (until plans arrive in Phase 4): timer-only churches get `TIMER_IMPORT_FREE_LIMIT` (default 1) successful imports a month; Church Workflow churches get `TIMER_IMPORT_FAIR_USE_LIMIT` (default 50). Uploads that aren't a program, refusals and errors don't count. Over the limit: `403` with `code: "IMPORT_LIMIT_REACHED"`.
- Every attempt is recorded in `timerimports` with the model and token counts, for cost tracking.
- Model: `TIMER_IMPORT_MODEL` (default `claude-opus-5-5`), effort `TIMER_IMPORT_EFFORT` (`low` / `medium` / `high`, default `medium`). Server-side refusal fallbacks are on (`fallbacks: "default"`).
- Without `ANTHROPIC_API_KEY` the API still starts and imports answer `503`.

## Deployment

The API runs as one long-lived container on Dokploy, behind Traefik, which
passes WebSockets through. If it is ever scaled to more than one replica,
add the Socket.IO Redis adapter and sticky sessions.
