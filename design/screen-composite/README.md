# Blender screen-compositing study

This is a separate local comparison of the accepted connected-care film. The original film and
homepage remain unchanged. No additional AI footage, image generation or paid service was used.

## What Blender actually does

The Blender compositor reads the existing film, perspective-warps a transparent MediConnect
interface onto the wall display, softens that overlay and composites it over the footage.
The original moving clinician remains visible between a restrained brand header and call controls.
The laptop and surrounding room are not replaced. This is **manual planar corner tracking**, not
a reconstructed 3D room, recovered camera path or automatic conversion of the people into 3D.

The editable `.blend` includes the Movie Clip, packed interface image, animated Corner Pin,
overlay-only Blur and Alpha Over nodes. `composite.json` owns the source hash, corner observations,
render parameters, graphic treatment and artifact locations. The original film is hash-checked
before rendering, and the full render writes a per-frame/configuration manifest.

The interface is code-native DOM, rasterized with the existing MediConnect brand/theme. Its dark
tones are lifted and text softened to fit the photographed screen; fully opaque bars cover the
old generated glyphs. It is a designed derivative, not a recording of a working consultation.

## Local workflow

1. Start the existing built journey preview, then run the project-local interface capture tool.
2. From the frontend repository, run:

```sh
blender --background --python-exit-code 1 --python design/screen-composite/render_composite.py -- --all
```

3. Encode the original first408frames followed by the128rendered frames at24fps. Current export:
   H264, CRF21, GOP6, yuv420p, fast-start, silent. Preserve the original; use versioned outputs.
4. Run the project-local media validation tool. It verifies source/config/interface/frame hashes,
   dimensions, frame rate/count and pixel changes outside the tracked plane.
5. Build the accepted journey first (copies media), then the separate comparison:

```sh
npm run build:journey
npm run typecheck:screen-review
npm run build:screen-review
npm run preview:journey
```

The existing preview serves `/screen-review/screen-review.html`. The comparison build is nested
under the ignored journey output; rebuilding the parent requires rebuilding the comparison afterward.
The original application/router and accepted journey implementation are not modified.

## Verified output and limitations

The enhanced movie has536frames,1280×720 at24fps, approximately22.33seconds,7.03MB and no audio.
Blender rendered the128frames in which the display enters and remains visible. All128PNG checks
found no outside-plane pixel difference above8/255, using a4px-dilated tracked plane. The maximum
outside-plane mean difference was1.236/255; colour conversion and video re-encoding are not lossless.
The original movie, accepted content and poster retain their exact hashes.

The comparison supports synchronized play/pause, keyboard timeline seeking, entrance replay and
stacked mobile layout, without autoplay. Eleven forward/reverse presented-frame pairs matched in
the local browser test. Four automated accessibility scans reported no violations; reduced-motion
and missing-media flows were exercised. Independent source/render/browser review found no blocking
defect for this bounded local comparison.

Manual tracking and sampled visual review do not prove perfect alignment on every frame. Branding
is small on mobile; use desktop/full-resolution footage to judge detail. This is not production
deployment, a live call, full accessibility certification or owner approval of the enhanced film.

Scoped types/build, Bandit, Gitleaks and Semgrep pass. The historical application still has five
type errors and43lint warnings; those unrelated files were not changed by this study.

## Primary references

- [Blender planar replacement documentation](https://docs.blender.org/manual/en/4.4/compositing/types/tracking/plane_track_deform.html)
- [Blender VFX capabilities](https://www.blender.org/features/vfx/)

The installed Blender5.2.1 node sockets and engine identifiers were also qualified directly; the
implementation uses that installed API rather than assuming older tutorial node names still apply.
