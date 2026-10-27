# GitHub Copilot Independent RCCA Tracker

Standalone production-quality and corrective-action tracking application. The original React interface now talks to an Express API backed by PostgreSQL; application data, authentication, uploaded files, scheduled reminders, and AI requests are served by infrastructure you control.

## Features

- Production issues, production batches, documents, archives, visual inspections, daily standups, analytics, and page permissions
- PostgreSQL JSONB-backed entities with live updates over server-sent events
- Local email/password accounts, administrator-managed email invitations, and HTTP-only session cookies
- Local file storage with signed URLs for private files
- Configurable SMTP email and OpenAI-compatible AI providers, including per-model routing for the visual-inspection model chain
- Daily corrective-action and standup reminders, plus critical-issue email alerts
- Responsive React/Vite frontend with the existing screens and workflows

## Run locally

Requirements: Node.js 20+, npm, and PostgreSQL 14+.

1. Copy `.env.example` to `.env`. Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and a random `FILE_SIGNING_SECRET` (at least 32 characters).
2. Install packages with `npm ci`.
3. Start the API in one terminal with `npm run server:dev`.
4. Start the UI in another terminal with `npm run dev`, then open the Vite URL it prints.

The API creates the required database tables at startup and creates the first administrator only when `ADMIN_EMAIL` does not already exist. The bootstrap password is not reset on later restarts. The frontend proxies `/api` to the local API during development.

## Docker deployment

1. Copy `.env.example` to `.env` and set strong, unique values for `ADMIN_PASSWORD` and `FILE_SIGNING_SECRET`. Set `COOKIE_SECURE=true` when serving the application over HTTPS.
2. Start the application and PostgreSQL with `docker compose up --build -d`.
3. Keep PostgreSQL private. For intranet use, restrict inbound access to the application host and trusted network. For internet use, put the application behind a TLS-terminating reverse proxy, set `APP_BASE_URL` to its HTTPS URL, and enable `COOKIE_SECURE=true`.

The compose file persists PostgreSQL data and uploaded files in Docker volumes. Back up both volumes. Set `TRUST_PROXY=true` only when the application is behind a trusted reverse proxy.

## Email and AI configuration

Email invitations and reminders require `SMTP_URL` or `SMTP_HOST`, plus `SMTP_FROM` (or `SMTP_USER`). Set `DOWNTIME_ALERT_EMAIL` and `CRITICAL_ALERT_EMAIL` to configure the corresponding alert recipients. Without SMTP or recipient configuration, email operations return an explicit service error. `REMINDER_CRON` controls both daily reminder jobs; the default is 08:00 UTC. Set `TZ` to the desired IANA timezone.

AI features use an OpenAI-compatible `/v1/chat/completions` endpoint. Set `AI_BASE_URL`, `AI_MODEL`, and optionally `AI_API_KEY` for one model. For multi-model inspection workflows, configure `AI_MODELS_JSON` with logical model names such as `gemini_3_flash` and `claude_sonnet_4_6`; each entry can override `baseUrl`, `model`, and `apiKeyEnv`. Provider credentials remain on the server and are never exposed to the browser. The AI integration accepts images for visual inspection; CSV/XLSX imports are parsed locally, while PDF picklist extraction uses the configured AI provider.

## Moving data from the hosted application

The original records and picklist values lived in the hosted service and are not present in this source repository. Export the entity records and uploaded files before decommissioning that service. Import exported JSON entity data into PostgreSQL with the migration utility after configuring the database:

```powershell
npm run migrate:hosted-export -- C:\path\to\hosted-export.json
```

```json
{
  "ProductionIssue": [{ "id": "existing-id", "issue_number": "RCCA-001" }],
  "PicklistOption": [{ "id": "option-id", "category": "IssueType_Picklist", "label": "Example", "value": "Example" }]
}
```

The import utility preserves record IDs and fields. Existing user accounts need password setup; use the mail icon beside each imported user in Settings to send a new password-setup invitation. Picklist values are stored locally and must be included in the exported data. Uploaded media should be downloaded separately and re-uploaded through the app so private-file metadata and URLs are generated locally; the old hosted file URLs in records must be updated to their new local URLs. Do not copy hosted-service access tokens or passwords into the export.

## Scripts

- `npm run dev` — Vite frontend
- `npm run server:dev` — auto-restarting Express API
- `npm run build` — production frontend build
- `npm start` — production API and static frontend
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript project check
- `npm run test:server` — backend security/unit tests
