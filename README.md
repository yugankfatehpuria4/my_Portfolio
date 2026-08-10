<div align="center">

# Yugank Fatehpuria — Portfolio

**Full-Stack Developer & AI Engineer** · B.Tech CSE @ IIIT Sonipat '27 · Ex-NIC New Delhi

A hand-built, single-file portfolio site — no framework, no bundler, no build step.
Every pixel, animation, and byte-of-payload decision is deliberate.

[![Live Site](https://img.shields.io/badge/Live-my--portfolio--iota--ebon--33.vercel.app-000?style=for-the-badge&logo=vercel)](https://my-portfolio-iota-ebon-33.vercel.app/)
&nbsp;
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-000?style=for-the-badge&logo=three.js&logoColor=white)

<a href="https://my-portfolio-iota-ebon-33.vercel.app/">
  <img src="./video/got-poster.jpg" alt="Portfolio hero — Game of Thrones themed" width="720">
</a>

</div>

---

## Overview

A zero-dependency personal site with a *Game of Thrones* theme, built to prove a point:
you can ship something rich, fast, and accessible without reaching for a framework.
The whole site — markup, styling, and interaction logic — is one `index.html`.
There is nothing to `npm install` and nothing to build.

Content is edited through a hidden admin panel at `/admin` rather than by hand.
It writes `content.json` and **regenerates the markup inside `index.html`**, so what
visitors download is still fully baked static HTML — no client-side rendering, no
data fetch, no framework. See [Editing content](#editing-content).

> **Why it's worth a look:** it pairs a scroll-scrubbed cinematic hero and three WebGL
> effects with a strict performance and accessibility budget — the interesting part isn't
> that it moves, it's what it *doesn't* download to make that possible.

---

## Engineering Highlights

| Area | What I did | Why it matters |
| --- | --- | --- |
| **Performance** | Hero video is attached via JS only above 760px — phones never fetch the 7.3 MB file. `display:none` alone would still download it. | Real mobile data budget, not a desktop afterthought. |
| **Video scrubbing** | Scroll-driven playback backed by HTTP `Range` requests (`206 Partial Content`) and immutable year-long caching for `/video/*`. | Smooth seeking without loading the whole file per frame. |
| **Graphics** | Three WebGL effects — an ice/ember particle field, a dragon-egg shader, and a card-tilt — each wrapped in its own `try/catch`. | A GPU/WebGL failure degrades quietly instead of blanking the page. |
| **Theming** | CSS custom properties rebound per `<section>` via a `data-house` attribute; add a house in `:root` and every descendant re-themes for free. | Scalable design system with zero JS. |
| **Accessibility** | `prefers-reduced-motion` respected throughout — the hero collapses to a static chapter and particles nearly freeze. | Inclusive by default, not bolted on. |
| **SEO & hardening** | Sitemap, robots rules, OG link-preview image, and security headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`). | Production hygiene on a static site. |

---

## Tech Stack

**Core:** Vanilla HTML5 · CSS3 (custom properties) · JavaScript (ES modules)
**Graphics:** Three.js / WebGL (custom shaders)
**Hosting:** Vercel (static, edge-cached) · CDN-loaded fonts & libraries

---

## Project Structure

```
index.html            entire site — markup, CSS and JS in one file
content.json          every editable word and image path — the source of truth
media/                photos, referenced by path (content-hashed on upload)
admin/                the content console (hidden, not linked, noindex)
  index.html            shell + UI
  app.js                editors, drag-reorder, publish flow
  render.js             content.json -> markup (the build step)
  store.js              encrypted vault, image processing, publish targets
video/got-hero.mp4    scroll-scrubbed hero (desktop only)
video/got-poster.jpg  poster still + OG/link-preview image
vercel.json           cache + security headers
robots.txt            crawler rules
sitemap.xml           single-page sitemap
```

---

## Editing content

Everything on the page — projects and their order, internships, tech stack, photos,
honors, copy, SEO tags — is edited at **`/admin`**. It is not linked from the site,
excluded in `robots.txt`, and sends `X-Robots-Tag: noindex`.

**How publishing works.** The panel edits `content.json`, then runs `admin/render.js`
to regenerate the markup and splice it into `index.html` between `<!--#c:name-->`
marker comments. That is the build step — it just runs at publish time instead of
deploy time. The published page contains no admin code and does no runtime fetching.

Two publish targets:

| Target | Setup | What happens |
| --- | --- | --- |
| **GitHub** *(recommended)* | Paste a fine-grained token in Settings | One atomic commit of `content.json`, `index.html` and any new images. Vercel redeploys on its own. Full history and one-click rollback. |
| **Local** | None | Writes the same files into your project folder (Chrome's File System Access API), or falls back to downloads. Commit them yourself. |

**No database is required**, and adding one would not buy anything: the content is
a single small document with exactly one writer, and git already provides history,
diffs and rollback.

### First run

1. Open `/admin` and set a passphrase (this encrypts your token — it is not a login).
2. *Optional, for one-click publishing:* create a **fine-grained** token at
   GitHub → Settings → Developer settings, scoped to **this repository only** with
   **Contents: Read and write**. Paste it into Settings → Test connection → Save.
3. Edit, hit **Preview** to see the real page rebuild live, then **Publish** (⌘S).

### Security, stated honestly

The passphrase gate is **obscurity, not access control** — this is a static site, so
anyone can read `admin/app.js`. What it actually protects is the GitHub token, which
is encrypted with AES-GCM under a PBKDF2-derived key (250k rounds) and never committed
to the repo. Without the passphrase the stored token is unreadable; without a token
nobody can write to your repo. Treat `/admin` as a convenience, and the token as the
real credential. If you ever need a genuine login wall, that requires a server —
a Vercel serverless function in front of the publish call would be the smallest step.

### Notes

- Images are downscaled and re-encoded in the browser on upload, then written under a
  content-hashed filename (`media/photo-a3f9c1e2.jpg`). That is deliberate: `/media/*`
  is cached `immutable` for a year, so a changed image *must* arrive under a new name.
- Edits autosave as a local draft, so a closed tab does not lose work. Picked images
  are not kept in the draft and need re-adding.
- **`render.js` and `index.html` must agree.** If you hand-edit markup inside a marker
  region, mirror the change in `render.js` or the next publish will overwrite it.

---

## Run Locally

Must be served over HTTP — opening `index.html` via `file://` breaks the video.

```bash
python3 -m http.server 8137
# → http://localhost:8137
```

> `http.server` ignores `Range` headers, so hero scrubbing feels choppier locally than in
> production (Vercel serves proper `206 Partial Content`). Don't tune the video by how it feels here.

---

## Deploy

Static files with relative paths — deploys as-is to **Vercel, Netlify, GitHub Pages,
Cloudflare Pages, or S3**. Only `vercel.json` is host-specific.

```bash
npx vercel --prod
```

On Vercel, choose framework preset **Other** and leave build command / output directory **empty**.

---

<details>
<summary><strong>Maintenance notes</strong> (theming, video re-encoding, domain change)</summary>

<br>

**Changing the domain** — set `meta.siteUrl` in the admin panel's *SEO & meta* tab and
publish; that rewrites every canonical/OG/Twitter URL in `index.html`. `robots.txt` and
`sitemap.xml` are not generated, so update those two by hand — or do all of it at once:

```bash
grep -rl 'my-portfolio-iota-ebon-33.vercel.app' . --exclude-dir=.git --exclude-dir=node_modules \
  | xargs sed -i '' 's|my-portfolio-iota-ebon-33\.vercel\.app|YOUR-NEW-DOMAIN.com|g'
# drop the '' after -i on Linux
```

**Re-encoding the hero video** — keep keyframes dense or scrubbing will stutter:

```bash
ffmpeg -i source.mp4 -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 30 \
  -preset slow -g 12 -keyint_min 12 -sc_threshold 0 -an -movflags +faststart \
  video/got-hero.mp4
```

**Theming** — each `<section>` carries a `data-house` attribute (`stark`, `targaryen`,
`lannister`, `baratheon`, `tyrell`, `watch`) that rebinds accent variables locally. Add a house
in `:root` and it's immediately usable.

</details>

---

<div align="center">

### Let's connect

[![Website](https://img.shields.io/badge/Website-my--portfolio--iota--ebon--33.vercel.app-000?style=flat-square&logo=vercel)](https://my-portfolio-iota-ebon-33.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-yugankfatehpuria4-181717?style=flat-square&logo=github)](https://github.com/yugankfatehpuria4)
[![Email](https://img.shields.io/badge/Email-yugankfatehpuria786@gmail.com-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:yugankfatehpuria786@gmail.com)

<sub>Built by hand, one file, no framework.</sub>

</div>
