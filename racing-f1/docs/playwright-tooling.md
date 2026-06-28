# Playwright Tooling — Report Dashboard, Debug, Session Replay

The suite is configured (`playwright.config.js`) with `trace: 'on'`, `screenshot: 'on'`,
`video: 'on'`, and the **HTML reporter**, so every run produces a full dashboard with
replayable traces. All commands run from `racing-f1/`.

## 1. Report dashboard

The HTML reporter writes a self-contained dashboard to `playwright-report/`.

```bash
npm test                 # or: npm run test:analytics   (cross-stream + bridge, chromium)
npm run report           # opens the dashboard at http://localhost:9323
# or open playwright-report/index.html directly
```

The dashboard shows pass/fail per test and per project (chromium/firefox/webkit/mobile/tablet),
durations, and—attached to each test—its screenshot, video, and **trace**.

## 2. Debug

| Command | What it does |
|---|---|
| `npm run debug` | **Playwright Inspector** — step through actions, live-pick selectors (chromium) |
| `npm run ui` | **UI mode** — watch tests, time-travel each step, see DOM/network/console live |
| `npm run test:headed` | run with a visible browser |
| `npx playwright test <spec> -g "name" --debug` | debug a single test |
| `PWDEBUG=1 npx playwright test <spec>` | force Inspector (bash); PowerShell: `$env:PWDEBUG=1` |

To debug the analytics validator against local files:
```bash
# bash
BASE_URL=http://localhost:3000 npx playwright test tests/crossstream-analytics-validator.spec.js --project=chromium --debug
# PowerShell
$env:BASE_URL='http://localhost:3000'; npx playwright test tests/crossstream-analytics-validator.spec.js --project=chromium --debug
```

## 3. Previous-session replay (trace viewer)

`trace: 'on'` saves a `trace.zip` per test under `test-results/<test-dir>/`. The trace viewer
replays the **whole session**: every action with before/after DOM snapshots, network calls
(GA4 `/g/collect`, Adobe Edge), console, and the source line.

```bash
# replay a specific past run
npx playwright show-trace test-results/<test-folder>/trace.zip
# or simply:  npm run replay -- test-results/<test-folder>/trace.zip
```

You can also click the **trace icon** on any test row inside `npm run report` to replay it in
the browser — no path needed.

## Quick reference

| Need | Command |
|---|---|
| Run analytics validators | `npm run test:analytics` |
| Dashboard | `npm run report` |
| Debug (Inspector) | `npm run debug` |
| Debug (UI mode) | `npm run ui` |
| Replay a past session | `npm run replay -- test-results/<dir>/trace.zip` |
| Prod Tealium smoke | `npx playwright test tests/prod-tealium-check.spec.js --project=chromium` |
