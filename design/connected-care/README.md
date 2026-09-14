# Connected-care local design study

An isolated frontend review candidate: a fictional clinic-to-home care story, public learning
pages, login designs and patient/clinician/staff demonstrations. This is not an operating clinic,
medical advice, real authentication, a video-call service or evidence of clinical outcomes.

## Run locally

From the frontend repository, with the project's existing local preview configuration:

```sh
npm run dev:journey
npm run typecheck:journey
npm run test
npm run build:journey
npm run preview:journey
```

The new entry is separate from the original application and previous design studies. No
deployment is included. Preview settings live in the project's private configuration layer;
maintained UI copy, sample data and media/motion settings live in validated `src/content/journey.json`.

## Visual production

- Original Blender clinic/home geometry, clay figures, materials, lighting and camera keyframes:
  `scene.json` and `build_scene.py`. Run the script only in a new background Blender process.
  It exports an editable scene, GLB and four composition stills; it clears only that new process's scene.
- Final raster footage: two Seedance 2.5 generated shots. The clinic shot's last decoded frame was
  supplied as the continuation's first-frame reference. The Blender scene was previsualization;
  the film is not claimed to reproduce its exact geometry or camera path.
- Web edit: silent 720p, 24fps, approximately22.33seconds,7.20MB. A paused HTML video follows
  native forward/reverse scrolling. DOM controls remain separate; no wheel/touch interception.
- The media depicts fictional male participants. Any future female character must wear hijab.

## Routes and behavior

Home, knowledge base with six sample guides, journal with three sample stories, article pages,
patient/clinician/staff workspaces, login/staff entry and the original Blender storyboard are available.
Workspace data is shared in memory only. Staff sees scheduling/readiness, not clinical notes.
Forms clear credentials without sending or storing them. Call controls are explicitly illustrative.

Mobile uses a smaller film window to preserve readable captions. Reduced-motion and short
viewports use manual chapters with matching stills. Missing media preserves navigation; a
JavaScript-disabled initial response retains explanatory content. Care details use a keyboard-tested
native dialog. Skip remains available throughout the story.

## Review status

Local candidate for owner review, not production-ready or aesthetically approved. Independent
review found no remaining blocking defect in its tested scope. Unit tests77/77; original E2E10/10;
new strict types and builds pass. The historical full application still has five type errors;
full lint has43 existing warnings. Eighteen automated accessibility scans found no violations,
but image contrast/ARIA still require manual judgment. No physical-device, complete WCAG or
native browser-zoom certification is implied.

Scoped Gitleaks and Bandit checks pass; Semgrep reports no findings across nine new files with
223 applicable rules. These checks do not establish overall application security or compliance.

Visible polish debt: clinician styling varies between clips, and the home shot contains both
a laptop and TV call screen. Contact sheets and selected presented frames were reviewed, not
every frame. Generation capability does not guarantee character or camera-path consistency.

## Primary capability references

- [Seedance2.5 announcement](https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5)
- [OpenRouter Seedance2.5 model](https://openrouter.ai/bytedance/seedance-2.5)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
