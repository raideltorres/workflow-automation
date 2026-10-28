# Workflow Automation

A small Zapier-inspired automation app on the MEAN stack (TypeScript throughout). Users sign in with GitHub, build a
**Zap** (one trigger plus one action), and the app runs it when GitHub sends the matching webhook.

The Zap that works end to end: **GitHub pull request opened → comment on that pull request**, with the comment
built from a template that maps trigger fields (`{{pull_request.author}}`, `{{pull_request.title}}`, …).

## Time log

| | Time (UTC-5) |
|---|---|
| Started (read brief, planning) | 2026-10-27 23:00 |
| Implementation started | 2026-10-27 23:30 |
| Stopped | _to be filled at submission_ |

## Stack

| Layer | Choice |
|---|---|
| Front end | Angular 22 (standalone, OnPush, signals, typed reactive forms), Angular Material |
| API | Express 5, Node 22+, Zod validation, pino logging |
| Persistence | MongoDB 7 in Docker Compose, Mongoose; sessions in Mongo via `connect-mongo` |
| GitHub | GitHub App (`@octokit/app`): user OAuth for sign-in, installation tokens for actions |
| Shared | `@workflow/shared`: Zod schemas, catalog and template helpers used by both API and web |
| Tests | Vitest (API, shared, Angular unit-test builder), supertest |

## Repository layout

```
apps/
  api/      Express API (feature modules: auth, github, zaps, runs, engine, webhooks)
  web/      Angular app (core/, shared/, features/auth, features/zaps)
packages/
  shared/   Contracts shared by API and web (schemas, catalog, templates)
```

## How it works

```
Browser ──/api (dev proxy)──▶ Express API ──▶ MongoDB (users, installations, repositories, zaps, zap runs, sessions)
                                   ▲
GitHub ──webhook──▶ smee.io ──▶ /api/webhooks/github ──▶ ZapExecutor ──▶ GitHub REST (installation token)
```

1. **Sign in.** `/api/auth/github/login` stores a random `state` in the session and redirects to GitHub. The
   callback verifies `state` and exchanges the code for a GitHub App user token. That token is used **once** to read
   the user's profile, the installations they can access and the repositories in each. It is then discarded and
   never persisted. The app stores installations, repositories and a per-user list of accessible repository ids.
2. **Build a Zap.** The builder only offers repositories from that access list. The API re-checks access
   server-side on every create and update, and validates the template against the trigger's declared output fields
   using the same `ZapInputSchema` the UI uses.
3. **Run.** A `pull_request` webhook is verified with HMAC-SHA256 (`X-Hub-Signature-256`, timing-safe) over the raw
   body and acknowledged with `202`. It is then normalized into a trigger event. For each enabled Zap on that
   repository, the executor:
   - claims a `ZapRun` (unique index on `zapId + deliveryId`, so GitHub redeliveries are no-ops),
   - re-checks that the owner still has access,
   - renders the template and posts the comment with a short-lived installation token,
   - records success (with the comment URL) or failure.
4. **Observe.** The Zap page shows run history with links to the PR and the created comment.

Installation webhooks (`installation`, `installation_repositories`) keep installations and repositories in sync and
revoke access when repositories are removed or the app is uninstalled.

## Setup

### Prerequisites

- Node.js 22+ (developed on 24) and npm 10+
- Docker, for the local MongoDB container
- A GitHub account where you can create a GitHub App and own a test repository

### 1. Create a webhook proxy channel

Open <https://smee.io/new> and copy the channel URL. GitHub delivers webhooks to it and `npm run dev` forwards them
to the local API.

### 2. Create the GitHub App

GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**:

| Setting | Value |
|---|---|
| Homepage URL | `http://localhost:4200` |
| Callback URL | `http://localhost:4200/api/auth/github/callback` |
| Expire user authorization tokens | on (default) |
| Request user authorization (OAuth) during installation | **off** |
| Setup URL | `http://localhost:4200/api/auth/github/login` (check **Redirect on update**) |
| Webhook | active, URL = your smee channel, secret = a random string |
| Repository permissions | **Pull requests: Read and write** (Metadata: read-only is automatic) |
| Subscribe to events | **Pull request** (installation events are always sent) |
| Where can it be installed | Only on this account (fine for the demo) |

After creating it, note the **App ID**, **Client ID** and app **slug** (from the public page URL), generate a
**client secret**, and generate a **private key** (`.pem`).

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`. Every variable is documented in `.env.example`. Save the private key as
`apps/api/github-app.private-key.pem`; `*.pem` and `.env` are gitignored. The API validates its environment at
startup and exits with a list of anything missing.

### 4. Install and run

```bash
npm install
docker compose up -d
npm run dev
```

`docker compose up -d` starts MongoDB 7 on `localhost:27017` with no authentication and a named volume. That is
intentional for a local review: the reviewer needs no cloud account, and the port is bound to localhost only. Point `MONGODB_URI` at another server if you already have one. The API and the Angular app stay on the
host; only the database is containerized, so hot reload and the webhook forwarder keep working.

`npm run dev` builds the shared package, then runs four processes:
- the shared package watcher,
- the API on `:3000`,
- the Angular dev server on `:4200`, which proxies `/api` to the API,
- the smee webhook forwarder.

Open <http://localhost:4200>.

### 5. Try it

1. **Sign in with GitHub.**
2. In the builder, use **Install the GitHub App on more repositories** and pick a test repository. GitHub redirects
   back through the Setup URL and your repository access is refreshed.
3. Create a Zap:
   - trigger: GitHub, Pull request opened, your repository;
   - action: GitHub, Comment on pull request, a comment using the field chips;
   - toggle it **On** and save.
4. Open a pull request on that repository. A comment appears within a few seconds, and the run shows up in
   **Run history**.

## Scripts

| Command | What it does |
|---|---|
| `docker compose up -d` | Start local MongoDB (also `npm run db`) |
| `npm run dev` | Shared watcher, API, web and smee together |
| `npm test` | All unit tests (shared, API, web) |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Production builds of shared, API and web |

## Design decisions and tradeoffs

- **GitHub App rather than OAuth App.** Least privilege: the only write permission is Pull requests. Comments come
  from a bot identity, and one app-level webhook replaces creating hooks per repository. It costs a little more
  setup (private key, installation tokens).
- **No stored user tokens.** Installation tokens cannot tell us what a *user* may access, so the user token is used
  only during the OAuth callback to snapshot access, then dropped. The tradeoff: if a user loses access on GitHub,
  the snapshot is stale until their next sign-in or an installation webhook. The executor re-checks the snapshot
  before every run.
- **Idempotency on `zapId + deliveryId`.** One delivery can fan out to several Zaps, each running at most once. The
  run is claimed *before* the action, so delivery is at-most-once: a crash mid-run leaves a `running` record rather
  than risking a duplicate comment.
- **In-process execution after a `202`.** No queue. This keeps GitHub's 10-second timeout safe and the
  infrastructure minimal. Production would move execution to a durable queue (BullMQ, SQS) with retries.
- **Registry, not a workflow engine.** Triggers are normalizers keyed by GitHub event and action. Actions are handlers
  keyed by action key. Adding an integration means adding a definition to the shared catalog and a handler, without
  changing the engine. Zaps are single-step on purpose.
- **Catalog in the shared package.** The app picker, builder validation and API validation read the same data.
  GitLab, Slack, Linear, Jira and Sentry appear as *coming soon* so the picker is honest about what runs.
- **Mustache-style templates.** `{{field}}` placeholders resolved from a flat map of declared output fields. There
  is no expression evaluation, so templates cannot run code or reach undeclared data, and unknown fields are
  rejected when the Zap is saved.
- **Server-side sessions.** An httpOnly, SameSite=Lax cookie with sessions in Mongo: revocable, and no tokens in the
  browser. The Angular dev proxy keeps everything same-origin.
- **Local MongoDB, not a hosted cluster.** Reviewers run on their own machine, and a cloud cluster fails when their
  IP is not allowlisted or when credentials would have to travel with the repo. Compose runs Mongo only. The API
  still takes any `MONGODB_URI`, so a hosted database remains a config change.

## Known limitations

- Runs are not retried. A failed comment, such as a transient GitHub error, is recorded as `failed`. Because runs
  are keyed on the delivery id, replaying the same delivery is deliberately a no-op, so a retry would need an
  explicit "re-run" feature.
- Repository access is a snapshot (see above). Org members other than the installer get access on their next
  sign-in.
- There is a single trigger and a single action. The trigger event type is still PR-shaped, and adding non-PR
  triggers would generalize `TriggerEvent`.
- Deleting a Zap keeps its run history documents.
- Production deployment (HTTPS, secure cookies behind a proxy, rate limiting, a CSRF token in addition to SameSite)
  is out of scope for the exercise.
