# Care-thread stills

`care-thread-clinic-v2.webp` and `care-thread-home-v2.webp` are still pictures of the site's own live
illustrations. They replace the v1 files that were rendered from the retired 3D room scene; the v1
files stay in `public/media/journey/` because other local showcases still refer to them.

| File | Drawn from | Used by |
|---|---|---|
| `care-thread-clinic-v2.webp` | `ClinicSketch` (homepage "For clinicians" illustration) | `journey.media.poster` |
| `care-thread-home-v2.webp` | `HeroThread` (homepage hero, all four moments reached) | `journey.media.homePoster` |

The homepage itself does not load either file: it draws both illustrations in code, so they stay sharp
at every size. The stills exist for places that need an image file.

## What the stills contain

No people, faces or figures. Initials stand in for people. The hero still shows the same made-up
clinician name and appointment as the hero and carries the "Illustration only" note; it leaves out the
site's current service notice, because a still outlives the page it was taken from.

## Rendering

Nothing is drawn by hand and no outside service is used. The script opens a running copy of this site in
the project's own Playwright Chromium with reduced motion, lifts one illustration to fill a 1280x720
window, captures it at 1.25x and encodes WebP in the same browser.

```sh
npm run dev
```

```sh
node design/care-thread-posters/render_posters.mjs <address>
```

`<address>` is the local address the dev server prints; the script accepts only an address on this
computer and blocks every other request. It writes a file that does not exist yet and leaves an existing,
different file alone unless `--force` is added (for drafts that were never released). To compare the files on disk with a fresh render without
writing anything:

```sh
node design/care-thread-posters/render_posters.mjs <address> --check
```

`--check` exits 1 when a file differs. Run it after changing the hero, the clinician illustration,
their copy in `src/content/journey.json`, the colour tokens or the fonts, and re-render when it reports a
difference. `--check` is a manual step: no automated gate runs it, because it needs a running site.
Two renders in a row on the same machine and browser build produce identical bytes. A different Chromium
version, operating system or set of installed fonts may not, so a difference after a Playwright upgrade
or on another computer is expected and is not by itself a reason to replace the files.

## Configuration

- `posters.json`: window size, output size, WebP quality, weight limit and which illustration feeds which
  `media` key.
- `src/content/journey.json`: the output paths (`media.poster`, `media.homePoster`) and all text shown.
- The per-illustration staging rules are in `render_posters.mjs`; they only position the live artwork
  and let it grow past its on-page size cap.

A new version gets a new file name (`-v3`), then the `media` paths change; old files are not overwritten
once released.
