# Care pavilion — local design review

This is an original illustrative environment, not a real clinic or a functioning medical service.
The existing application, auth implementation and published showcase remain preserved.

## Preview

From the frontend repository:

```sh
npm run dev:cinematic
npm run typecheck:cinematic
npm run build:cinematic
```

The preview uses the project-local preview port configured in the private release settings.
It binds to loopback and builds to the separate ignored `dist-cinematic/` directory.
Routes: `/`, `/auth` and `/admin-auth`. Forms validate locally and do not submit or store credentials.
The regular `npm run dev` and production entry remain the previous application.

Do not deploy this revision until the owner explicitly approves its visual result.

## Sources and provenance

- `build_scene.py` + `scene.json`: original procedural Blender artwork; no imported third-party models.
- Editable `.blend` and original render: project-private `memory/cinematic-assets/`.
- `public/media/cinematic/care-world-v1.glb`: exported geometry for genuine browser 3D.
- `care-world-v1.webp`: Blender still fallback for mobile, reduced motion or unavailable WebGL.
- `care-atmosphere-v1.webp`: built-in AI image tool treatment of the original Blender render;
  prompt direction in `hero-prompt.md`; original retained in project-private asset storage.
- AI-generated geometry/materials are illustrative and differ from the authored GLB. Do not imply
  the high-detail still is the real-time renderer's output.
- No OpenRouter video has been generated. The media manifest deliberately has `video: null`.

The hero's image moves slightly with scroll; the pavilion section changes an actual 3D camera.
There is no autoplay or idle render loop. The model can be rotated with an accessible range control.
Mobile and reduced motion use a still view with direct stage controls, not a long pinned sequence.

## Maintained boundaries

Copy, media paths, camera keypoints, rendering budget and light palette belong to the validated
`src/content/cinematic.json` boundary. Render output settings belong to `scene.json`.
The original source render/GLB do not contain patient information, provider keys or live endpoints.
Do not place an OpenRouter key in a public Vite variable or the browser.

## Verification limitations

The isolated preview has a strict TypeScript configuration; the full historical app has separate
type errors and dependency-audit findings, recorded privately. Browser emulation does not replace
real-device, screen-reader, independent review or owner visual acceptance. This is not a declaration
of production readiness or permission to activate the retained backend/cloud integrations.
