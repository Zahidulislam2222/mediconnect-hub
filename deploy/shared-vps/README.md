# Shared-VPS static showcase package

Published 2026-09-09: https://mediconnect.zahidul-islam.com — static UI showcase, with backend
operations unavailable. Public HTTPS and browser smoke checks passed; release files matched local
hashes. The broader application is not certified or claimed operational from this static release.

This package serves the already compiled MediConnect frontend. It does not start the backend,
Kubernetes, Terraform, a database, a secret store, or any cloud deployment.

The frontend can still contain URLs for intentionally retired cloud integrations. A successful
static health check proves only that the compiled site is being served; it does not prove login,
clinical, AI, payment, database, upload, WebSocket or regional-failover behavior.

The approved hostname is `mediconnect.zahidul-islam.com`. Its Caddy configuration restricts browser
connections and form submissions to the same origin and disables embedded frames, so this release
does not activate external login, payment or backend integrations. Build it with
`node deploy/shared-vps/build-showcase.mjs`: the public `build-env.json` supplies unmistakably fake
storage/payment values without changing existing development or production environment files.
Client-side encryption with a key shipped in JavaScript is not protection for real patient data.
The showcase Vite configuration keeps asset URLs root-relative and substitutes a payment loader
that resolves to `null`, the supported unavailable state for React Stripe Elements. The normal
application build keeps its real Stripe integration.

## Frontend craft revision

The public homepage uses `src/pages/Showcase.tsx`: a responsive care-journey illustration with
three stage controls, three role perspectives, a local follow-up preview and an honest status FAQ.
All names and records are fictional; no action creates a real booking or sends clinical data.
Copy and example records belong to `src/content/showcase.json`, validated by `showcase.ts`.
Design rationale and scoped semantic-token styling live in `src/styles/showcase.css`.

The showcase build starts at `src/showcase-main.tsx`, without loading the cloud application on the
homepage. Original routes lazy-load the retained app; its home route points to the same showcase.
The previous landing source remains in `src/pages/Index.tsx`. No backend or infrastructure
implementation was removed. Original HTML/CSS interface illustrations and existing Lucide icons
are used; no third-party photography, paid generation, video, fonts or new packages are needed.
The HTML includes a readable fallback when JavaScript is unavailable.

## Local verification

1. Build the frontend from the repository root with the intended non-secret public Vite settings:
   `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, then
   `node deploy/shared-vps/build-showcase.mjs`. Do not substitute the normal application build
   when publishing this inactive-backend showcase.
2. Copy `.env.example` to `.env` in this directory and recheck that the selected port is unused.
3. Run `docker compose config --quiet`, then `docker compose up -d --wait`.
4. Request `http://127.0.0.1:18082/healthz` and `/`; verify the marker and expected HTML.
5. Run `docker compose down` without `-v`. This package has no application data volume.

Local Docker validation is mandatory before upload. Do not substitute a successful frontend build
for the container/HTTP test.

## Release layout

Upload a versioned release that preserves these relative paths:

```text
<release-id>/
└── mediconnect-hub/
    ├── dist/
    └── deploy/shared-vps/
        ├── .env
        ├── compose.yaml
        └── nginx.conf
```

The `.env` file contains only the loopback host port; never upload frontend source environment
files or backend credentials. Use Compose project name `mediconnect-showcase`.

## Live deployment gate

Before upload, repeat the read-only VPS listener/capacity inventory and compare any existing
MediConnect release with local source. Keep the previous verified release for rollback.

The Caddy file is only a template. Do not create a Caddy site or DNS record until the hostname is
explicitly approved. Validate the complete Caddy configuration before reload, then prove direct
origin and proxied HTTPS behavior. The shared infrastructure handoff remains read-only for this
task, so the project dossier carries the candidate port until the owner chooses another recording
location.
