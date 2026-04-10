# MediConnect Hub — Patient & Provider Portal

<div align="center">

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?logo=capacitor&logoColor=white)
![HIPAA](https://img.shields.io/badge/HIPAA-Compliant-22C55E)
![GDPR](https://img.shields.io/badge/GDPR-Compliant-3B82F6)
![FHIR](https://img.shields.io/badge/FHIR_R4-Compliant-8B5CF6)
![SMART](https://img.shields.io/badge/SMART_on_FHIR-2.0-06B6D4)
![Stripe](https://img.shields.io/badge/Stripe-Subscriptions-635BFF?logo=stripe&logoColor=white)
![AI](https://img.shields.io/badge/AI_Chatbot-LightRAG-FF6B35)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

**Production-grade telemedicine frontend with multi-region data residency, AES-256 encrypted storage, HIPAA session management, AI chatbot, subscription billing, and cross-platform mobile support.**

[Live Demo](https://askme-82f72.web.app) · [Backend Repo](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production) · [Author](https://zahidul-islam.vercel.app)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Clinical Features by Role](#clinical-features-by-role)
- [Architecture](#architecture)
- [Security & Compliance](#security--compliance)
- [Tech Stack](#tech-stack)
- [Design System](#design-system)
- [CI/CD Pipeline](#cicd-pipeline)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Author](#author)

---

## Overview

MediConnect Hub is the React frontend for the MediConnect enterprise telemedicine platform. It serves four user roles — **patients**, **doctors**, **admins**, and **staff** — each with dedicated dashboards, clinical workflows, and route-level access control enforced at both the frontend and API layer.

The application connects to **7 backend microservices** via an intelligent API client that handles multi-region routing (US/EU), primary-to-backup failover with 5-second timeout, and automatic Cognito token injection on every request.

### Key Technical Highlights

| Feature | Implementation |
|---------|---------------|
| **Zero Raw Token Storage** | AES-GCM 256-bit encryption via Web Crypto API — no JWT tokens in localStorage |
| **HIPAA Session Management** | 15-minute inactivity auto-logout + 12px Gaussian blur on tab switch |
| **GDPR Consent** | Granular cookie consent (essential/functional/analytics) with timestamp tracking |
| **Multi-Region Routing** | `x-user-region` header routes US→`us-east-1`, EU→`eu-central-1` automatically |
| **Automatic Failover** | Primary→backup URL failover on 5xx or 5s timeout (15s for Cloud Run cold start) |
| **Cross-Platform** | Single codebase → Web (Firebase), Android/iOS (Capacitor), PWA-ready |
| **Role-Based Access** | 4 role zones with route guards, enforced at both frontend and backend |
| **AI Chatbot** | Floating chat bubble on all pages, LightRAG knowledge graph, rate limits per tier, EU AI Act transparent |
| **Subscription Plans** | 3-tier Discount Pass (Free/Plus/Premium), Stripe Elements checkout, GDPR consent |
| **Doctor Earnings** | Tier-based revenue splits (80/85/88%), rate management, payout history |
| **CI/CD Pipeline** | 5-stage GitHub Actions: quality gate, security scan, build, Firebase deploy, Lighthouse audit |
| **Scroll Animations** | 9 Framer Motion effects: parallax, counting numbers, SVG heartbeat draw, horizontal scroll |

---

## Clinical Features by Role

### Patient Portal

| Feature | Description |
|---------|-------------|
| **Video Consultations** | Amazon Chime SDK WebRTC with real-time audio/video and media recording |
| **AI Symptom Checker** | Claude 3-powered clinical NLP with PII scrubbing (demo-mode gated) |
| **Health Records** | FHIR-compliant allergies, immunizations, care plans, vitals history |
| **Pharmacy** | E-prescription viewer, barcode scanner (Capacitor camera), refill requests, QR fulfillment |
| **Billing & Payments** | Stripe Elements integration with server-confirmed PaymentIntents |
| **Messaging** | Real-time Socket.io chat with read receipts |
| **Blue Button 2.0** | CMS-compliant personal health data export |
| **GDPR Controls** | View/export personal data (Art 15), request erasure (Art 17), manage consent |
| **IoT Vitals** | Real-time wearable vitals display (heart rate, SpO2, blood pressure) |

### Doctor Portal

| Feature | Description |
|---------|-------------|
| **Patient Queue** | Real-time patient waiting list with priority indicators |
| **EHR Integration** | ICD-10/ICD-11 diagnosis coding, SNOMED CT clinical terms, LOINC lab codes |
| **e-Prescriptions** | RxNorm drug search, real-time interaction checking, DEA schedule validation |
| **Live Monitoring** | IoT vital signs dashboard with critical alert notifications |
| **Analytics** | Revenue, appointment trends, patient demographics via BigQuery |
| **Knowledge Base** | Publish/manage medical articles visible to patients globally |
| **Messaging** | Secure provider-to-patient and provider-to-provider communication |
| **Clinical Decision Support** | CDS Hooks alerts for drug interactions, recommended screenings |

### Admin Portal

| Feature | Description |
|---------|-------------|
| **User Management** | Create, edit, deactivate, delete users across all roles |
| **HIPAA Audit Logs** | Searchable audit trail viewer with FHIR AuditEvent format |
| **System Health** | Service status monitoring, DynamoDB table metrics |
| **Platform Analytics** | User growth, appointment volume, revenue dashboards |

### Staff Portal

| Feature | Description |
|---------|-------------|
| **Shift Scheduling** | Weekly/monthly shift management with conflict detection |
| **Task Management** | Task assignment, status tracking, priority levels |
| **Staff Directory** | Searchable directory with role filtering |
| **Announcements** | Organization-wide communication board |

---

## Architecture

### Multi-Service API Routing

All backend calls go through a unified API client (`src/lib/api.ts`) that routes by URL prefix:

```
/patients, /vitals, /public, /me       →  Patient Service   (8081)
/doctors, /ehr, /prescriptions          →  Doctor Service    (8082)
/appointments, /billing, /analytics     →  Booking Service   (8083)
/chat, /video, /ai                      →  Communication Svc (8084)
/api/v1/admin                           →  Admin Service     (8085)
/shifts, /tasks, /announcements         →  Staff Service     (8086)
```

**Automatic behaviors on every request:**
- Injects `Authorization: Bearer <Cognito ID token>` header
- Injects `x-user-region` header for multi-region routing
- 5s timeout on primary URL, auto-retries on backup (15s for cold start tolerance)
- 5xx responses trigger automatic failover to backup URL
- `/ai` and `/upload-scan` routes get 30s timeout for AI processing

### Security Guard Stack

Applied in order around all protected routes:

```
<ProtectedRoute>           ← Redirect to /auth if not authenticated
  <CheckoutProvider>       ← Stripe Elements context
    <HipaaGuard>           ← 15-min inactivity logout + tab blur
      <RoleGuard>          ← Route-level role enforcement
        <Page />           ← Actual page component
      </RoleGuard>
    </HipaaGuard>
  </CheckoutProvider>
</ProtectedRoute>
```

### Multi-Region Data Flow

```
User Login → Select Region (US/EU)
     ↓
Region stored in localStorage.userRegion
     ↓
api.ts reads region → selects US or EU service URLs
     ↓
x-user-region header → backend routes to regional DynamoDB/S3/KMS
     ↓
US patients → us-east-1 resources
EU patients → eu-central-1 resources (GDPR Art 44-49 compliant)
```

### Knowledge Base Cross-Region Aggregation

Medical articles published by doctors are stored in **region-specific** DynamoDB tables. The Knowledge Base aggregates globally:
- `fetchGlobalKnowledgeBase()` queries **both** US and EU endpoints in parallel
- Results are merged and deduplicated by article ID
- Individual articles use `fetchArticleCrossRegion(slug)` — tries user's region first, falls back to the other

---

## Security & Compliance

### HIPAA Controls (Frontend)

| Control | Implementation |
|---------|---------------|
| **Session Timeout** | `HipaaGuard` — 15-minute inactivity auto-logout via event listeners (mouse, keyboard, touch, scroll) |
| **Tab Blur** | 12px Gaussian blur applied on `visibilitychange` event — prevents shoulder surfing |
| **Encrypted Storage** | AES-GCM 256-bit via Web Crypto API — `secure-storage.ts` with `_mc_auth` and `_mc_user` keys |
| **Zero Raw Tokens** | JWT tokens never stored — always fetched fresh from `fetchAuthSession()` |
| **Secure Logout** | `signOut()` (Amplify) + `clearAllSensitive()` — wipes auth + user data, preserves GDPR consent |
| **Role Guards** | Frontend route guards + backend RBAC — defense in depth |

### GDPR Controls (Frontend)

| Article | Control | Implementation |
|---------|---------|---------------|
| Art 7 | Cookie Consent | `GdprBanner` — granular toggles for essential/functional/analytics with timestamps |
| Art 15 | Right to Access | Patient settings page with data export functionality |
| Art 17 | Right to Erasure | Account deletion with confirmation flow |
| Art 25 | Privacy by Design | AES-GCM encrypted storage, no PII in URLs or query params |
| — | Consent Persistence | `gdpr_consent` survives `clearAllSensitive()` — consent preference is retained |
| — | Push Notification Consent | Capacitor push notifications blocked without GDPR functional consent |

### Accessibility (EAA / WCAG 2.2)

| Control | Implementation |
|---------|---------------|
| **Reduced Motion** | `@media (prefers-reduced-motion: reduce)` disables all animations globally |
| **Keyboard Navigation** | Radix UI primitives (shadcn/ui) provide full keyboard support |
| **Semantic HTML** | Proper heading hierarchy, ARIA labels, focus management |

### Storage Security

```
┌─────────────────────────────────────────────────┐
│ Web Crypto API (AES-GCM 256-bit)                │
├─────────────────────────────────────────────────┤
│ _mc_auth  → boolean flag (encrypted)            │
│ _mc_user  → { name, avatar, role, id }          │
│            encrypted with "aes:" prefix         │
├─────────────────────────────────────────────────┤
│ Auto-migration: plaintext → enc: (XOR) → aes:  │
│ Older formats upgraded on read transparently    │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18, TypeScript 5.8, Vite 5 (SWC compiler) |
| **Styling** | Tailwind CSS 3.4, shadcn/ui (Radix primitives), Framer Motion |
| **State** | TanStack React Query (server state), React Hook Form + Zod (forms) |
| **Auth** | AWS Amplify v6 (Cognito), role-based guards, encrypted session storage |
| **Payments** | Stripe Elements, server-confirmed PaymentIntents |
| **Video** | Amazon Chime SDK (WebRTC, media pipelines) |
| **Messaging** | Socket.io (real-time bidirectional) |
| **Charts** | Recharts (responsive, composable) |
| **Mobile** | Capacitor 8 (Android/iOS), push notifications, camera access |
| **Hosting** | Firebase Hosting (web), Capacitor (native app stores) |
| **CI/CD** | GitHub Actions (5-stage pipeline), Firebase deploy |

---

## Design System

### Typography & Colors

| Element | Value |
|---------|-------|
| Display font | **Sora** (headings, `font-display` class) |
| Body font | **Inter** (`font-sans` class) |
| Primary | Deep navy `hsl(222, 47%, 11%)` |
| Accent | Blue `hsl(221, 83%, 53%)` |
| Background | Light gray `hsl(210, 20%, 98%)` |
| Dark mode BG | Near-black `hsl(240, 10%, 4%)` |

### Logo

**HeartPulse** icon from lucide-react, rendered in a `bg-foreground text-background rounded-lg` container. Used consistently across header, sidebar, dashboard layout, and footer.

### Component Conventions

| Pattern | Usage |
|---------|-------|
| `rounded-xl` | Cards, buttons, inputs, badges |
| `shadow-soft` / `shadow-card` / `shadow-elevated` | Elevation hierarchy |
| `bg-accent text-accent-foreground` | Primary CTA buttons |
| `bg-foreground text-background` | Dark sections, banners, secondary CTAs |
| `bg-background` / `text-foreground` / `bg-card` | Design tokens (avoid hardcoded colors) |
| `backdrop-blur-md bg-background/50` | Glass header effect |

### Landing Page Animations (Framer Motion)

| Effect | Technique |
|--------|-----------|
| Hero blur-in entrance | Staggered opacity + blur + translateY |
| Hero parallax | `useScroll` + `useTransform` — text moves faster than mockup |
| Platform mockup assembly | Browser-chrome dashboard assembles piece by piece with staggered variants |
| SVG heartbeat line draw | `pathLength` linked to scroll position via `useSpring` |
| Counting numbers | Spring-physics counter (0→50K+) with clean final display snap |
| Horizontal scroll features | Feature cards slide left via scroll-linked `useTransform` |
| Word-by-word text reveal | Each word opacity tied to scroll progress |
| Trust cards pop-in | Scale 0.8→1 with rotation -5°→0° on viewport entry |
| CTA entrance | `whileInView` fade-up animation |

All animations respect `@media (prefers-reduced-motion: reduce)`.

### Responsive Patterns

| Pattern | Purpose |
|---------|---------|
| `flex flex-col sm:flex-row` | Cards stack on mobile, row on desktop |
| `min-w-0` + `truncate` | Prevent text overflow in flex containers |
| `flex-1 sm:flex-none` | Full-width buttons on mobile, auto on desktop |
| `flex-shrink-0` + `whitespace-nowrap` | Fixed-width elements in flex layouts |

---

## CI/CD Pipeline

### `.github/workflows/frontend-deploy.yml`

5-stage pipeline triggered on push to `main` or PR when source files change. Mirrors the backend pipeline pattern.

```
Push to main
     │
┌────▼──────────┐
│ Quality Gate  │  TypeScript + ESLint + 43 tests + npm audit + build
│               │  Blocks everything if fails
└────┬──────────┘
     │
┌────▼──────────┐
│ Security Scan │  Leaked secrets in dist/ + bundle size check
│               │  Blocks deploy if secrets found
└────┬──────────┘
     │
┌────▼──────────┐
│ Build         │  vite build → upload dist/ artifact
└────┬──────────┘
     │
┌────▼──────────────────┐
│ Deploy                │
│  PR → Preview channel │  (7-day temp URL posted to PR)
│  main → Firebase live │  (production deploy + health check)
└────┬──────────────────┘
     │
┌────▼──────────┐
│ Lighthouse CI │  Performance + accessibility audit (non-blocking)
└───────────────┘
```

**Required secret:** `FIREBASE_SERVICE_ACCOUNT`

---

## Getting Started

### Prerequisites

- Node.js 18+ (via nvm)
- npm 9+

### Development

```bash
npm install
npm run dev              # Starts on http://localhost:8080
```

### Build

```bash
npm run build            # Production build → dist/
npm run preview          # Preview built output
```

### Type Check

```bash
npx tsc --noEmit         # TypeScript validation without emit
```

### Testing

```bash
npm run test             # Vitest unit tests (43 assertions)
npm run test:watch       # Watch mode
npm run test:e2e         # Playwright E2E tests (requires dev server)
```

### Lint

```bash
npm run lint             # ESLint
```

### Mobile (Android)

```bash
npm run build
npx cap sync
npx cap open android     # Opens in Android Studio
```

---

## Environment Variables

All prefixed with `VITE_`. Create a `.env` file:

```env
# Cognito (US + EU)
VITE_COGNITO_USER_POOL_ID_US=
VITE_COGNITO_USER_POOL_ID_EU=
VITE_COGNITO_CLIENT_PATIENT_US=
VITE_COGNITO_CLIENT_PATIENT_EU=
VITE_COGNITO_CLIENT_DOCTOR_US=
VITE_COGNITO_CLIENT_DOCTOR_EU=
VITE_COGNITO_IDENTITY_POOL_ID_US=
VITE_COGNITO_IDENTITY_POOL_ID_EU=

# Service URLs (primary + backup, US + EU)
VITE_PATIENT_SERVICE_URL_US=
VITE_PATIENT_SERVICE_URL_EU=
VITE_PATIENT_SERVICE_URL_US_BACKUP=
VITE_PATIENT_SERVICE_URL_EU_BACKUP=
# ... same pattern for DOCTOR, BOOKING, COMMUNICATION, ADMIN, STAFF

# S3 Buckets
VITE_S3_PATIENT_DATA_BUCKET_US=
VITE_S3_PATIENT_DATA_BUCKET_EU=
VITE_S3_DOCTOR_DATA_BUCKET_US=
VITE_S3_DOCTOR_DATA_BUCKET_EU=

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=

# Encryption (AES-GCM key for secure-storage)
VITE_STORAGE_CIPHER_KEY=
```

---

## Deployment

### Web — Firebase Hosting (Automated via CI/CD)

Every push to `main` triggers the CI/CD pipeline which builds and deploys automatically. Manual deploy:

```bash
npm run build
firebase deploy          # SPA rewrite to /index.html
```

### Mobile — Capacitor

```bash
npm run build
npx cap sync
npx cap open android     # Android Studio
npx cap open ios         # Xcode (macOS only)
```

**Capacitor Config:**
- App ID: `com.mediconnect.app`
- Web Dir: `dist`
- Android Scheme: HTTPS
- Push Notifications: FCM (requires GDPR functional consent)

---

## Author

**Zahidul Islam** — Hybrid Cloud Architect · Full Stack Engineer · HealthTech Specialist

[Portfolio](https://zahidul-islam.vercel.app) · [GitHub](https://github.com/Zahidulislam2222) · [Email](mailto:muhammadzahidulislam2222@gmail.com)

---

<div align="center">

**MediConnect Hub** — Enterprise-grade healthcare frontend.
Built with precision. Secured by design. Compliant by default.

*© 2026 Zahidul Islam. All rights reserved.*

</div>
