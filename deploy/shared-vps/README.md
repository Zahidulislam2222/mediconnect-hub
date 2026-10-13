# Public website release package

Updated 2026-10-13. The current public website is https://mediconnect.zahidul-islam.com. The reviewed release has 43 matching local/live artifact files. Editorial/contact/legal content is verified; external-request privacy acceptance remains open. Account, payment and clinical activation have separate gates.

This package serves the locally compiled frontend. It does not activate backend services or provision infrastructure. A static health result covers delivery only; verify each enabled journey separately.

## Build and local checks

From the frontend root:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run verify:config
npm run test:e2e
npm run build:public
```

The existing public builder uses maintained `build-env.json`, a dedicated public entry and an unavailable payment-loader boundary. It preserves normal application/provider builds and existing environment files. Public build settings are client-visible and cannot hold private encryption keys. Editorial settings must use the validated configuration and approved content origin for the intended release.

Copy this directory's `.env.example` to an ignored `.env`, verify the configured loopback host port is unused, and inspect `docker compose config --quiet`. Start only the approved owned project for local container/HTTP checks, verify its configured health route and content, then stop it without deleting volumes. Record the actual image, port, configuration and results; do not infer container behavior from a build alone.

## Release layout

```text
<release-id>/
└── mediconnect-hub/
    ├── dist/
    └── deploy/shared-vps/
        ├── .env
        ├── compose.yaml
        └── nginx.conf
```

The deployment environment contains only the package's documented non-secret service settings. Do not upload development environments or backend credentials. Preserve the configured existing project identity and exclusive release directory; do not start a duplicate stack.

## Activation and rollback

Capture live/local drift, listener/capacity and neighboring workload health before upload. Freeze the artifact manifest, preserve the prior release and validate the complete reverse-proxy policy before an approved reload. The Caddy file is a template, not authority to add DNS/cloud resources.

Deploy only the reviewed allowlisted package. Prove direct and HTTPS behavior, all touched-file hashes, active release identity, browser requests, original article content and sibling health. Keep privacy failures open until fresh network evidence passes. Roll back to the previous verified artifact only after checking configuration compatibility and verifying the resulting live flow.
