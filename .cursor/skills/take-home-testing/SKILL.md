---
name: take-home-testing
description: >-
  Adds a maintainable unit, integration, and Playwright test strategy for a
  TypeScript take-home (Express, Angular, MongoDB, third-party APIs). Use when
  the user asks for a testing strategy, test coverage, Supertest, Playwright,
  Vitest coverage, CI tests, or to test a take-home without calling real
  GitHub, OpenAI, or other external services.
---

# Take-home testing

Inspect the repo before writing tests. Do not assume modules, routes, or interfaces exist. Adapt names and file layout to what is there.

The goal is a suite a reviewer can run locally, with no third-party credentials, that protects the one flow the exercise requires and the authorization around it. Depth past that is optional. Say so when a request asks for enterprise coverage and a short time box at the same time.

## Order

1. Read the app's composition root, the external-service boundary, and existing specs.
2. Name the required flow and the security checks (ownership, signatures, sessions). Test those first.
3. Add tooling only where the repo has no equivalent. Never add Jest next to Vitest.
4. Run lint, typecheck, unit, integration, e2e, and coverage. Fix failures. Report the numbers from that run.

## Stack

Use these unless the project already has the same job covered:

| Layer | Tool |
|---|---|
| Unit | Vitest |
| API integration | Supertest against the Express app in-process |
| Browser | Playwright, one browser (Chromium) |
| Coverage | Vitest V8, thresholds that fail the run |
| Angular | The project's TestBed runner. If that runner is Vitest, keep it |
| Persistence | The existing local MongoDB (Docker Compose when the repo has it), on a dedicated database name |

All tests in TypeScript.

## Unit

Mock every collaborator of the unit: repositories, HTTP clients, SDKs, clocks, other services. No MongoDB, no network.

Cover behavior, not getters:

- The required flow's matching, filtering (disabled, wrong repo, wrong event), template rendering, unknown fields, action failure, and the recorded result.
- Signature accept and reject. Duplicate delivery. Ownership of installations and repositories.
- Authenticated vs not, cross-user reads and writes, invalid input.
- Shared schema and template helpers, including the invalid cases.
- Angular: list, empty, loading, and error states; the builder form; enable/disable; run history; guards; unavailable integrations shown as unavailable. Mock `HttpClient` with Angular's testing module. Assert rendered output and signal-driven updates, not private fields.

## Integration

Real HTTP through the real app: routing, middleware, validation, sessions, Mongoose. Mock only third parties, at the interface the composition root already accepts. If it cannot accept a substitute, add one override argument at the composition root. Do not rewrite services to make them mockable.

- One dedicated database, never the development database. The helper must refuse a database name that is not the test database.
- Clean data before each test. Close the connection at the end.
- No shared leftover rows, no `sleep`, no dependence on test order. Serialize files if they share one database.
- Prove the idempotency index, owner-scoped queries, and that a run belongs to its zap.

## End to end

Real Angular app, real API, real test database. The browser drives sign-in, the builder, and run history.

Fake only the external provider. Sign-in still goes through the app's login button, state check, and callback. A control route may queue the next account and read what the fake provider recorded. That route must be impossible to ship: it lives outside `src/` and the production build does not compile it. An environment flag is not enough. The web app gets no test hooks.

Keep the suite small. Four journeys are enough: create the required automation in the builder, edit and toggle it so a reload shows the new values, deliver the triggering event and see the run, and show a second user cannot see or change the first user's data through the UI or the API.

## Live provider check

Automated tests never call the real provider. Document a manual smoke test for the required flow (sign-in, install, create, trigger for real, see the side effect and the run). Do not say that smoke test passed unless you ran it in this session.

## Coverage

Targets, enforced: 80% lines and 75% branches overall; 90% lines on the shared contract package when it holds the validation. Include application source. Exclude specs, fixtures, generated output, and the process entrypoint.

Do not drop a hard module from `coverage.include` to clear a threshold. If a target is unrealistic for the time box, leave the threshold honest and name the gap in the report.

## Commands

Root scripts, workspace-aware:

- `npm test` and `npm run test:unit` — unit only, no database
- `npm run test:integration` — needs the database container; documented next to the script
- `npm run test:e2e` — Playwright; starts its own app processes
- `npm run test:coverage` — unit and integration with thresholds
- `npm run typecheck` and `npm run lint`

## CI

If the repo has a GitHub remote, add one workflow on pull requests and pushes to the main branch: `npm ci`, lint, typecheck, unit, integration against a MongoDB service container, Playwright when it is stable in CI, coverage artifacts. Cache npm. No app secrets and no provider credentials.

## Commits

One commit per finished layer (tooling, unit, integration, Angular, e2e, CI and docs). Do not split a layer into empty commits, and do not invent history.

## Report

After the commands have actually run:

```markdown
## Tests
- Unit: N passed, N failed, N skipped (by workspace)
- Integration: ...
- E2E: ...
- Lint / typecheck: pass or the first failure

## Coverage
- shared / api / web: lines% and branches%, and whether the threshold failed

## Covered
- The required flow, the ownership checks, and what the browser suite drives

## Not done
- Live provider smoke test: ran or did not run, and why
- Any production path left uncovered on purpose
```
