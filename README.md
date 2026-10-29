# Workflow Automation

A Zapier-style app. You sign in with GitHub, build a Zap (one trigger and one action), and the app runs it when GitHub sends the matching webhook.

The Zap that runs end to end is **pull request opened → comment on that pull request**. The comment is a template, so `{{pull_request.author}}` and `{{pull_request.title}}` are filled in from the event. An optional Copilot draft can write that Zap for you. It is always saved switched off.

## Time log

| | Time (UTC-5) |
|---|---|
| Started (read brief, planning) | 2026-10-27 23:00 |
| Implementation started | 2026-10-27 23:30 |
| Stopped | _fill in the actual stop time_ |

## Requirements

- Node.js 22+ and npm 10+
- Docker, for the local MongoDB container
- A GitHub account that can create a GitHub App and a test repository

## Setup

### 1. Webhook channel

Open <https://smee.io/new> and copy the channel URL. `npm run dev` forwards deliveries from that channel to the local API.

### 2. GitHub App

GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**:

| Setting | Value |
|---|---|
| Homepage URL | `http://localhost:4200` |
| Callback URL | `http://localhost:4200/api/auth/github/callback` |
| Request user authorization (OAuth) during installation | off |
| Setup URL | `http://localhost:4200/api/auth/github/login` (check **Redirect on update**) |
| Webhook | active, URL = your smee channel, secret = a random string |
| Repository permissions | Pull requests: Read and write |
| Subscribe to events | Pull request |

Note the App ID, Client ID, and slug (the last part of `https://github.com/apps/<slug>`). Generate a client secret and a private key.

### 3. Configure and run

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run db
npm run dev
```

Fill in `apps/api/.env`. Each variable is documented in `.env.example`. Put the private key at the path in `GITHUB_PRIVATE_KEY_PATH`. `.env` and `*.pem` are gitignored. The API exits on startup if a required variable is missing.

`npm run dev` starts MongoDB's companion processes: the shared package watcher, the API on port 3000, the Angular app on port 4200 (it proxies `/api`), and the smee forwarder. Open <http://localhost:4200>.

Copilot is off until `OPENAI_API_KEY` is set. Restart `npm run dev` after adding it. `OPENAI_MODEL` defaults to `gpt-4o-mini`.

## Try it

1. Sign in with GitHub.
2. In the builder, use **Install the GitHub App** and choose a test repository. It then appears in the Repository dropdown.
3. Create a Zap: Pull request opened, that repository, a comment that uses the field chips, switched **On**. Save.
4. Open a pull request on that repository. The bot comments within a few seconds, and **Run history** shows the run with a link to the comment.
5. To use Copilot instead of filling the form: select the repository, describe the Zap, and click **Draft Zap**. Review the result, switch it **On**, and save. Copilot cannot enable a Zap.

## Scripts

| Command | What it does |
|---|---|
| `npm run db` | Start local MongoDB |
| `npm run dev` | API, web app, and webhook forwarder |
| `npm test` | Unit tests. No database |
| `npm run test:integration` | API tests against MongoDB |
| `npm run test:e2e` | Playwright. Needs MongoDB and starts its own servers |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Production build |

Automated tests do not call GitHub or OpenAI. CI runs the same suites on pull requests.

## How it works

Sign-in uses the GitHub App user token once, to record which repositories the user can access, then drops the token. The builder and the API both reject a repository outside that list. A webhook is checked with HMAC-SHA256 over the raw body, answered with `202`, and then matched to enabled Zaps on that repository. Each Zap runs at most once per delivery. The comment is posted with a short-lived installation token.

Copilot may only return a name and a comment template. The server sets the trigger, the action, and the selected repository, validates the result with the same schema as the form, and saves the Zap switched off.

## Limitations

- One trigger and one action: pull request opened, then comment.
- A failed run is not retried. Redelivering the same webhook does not post a second comment.
- Repository access is a snapshot until the next sign-in or an installation webhook.
- Copilot only drafts that one Zap, and only when `OPENAI_API_KEY` is set.
