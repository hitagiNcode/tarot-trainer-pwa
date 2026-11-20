# Arcana Coach — development guide

Offline-first tarot reading trainer PWA, hosted on GitHub Pages at
https://hitagincode.github.io/tarot-trainer-pwa/ (repo: hitagiNcode/tarot-trainer-pwa, branch `main`).

## Core principles
1. **Zero-build static architecture.** Vanilla HTML5, CSS3 and ES6+ JavaScript only. No npm, bundlers, frameworks or CDN links. Every script, style, font and asset lives in the repo.
2. **Relative paths only.** The site is served under `/tarot-trainer-pwa/`, so never use a leading `/` in asset, manifest or Service Worker URLs.
3. **Offline cache discipline.** When you add, rename or change files, update the `ASSETS` list in `sw.js` and bump `CACHE_NAME`.
4. **Zero-backend data.** Static reference data lives in `data/`. User progress lives in `localStorage` and can be exported/imported as JSON.
5. **Modular design.** Keep rendering (`app.js`), datasets (`data/`) and coaching logic (`engine.js`) separate. `CoachEngine.evaluateReading()` is the only interface the UI uses, so a client-side AI model can replace it later.

## Workflow
- Before changing more than 2–3 files or adding a feature direction, outline a short plan and confirm trade-offs.
- Provide complete files rather than partial snippets.
- Mobile-first: thumb-friendly layouts and graceful offline fallbacks.

## Layout
See the project structure in README.md.
