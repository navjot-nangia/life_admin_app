# Life Admin — Your Personal Operations Manager

A mobile-first PWA for responsibilities, private documents, reminders, preparation checklists, and recurring completion history. No seeded personal records, fake integrations, payment flows, or simulated AI extraction.

## Stack

React 19, TypeScript, Vinext, accessible Shadcn/Radix primitives, Cloudflare Worker APIs, D1 SQLite and private R2 storage. The Sites starter is retained, including its build tooling and dispatch-owned ChatGPT authentication. Small server modules separate domain dates, authorization, storage, extraction, reminders and push delivery. All durable product data is server-backed; browser storage is not the source of truth.

## What works in the Sites deployment

- ChatGPT sign-in and automatic app profile creation; optional three-step onboarding.
- Create, search, filter, edit, reschedule, archive and restore responsibilities.
- All 11 requested categories; associated person/pet/vehicle/property, provider, optional cost/currency, notes and documents.
- Daily/custom intervals, weekly, monthly and annual recurrence; fixed-schedule and completion-date modes.
- Proposed next date always reviewed before completion. Dates must move beyond today and the old due date. One-time completions retain the original date.
- One responsibility retains its identity across cycles. Transactional completion records have a unique item/cycle key; version comparison prevents repeated requests or stale edits from advancing twice.
- Persistent in-app notifications, reminder preferences, quiet hours, time zones, snooze, and completed-cycle history.
- Private uploads and authenticated downloads. PDFs, JPGs and PNGs, 10 MB maximum, declared MIME and magic-byte validation, bounded request reading. No public R2 URLs.
- Consent-gated, server-side Anthropic extraction when configured; fact/evidence review, ambiguity warnings, and separate suggestions. Manual entry always works without AI credentials.
- Rules-based possible gaps from onboarding categories, household details and existing items; persistent dismissals and 30-day “later” decisions.
- Editable guided checklists without claiming live quotes or performing external actions.
- JSON data export, original-file download, document deletion, and app-account data deletion.
- Installable manifest, 192/512 PNG icons, service worker and a private-data-free offline fallback. Personal pages, API responses, identity endpoints and documents are never stored in service-worker caches.

## Configuration status and important deployment boundaries

The initial Sites deployment is **owner-private**, using ChatGPT sign-in. It is not a public email/password SaaS. Public access or household sharing requires an explicit later audience/product decision. Do not expose the Worker directly: its authentication relies on Sites removing spoofed identity headers and forwarding verified identity.

**Background delivery is not active in the initial deployment.** The available Sites hosting interface does not expose cron-trigger provisioning or access to attach a separate Worker to its managed database. The app truthfully shows “Not active”; it checks due reminders when the authenticated app is opened/refreshed. A tested server scheduler and Web Push implementation are included under `deploy/`, but turning them on requires a hosting administrator capable of binding the scheduler to the same database and provisioning cron triggers. Credentials alone do not grant this access. Do not use browser-refresh tricks, test auth bypass tokens, or client-side timers as substitutes for real background scheduling.

AI and push keys are not supplied. The configuration template lists every service setting. AI and browser-push delivery have not been exercised against a paid provider or real device. Live installation and browser UI QA are also not claimed; the application build, TypeScript, server-route integration and scheduler logic are tested.

## Local setup

Prerequisites: Node 24 (Node 22.13+ for the app), and the pnpm version recorded in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
```

Set `.openai/hosting.json` logical bindings to `"d1": "DB"`, `"r2": "BUCKET"`; these are already declared. Leave the existing `project_id` intact for this Site. Do not copy its identity to a different project.

Apply migrations to the local database after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pretty_sleeper.sql
pnpm dev
```

The portable starter provides a loopback-only local sign-in helper. It must remain disabled on managed/public deployments. Normal Sites deployment handles real identity and migrations automatically. The starter selects managed/portable execution profiles through its scripts; preserve these helpers. Never trust caller-supplied identity headers in a standalone deployment.

## Test and build

```sh
node tests/run.mjs
pnpm exec tsc --noEmit
pnpm build
```

The test runner transpiles the actual domain and HTTP route modules into ignored temporary modules, executes migrations in Node SQLite, and substitutes only the platform identity/storage interfaces. It checks authentication rejection, cross-site mutations, per-user reads/writes/deletes, actual file route ownership, MIME/magic checks, consent, honest missing-AI behavior, completion transactions, stale edits, history preservation, suggestion dismissals, time-zone boundaries, leap years, month ends, quiet hours, snooze and duplicate prevention. Test data remains local, in memory. This does not certify production dispatch or R2 internals; those are platform responsibilities.

## Deploy/update this Site

1. Build the source and generate/inspect a new Drizzle migration only when schema changes.
2. Use the Sites skill/tooling to commit and push the exact source to this Site’s provisioned repository.
3. Package the resulting Worker, static assets, hosting manifest and migrations; save a Site version and privately deploy it.
4. Wait for a successful terminal deployment status. The platform applies migrations and binds DB/BUCKET.
5. Set runtime secrets using Sites environment-variable management, not client code or Git. Reuse the existing Site ID for updates.

The complete source is in the Site repository; the downloadable source archive contains the app, schema/migration, tests, scripts, this guide and `.env.example`. It omits dependencies, local runtime state, credentials, Git internals and compiled build output.

## Railway deployment

The repository also includes a Railway-specific runtime. Railway builds the same Vinext application, starts its Cloudflare-compatible worker on a private loopback port, and exposes it through a small gateway. The gateway strips all caller-supplied identity headers and injects one configured testing identity. The current testing deployment is public, so everyone who opens the URL shares that workspace.

Set `LIFE_ADMIN_EMAIL` and optionally `LIFE_ADMIN_NAME` in Railway. To restore browser password protection, set `LIFE_ADMIN_PUBLIC=false` together with `LIFE_ADMIN_USERNAME` and `LIFE_ADMIN_PASSWORD`. Attach a persistent volume and mount it at `/data`; Railway then supplies `RAILWAY_VOLUME_MOUNT_PATH`, and both the local D1 database and private document objects survive deployments. Without a volume, data is ephemeral. Do not expose the internal worker port or remove the gateway.

Railway uses `railway.json` and the default `pnpm start` script to launch the private gateway. The Railway schema is applied idempotently at startup. For a direct local Worker preview, use `pnpm start:worker-local`. The Sites deployment remains unchanged and continues to use managed D1, R2, and ChatGPT identity.

## Enable AI extraction

Set server-side `AI_API_KEY` to an Anthropic API key and `AI_MODEL` to a currently available image/PDF-capable model in that account. Configure these values through Sites secrets, then reload Settings. The adapter uses Anthropic’s Messages endpoint with base64 `image`/`document` content and validates returned JSON through Zod. `ExtractionProvider` in `lib/life/ai.ts` is the replaceable provider contract.

Upload a representative record, explicitly consent to sending it to Anthropic, and test extraction. Failures show manual entry without fabricated extracted values. The review screen keeps original evidence/page labels and distinguishes ambiguity and AI suggestions. AI-provided supporting text is not independently verified against a local OCR engine. Review remains required. Dates, recurrence and reminders are never silently committed from AI output.

Extraction is limited to 5 MB, with a 60-second timeout. Upload only relevant pages; the user chooses/redacts the portion sent. No autonomous page-selection or local OCR/redaction is claimed. No raw content is logged by the app. Provider pricing/retention is governed by the selected account’s policy; review that policy before production use.

## Deploy the background scheduler and Web Push

`deploy/scheduler-worker.ts` is a Worker scheduled handler, independent of browser activity. It runs the shared scheduler against DB and delivers **empty-payload Web Push** notifications. The browser shows a generic notice; personal titles and contents do not go to push services. Persistent database IDs deduplicate logical reminder stages; browser notification tags coalesce repeated generic wake-ups. Transport delivery is best effort, not an exactly-once guarantee.

**Prerequisite:** administrator access to deploy a Worker in the database-owning Cloudflare account and attach the existing D1 database. This is not currently exposed through the Sites tools. Do not invent a database ID, change the Site’s logical binding into a raw ID, or create an unrelated empty database and claim reminders are connected. If the administrator cannot grant this, background delivery remains unavailable on this deployment; moving the full product to independently controlled infrastructure also requires a real trusted authentication gateway/provider.

Once that infrastructure is available:

1. Copy `deploy/wrangler.scheduler.example.jsonc` to a local scheduler config and replace the database ID with the verified same database. Never replace it with an unrelated database.
2. Generate P-256 VAPID keys using `node deploy/generate-vapid.mjs`. Keep the private output in your secret manager; never commit it.
3. Set the same VAPID public/private keys on the app and scheduler. Set `VAPID_SUBJECT` on the scheduler to a monitored `mailto:` contact.
4. Deploy the scheduler with Wrangler and its 15-minute cron. The example config specifies `nodejs_compat` for Buffer support.
5. The scheduler writes a heartbeat to D1 after successful processing. Settings reports Active only when it is less than an hour old.
6. Explicitly enable push in Settings on the installed device. Permission refusal is respected. Test a responsibility with an offset due now, outside quiet hours; close the app and confirm delivery.

Reminders choose the most relevant elapsed offset when several have already passed; earlier ones are recorded as superseded rather than creating a storm of historical notices. New due dates and snooze dates use distinct deterministic keys. Month arithmetic preserves the calendar anchor (January 31 → February 28 → March 31); leap-day annual anchors recover in leap years. DST uses the configured IANA zone, not a browser-local UTC conversion. If a chosen hour falls inside overnight quiet hours, it is deferred to the following quiet-hours end. Archived and completed items generate no new reminders.

## Privacy and security model

Every API route requires server-side identity. Prepared queries scope reads, writes and deletes by the authenticated user. Cross-origin unsafe requests are rejected. Files are namespaced by user and opaque ID, served only after a matching ownership query, as attachments with `private, no-store`, nosniff and a sandbox CSP. JSON responses are also non-cacheable. R2 is private; hosting infrastructure supplies HTTPS and at-rest encryption. No infrastructure security audit is implied.

The app never collects identification numbers or bank credentials as structured fields. Notes/uploads can still contain personal information, so only submit necessary data. User-requested deletion removes R2 files before database records and can be retried after a storage failure. Export includes records and metadata; original documents are downloaded separately.

## Future extensions

Keep future connectors behind a server connector interface; keep separate household membership/permission tables when introducing shared ownership. Calendar links and subscription billing should be separate services with explicit permission and audit trails. None are displayed as connected in this MVP. Pricing of $6.99–$9.99/month remains an unvalidated hypothesis; no payments are implemented.
