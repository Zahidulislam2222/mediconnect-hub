# MediConnect — Patient & Provider Portal

<div align="center">

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?logo=capacitor&logoColor=white)
![HIPAA](https://img.shields.io/badge/HIPAA-Compliant-22C55E)
![GDPR](https://img.shields.io/badge/GDPR-Compliant-3B82F6)

**Production-grade telemedicine frontend with multi-region support, encrypted storage, and mobile-first design.**

[Live Demo](https://askme-82f72.web.app) · [Backend Repo](https://github.com/Zahidulislam2222/mediconnect-infrastructure-production) · [Author](https://zahidul-islam.vercel.app)

</div>

---

## Overview

MediConnect Hub is the React frontend for the MediConnect telemedicine platform. It serves four user roles — **patients**, **doctors**, **admins**, and **staff** — each with dedicated dashboards, workflows, and route-level access control.

The application connects to 7 backend microservices via an intelligent API layer that handles multi-region routing, primary-to-backup failover, and automatic auth token injection.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18, TypeScript, Vite 5 (SWC compiler) |
| Styling | Tailwind CSS 3, shadcn/ui (Radix), Framer Motion |
| Auth | AWS Amplify (Cognito), role-based guards |
| Payments | Stripe Elements, server-confirmed PaymentIntents |
| Video | Amazon Chime SDK (WebRTC) |
| Messaging | Socket.io (real-time chat) |
| Charts | Recharts |
| Mobile | Capacitor (Android/iOS), push notifications |
| Hosting | Firebase Hosting (web), Capacitor (native) |
| Data | TanStack React Query, React Hook Form + Zod |

---

## Architecture

### Multi-Service API Routing (`src/lib/api.ts`)

All backend calls go through a unified API client that routes requests by URL prefix:

```
/patients, /vitals, /public  →  Patient Service (8081)
/doctors, /prescriptions      →  Doctor Service (8082)
/appointments, /billing       →  Booking Service (8083)
/chat, /video, /ai            →  Communication Service (8084)
/api/v1/admin                 →  Admin Service (8085)
/shifts, /tasks               →  Staff Service (8086)
```

Every request includes a Cognito Bearer token and `x-user-region` header. On 5xx or timeout (5s), the client automatically retries against the backup URL.

### Security

| Guard | Purpose |
|-------|---------|
| **ProtectedRoute** | Redirects unauthenticated users to `/auth` |
| **RoleGuard** | Prevents cross-role access (patient can't reach admin routes) |
| **HipaaGuard** | 15-minute inactivity auto-logout, 12px blur on tab switch |
| **GdprBanner** | Granular cookie consent (essential/functional/analytics) |
| **Encrypted Storage** | AES-GCM 256-bit via Web Crypto API — no raw JWT tokens stored |

### Multi-Region

- US patients route to `us-east-1`, EU patients to `eu-central-1`
- Knowledge Base aggregates articles from **both** regions globally
- Region stored in `localStorage.userRegion`, sent as `x-user-region` header

---

## Role-Based Dashboards

### Patient
Appointments, video consultations, symptom checker (AI), health records, pharmacy (with barcode scanner), billing & payments, messaging, settings.

### Doctor
Patient queue, live monitoring (IoT vitals), patient records (EHR), prescriptions, analytics, knowledge base publishing, messaging, schedule management.

### Admin
User management, HIPAA audit log viewer, system health monitoring, platform analytics.

### Staff
Shift scheduling, task management, staff directory, announcements.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Development

```bash
npm install
npm run dev          # Starts on http://localhost:8080
```

### Build

```bash
npm run build        # Production build → dist/
npm run preview      # Preview built output
```

### Mobile (Android)

```bash
npm run build
npx cap sync
npx cap open android
```

### Type Check

```bash
npx tsc --noEmit
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

# Service URLs (primary + backup, US + EU)
VITE_PATIENT_SERVICE_URL_US=
VITE_PATIENT_SERVICE_URL_EU=
VITE_PATIENT_SERVICE_URL_US_BACKUP=
VITE_PATIENT_SERVICE_URL_EU_BACKUP=
# ... same pattern for DOCTOR, BOOKING, COMMUNICATION, ADMIN, STAFF

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=

# Encryption
VITE_STORAGE_CIPHER_KEY=
```

---

## Deployment

**Web:** Firebase Hosting (`firebase deploy`). SPA rewrite to `/index.html`.

**Mobile:** Capacitor builds. Android scheme: HTTPS. Push notifications via FCM.

---

## Design System

| Element | Choice |
|---------|--------|
| Display font | Sora (headings) |
| Body font | DM Sans |
| Primary color | Deep teal (`hsl(166, 72%, 29%)`) |
| Accent color | Coral rose (`hsl(347, 77%, 50%)`) |
| Background | Warm stone (`hsl(40, 20%, 98%)`) |
| Border radius | `rounded-2xl` (cards), `rounded-xl` (buttons) |
| Shadows | `shadow-card`, `shadow-elevated`, `shadow-soft` |

---

## Author

**Zahidul Islam** — Hybrid Cloud Architect & Full Stack Engineer

[Portfolio](https://zahidul-islam.vercel.app) · [GitHub](https://github.com/Zahidulislam2222) · [Email](mailto:muhammadzahidulislam2222@gmail.com)

---

<div align="center">

*Built with precision. Secured by design. Compliant by default.*

</div>
