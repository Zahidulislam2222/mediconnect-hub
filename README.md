# MediConnect Hub

React/TypeScript website and retained Android/iOS clients for MediConnect's patient, clinician, staff and administrator journeys.

**Website:** [mediconnect.zahidul-islam.com](https://mediconnect.zahidul-islam.com) · **Maintainer:** Zahidul Islam · **Support:** muhammadzahidulislam2222@gmail.com

## Current delivery — 2026-10-13

The public website and editorial/contact/legal routes are deployed. The reviewed public release passed 676 unit tests, 77 browser cases, explicit TypeScript checks, lint, configuration, build and security gates; 43 deployed files matched local hashes. Live external-request privacy acceptance remains open. Account, payment and clinical activation have separate provider, authorization and operational gates.

| Area | Source and acceptance |
|---|---|
| Public routes and articles | Public entry plus lazy application routes, preserved original articles and approved contact/legal content |
| Authenticated web application | Shared API/session/storage boundaries and role routes; complete live role/region/provider journeys remain open |
| Kotlin/Compose Android and Swift/SwiftUI iOS | Existing source and regional verification preserved; further native work follows non-mobile completion |
| Capacitor Android | Earlier implementation retained until replacement acceptance |

See the [release ledger](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/RELEASE-STATUS.md) for the exact scope and open phases.

## Local development

Use the package lockfile and supported Node toolchain. Copy `.env.example` to an ignored local environment file and populate approved public settings. Client variables are visible to users; never place server secrets in them.

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run verify:config
npm run test:e2e
npm run build
```

`typecheck` explicitly checks app, tooling, browser-test and connected-release projects. For the public deployment build, use `npm run build:public`; see [public release packaging](deploy/shared-vps/README.md). The connected build has its own [configuration and activation contract](deploy/connected/README.md).

Backend calls use `src/lib/api.ts`, SDK sessions use the maintained identity boundary, and profile data uses `src/lib/secure-storage.ts`. Preserve role/ownership/region checks and typed configuration. See [native clients](native/README.md) for retained mobile tooling and limitations.

## Platform documentation

- [Architecture](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/ARCHITECTURE.md), [setup/configuration](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/GETTING-STARTED.md), [API contracts](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/API-CONTRACTS.md)
- [Security](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/SECURITY-ARCHITECTURE.md), [privacy](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/PRIVACY-AND-DATA.md), [US/EU law](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/COMPLIANCE-AND-LAW.md), [AI governance](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/AI-GOVERNANCE.md)
- [Future 1M+ simultaneous-user scale](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/SCALABILITY.md), [uptime objectives and recovery](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/RELIABILITY.md), [operations](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/OPERATIONS.md)
- [Accessibility](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/ACCESSIBILITY.md), [roadmap](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/ROADMAP.md), [documentation index](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production/blob/main/docs/README.md)

Capacity and uptime figures are future acceptance objectives; publish achieved values only with measured evidence. Regulated service activation requires the applicable operator, agreements and clinical/privacy approvals.

## Contributing and license

[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Private vulnerability reporting](SECURITY.md) · [MIT license](LICENSE) · [Third-party notices](THIRD-PARTY-NOTICES.md)
