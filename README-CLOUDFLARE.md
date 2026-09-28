# KeyCRM Telegram Assistant v3 — Cloudflare Worker

Reusable Telegram reporting assistant for KeyCRM.

## Features

- Telegram webhook (no polling server required)
- KeyCRM order reports by period
- Full API pagination
- Revenue via `grand_total`
- Average order value
- Order status breakdown
- Client-specific configuration via Cloudflare variables/secrets
- `/start`, `/report`, `/getreport`
- `/health` endpoint

## Required secrets

Configure these in Cloudflare Worker settings (do not commit them):

- `TELEGRAM_BOT_TOKEN`
- `KEYCRM_API_TOKEN`
- `WEBHOOK_SECRET`

## Variables

Configured in `wrangler.jsonc` and can be overridden per client:

- `TIMEZONE` (default `Europe/Kyiv`)
- `CURRENCY` (default `UAH`)
- `COMPANY_NAME`

## Deploy

1. Connect this GitHub repository/branch to Cloudflare Workers Builds, or run `npm install` then `npm run deploy`.
2. Add the three secrets in Cloudflare.
3. Note the Worker URL, e.g. `https://keycrm-telegram-assistant.<account>.workers.dev`.
4. Register Telegram webhook to `<WORKER_URL>/webhook` and pass the same `WEBHOOK_SECRET` as Telegram's `secret_token`.
5. Open `<WORKER_URL>/health` to verify deployment.
6. Send `/start` to the bot.

## Productization

For each customer, reuse the same code and configure a separate Worker deployment with its own Telegram token, KeyCRM token, company name, timezone and currency. Never store customer credentials in Git.

## Security

Credentials that were previously committed to the repository must be revoked/rotated. Removing them from current files does not make previously committed credentials safe because Git history may still contain them.

## Legacy

The root-level Apps Script files are the previous v2 implementation. The Cloudflare v3 implementation lives under `src/` and does not depend on Google Apps Script.
