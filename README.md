# ayaanaatif.me

Portfolio of **Ayaan Aatif** — robotics, digital twins and edge AI.
Built as an interactive command system rather than a scrolling page.

**Live:** https://ayaanaatif.me

---

## Stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (`@theme` tokens, no config file) |
| 3D | three.js · React Three Fiber 9 |
| Animation | Framer Motion + CSS |
| State | Zustand |
| Hosting | Vercel |

## Architecture

```
src/
  app/            layout (metadata, JSON-LD), page (phase orchestration)
  content/
    profile.ts    ← single source of truth for every fact on the site
  components/
    landing/      boot sequence + hero
    hub/          command center, module dialogs
    sections/     the eight module bodies
    three/        WebGL scenes, each isolated by SceneBoundary
    aura/         on-site assistant
  lib/aura.ts     intent engine
  hooks/          capability probe, idle-deferred mount
  store/          system phase + active module
tools/
  segment-portrait.ps1   offline portrait → point-cloud segmentation
```

### Content integrity

`src/content/profile.ts` is the only place facts live. Publications carry an
explicit `status` (`published` / `accepted` / `scheduled`) and ventures carry a
`stage` (`operating` / `building` / `concept`), so the UI cannot render an
accepted paper as published or a concept as a shipped product.

AURA answers **only** from this module — no API key, no network call, so it
physically cannot invent a credential.

### Performance notes

Things that are load-bearing, not incidental:

- **The hero is CSS-animated, not Framer Motion.** Framer writes its `initial`
  styles into the SSR HTML, so an `opacity: 0` hero stays invisible until
  hydration — that measured a 4.5s LCP on throttled mobile.
- **three.js is held behind `requestIdleCallback`** so WebGL never sits on the
  critical path.
- **Every `<Canvas>` is wrapped in `SceneBoundary`.** A throw inside a canvas
  otherwise propagates to the React root and unmounts the whole page; a visitor
  without WebGL would get a blank site.
- **The particle scenes are one draw call each** — custom shaders, position
  interpolation on the GPU. Particle budget drops on weak devices via the
  capability probe, and all motion respects `prefers-reduced-motion`.

Lighthouse (desktop): Performance 99 · Accessibility 100 · Best Practices 100 ·
SEO 100.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm start
```

## Regenerating the hologram

The Mission Briefing avatar is a point cloud built from a segmented portrait.
To swap the photo:

```powershell
pwsh tools/segment-portrait.ps1 -Src path\to\photo.jpg -CropX 398 -CropY 520 -CropW 304 -CropH 634
```

It writes `public/avatar/ayaan-cloud.png` with the background knocked out to
alpha 0. The runtime reads that PNG and infers volume from the silhouette.
Works best on a subject that separates from its background by luminance.
