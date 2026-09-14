# Appointment continuity — frontend concept

Derived from the private project dossier, 9 September 2026. This is a local portfolio demonstration,
not an operating healthcare service. The previous application and architectural prototype are retained.

## Design rationale

One fictional appointment travels through patient, clinician and coordination perspectives.
The appointment strip remains a stable visual anchor while opaque interface surfaces move beneath
it using CSS perspective. Native scrolling owns one Motion timeline; a paused consultation film
uses that same progress value. This is planar interface depth, not a Blender or WebGL environment.

The existing navy/blue tokens are retained. Large editorial type and generated human portraits
give the introduction a different density from the useful role workspaces. Accurate text and
controls remain DOM elements, never labels baked into generated film. Mobile, short screens and
reduced-motion preferences receive a directly navigable reading layout instead of a pinned scene.

## Behavior and boundaries

- Patient: change the fictional time and inspect a consultation/follow-up illustration.
- Clinician: view the corresponding queue and context, with the patient as the remote participant.
- Staff: coordinate readiness without a clinical-note or follow-up-record panel.
- Role switches and browser history retain shared in-memory state; Reset/reload restore the seed.
- Scrolling cannot book a visit, complete a consultation or issue a clinical record.
- Login, registration and password-reset designs validate sample inputs, disclose offline status
  before entry and clear submitted fields. They send and store nothing.
- Original backend/auth/cloud showcase source is outside this isolated preview and remains preserved.

## Media provenance

Both human subjects are fictional, generated specifically for the project through an approved
OpenRouter Veo 3.1 batch. No third-party website imagery was copied. Generated imagery is illustrative,
not evidence of actual medical services. Original files, generation settings and charge records are
retained privately. No exclusivity, identity-authenticity or legal-rights guarantee is claimed.

| Asset | Use | Web dimensions | Bytes |
|---|---|---|---:|
| clinician-v1.webp | First-frame poster and clinician crops | 1280×720 | 51,040 |
| clinician-v1.mp4 | Hero, patient consultation, scroll chapter | 1280×720, 8s, silent | 1,663,449 |
| patient-v2.webp | Fictional patient poster | 1280×694 | 72,500 |
| patient-v2.mp4 | Clinician-side consultation | 1280×694, 8s, silent | 2,060,239 |

Patient v2 crops an unwanted generated bottom-edge label. The original and v1 remain retained.
Films use H.264/yuv420p, short GOP and faststart; fallback posters remain available. Only the
relevant role film loads, and reduced-motion mode omits film. Offscreen/hidden hero playback stops.

## Local commands

From the frontend repository:

```bash
npm run dev:continuity
npm run typecheck:continuity
npm run build:continuity
npm run preview:continuity
```

Local preview settings have one project-owned configuration source. The entry, output and Vite
dependency cache are separate from the original app. These commands do not deploy anything.

## Verification and status

62 unit tests, 10 original E2E tests, strict preview types and both builds pass. The dedicated
browser suite exercises nine flow groups; twelve automated accessibility scans report zero
violations. New-source security scans pass. Full-project historical type and dependency issues
remain separate open work; this is not a production-ready claim.

Independent review found and prompted fixes for overlapping transition text, hidden content,
caption spacing, short-screen behavior and role presentation. Final verdict: suitable for local
owner review, not a claim of outstanding design or owner approval. Sampled Chromium checks do
not establish real-device performance or complete accessibility compliance. No deployment authorized.
