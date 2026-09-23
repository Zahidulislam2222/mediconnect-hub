# Third-party notices

The MIT Licence in [LICENSE](LICENSE) covers the original source code in this repository written for
MediConnect. It does **not** relicense third-party material. Each third-party component below keeps
its own licence and copyright.

## Software dependencies

npm packages listed in `package.json` / `package-lock.json`, Android (Gradle) and iOS (Swift Package)
dependencies under `android/` and `native/` are used under their own licences. Run
`npx license-checker --summary` (or your preferred tool) for the current list.

## Fonts

| Font | Files | Licence |
|---|---|---|
| Inter | `public/fonts/` | SIL Open Font License 1.1: `public/fonts/Inter-OFL.txt` |
| Sora | `public/fonts/` | SIL Open Font License 1.1: `public/fonts/Sora-OFL.txt` |

## Media and design assets: excluded from the MIT grant

The images, videos and 3D files under `public/media/` and `design/` are **not** licensed under MIT
until the owner confirms the rights to each one. Several were created with third-party AI generation
services (for example Seedance 2.5 and Veo 3.1 through OpenRouter), whose terms may apply. One design
composite is based on a photographed screen whose source has not been confirmed. Provenance notes are
in `design/*/README.md` and `design/continuity-preview.md`. All people and records shown are fictional.

To reuse these assets, ask the maintainer first. Apart from this media, the rest of the repository
is MIT-licensed.
