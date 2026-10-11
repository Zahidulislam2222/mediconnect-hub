# Connected release candidate

This compiler preserves the public entry, critical fallback and lazy application
routes while resolving the installed Stripe loader. The static release remains
available through `deploy/shared-vps/build-showcase.mjs`.

Run `npm run build:connected -- PUBLIC_CONFIG_JSON local-tests/NEW_RELEASE_NAME`.
The destination must be fresh and verified gitignored. The input is an object
containing only names owned by `src/config/env.ts`; use actual verified public
settings, never server credentials. The boundary rejects unrecognized names,
secret-like values, unsafe endpoints, inconsistent regional identifiers, invalid
timeouts and live/showcase payment keys. Optional absent Vite values are explicitly
cleared, and Vite environment-file discovery is disabled, so local `.env` files
cannot silently supplement the artifact.

The output contains a build status, public settings, compiled artifact hashes and
an explicit CSP derived from validated settings plus maintained provider policy.
An output directory is never silently replaced. Failed output remains available
for diagnosis; use a fresh destination after fixing the cause. The script does not
modify DNS, Caddy, containers, cloud resources or production content.

Before activation, verify each configured regional HTTP/CORS and WebSocket
endpoint, native per-session MFA, the deployed confirmation hook and backend
release prerequisites. A metadata-confirmed URL is not functional acceptance.
The actual CMS hostname must resolve and pass acceptance before enabling it.
Retain the previous static artifact and Caddy configuration for rollback. Apply
the reviewed generated policy only after those gates and any cost approval, then
verify complete active artifact parity and real browser flows.

The provider policy permits exact Stripe.js/API/3DS origins. Optional Link,
Address Element, Checkout and performance subdomain origins are not enabled by
this policy; add only a reviewed, tested integration requirement to the maintained
data. See [Stripe CSP requirements](https://docs.stripe.com/security/guide#content-security-policy).
This candidate does not establish live payment, identity, privacy or clinical readiness.
