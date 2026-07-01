# Manual Verification — Ask Real ChatGPT to Crawl, Detect in EventStream

This is the human playbook for the "real ChatGPT" test — no API keys required. Takes ~3 minutes.

## Prerequisite check (30 seconds)

Confirm the middleware is currently pointing at where you want to observe the hit:

```bash
curl -sI -A "GPTBot/1.2" https://racing-f1-rho.vercel.app/tickets | grep -Ei "^x-bot-track"
```

You should see something like:
```
X-Bot-Track-Sent: true
X-Bot-Track-Url: /api/bot-collect                # ← self-hosted receiver (default)
```
or
```
X-Bot-Track-Url: https://collect.tealiumiq.com/event   # ← Tealium
```

If the URL isn't the receiver you want to observe, flip it first:

```bash
# route to Tealium
cd racing-f1
vercel env rm TEALIUM_COLLECT_URL production
vercel env add TEALIUM_COLLECT_URL production
# value: https://collect.tealiumiq.com/event
vercel --prod --yes
```

## Step 1 — Open ChatGPT with web browsing

- Go to <https://chat.openai.com> (ChatGPT Plus / Team — free tier does not have browsing).
- New chat → model picker → **GPT-4o** (browsing is on by default).

## Step 2 — Give it this exact prompt

Copy-paste. Change nothing except the timestamp at the end (unique per test):

```
Please open the URL https://racing-f1-rho.vercel.app/tickets?src=chatgpt-verify-<TODAY_YYYYMMDD>
and tell me the page title and the first three ticket categories listed. Use your web browsing
tool — do not answer from memory.
```

ChatGPT will:
1. Fire a browse request → its browsing agent hits our URL with `ChatGPT-User/1.0` in the UA.
2. Our Edge middleware detects the UA (regex match), sets `X-Bot-*` response headers, and
   POSTs an `ai_crawler_visit` event to whatever `TEALIUM_COLLECT_URL` points at.
3. ChatGPT reads the HTML and answers you.

## Step 3 — Verify the hit landed (pick where you're looking)

### A. In Tealium EventStream Live Events

- <https://my.tealiumiq.com> → **EventStream** → **Live Events** (top nav).
- Filter: `tealium_event equals ai_crawler_visit`.
- You should see one event within ~5 seconds of ChatGPT's response, with:
  ```
  bot_name    : ChatGPT-User          (or OAI-SearchBot / GPTBot depending on the day)
  bot_vendor  : OpenAI
  bot_class   : agent
  page_url    : https://racing-f1-rho.vercel.app/tickets?src=chatgpt-verify-...
  ```

### B. In self-hosted receiver logs

```bash
cd racing-f1
vercel logs https://racing-f1-rho.vercel.app | grep bot-collect | tail -5
```
Expected line:
```
[bot-collect] {"received_at":"…","bot_name":"ChatGPT-User","bot_vendor":"OpenAI","bot_class":"agent","page_url":"https://racing-f1-rho.vercel.app/tickets?src=chatgpt-verify-…"}
```

## Step 4 — Also try Perplexity / Claude (bonus)

Same idea, different tools:

| Tool | UA you should see in the hit |
|---|---|
| ChatGPT (web browsing) | `ChatGPT-User` |
| ChatGPT Search / SearchGPT | `OAI-SearchBot` |
| perplexity.ai (with browsing on) | `Perplexity-User` or `PerplexityBot` |
| claude.ai (with web search on) | `anthropic-ai` or `ClaudeBot` |
| Google Gemini | `Google-Extended` (only if crawler indexing, not chat) |

## Troubleshooting

| You see… | Cause | Fix |
|---|---|---|
| ChatGPT says "I can't browse" | Free tier | Log in with ChatGPT Plus / use gpt-4o |
| ChatGPT browses but no hit lands anywhere | Middleware not firing POST | `curl -sI -A "GPTBot" <URL>` — check `x-bot-track-sent: true` |
| Hit lands in Vercel logs but nothing in Tealium | Pointing at `/api/bot-collect` still | Do Step 4 in the Tealium runbook to flip the env var |
| Hit in Tealium but shows up as "unknown source" | No data source key | Do Step 1 in `tealium-collect-tag-setup.md` (create HTTP API data source, wire `TEALIUM_DATA_SOURCE_KEY`) |
| ChatGPT visits but different UA than expected | OpenAI rotates between GPTBot / ChatGPT-User / OAI-SearchBot | All three are in the detection registry — should still match |

## Doing this in CI

`tests/chatgpt-crawler-scenario.spec.js` covers the automated equivalent:
- Tier 1 (always runs): simulates the exact UA + headers real ChatGPT sends.
- Tier 2 (opt-in via `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`): actually calls the model's browsing
  tool and drives a real hit. Then check Tealium Live Events / Vercel logs for the hit.
