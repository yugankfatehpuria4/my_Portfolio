<div align="center">

# Yugank Fatehpuria — Portfolio

**Full-Stack Developer & AI Engineer** · B.Tech CSE @ IIIT Sonipat '27 · Ex-NIC New Delhi

A hand-built, single-file portfolio site — no framework, no bundler, no build step.
Every pixel, animation, and byte-of-payload decision is deliberate.

[![Live Site](https://img.shields.io/badge/Live-yugank.vercel.app-000?style=for-the-badge&logo=vercel)]([https://yugank.vercel.app](https://my-portfolio-iota-ebon-33.vercel.app/))
&nbsp;
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-000?style=for-the-badge&logo=three.js&logoColor=white)

<a href="[https://yugank.vercel.app](https://my-portfolio-iota-ebon-33.vercel.app/)">
  <img src="./video/got-poster.jpg" alt="Portfolio hero — Game of Thrones themed" width="720">
</a>

</div>

---

## Overview

A zero-dependency personal site with a *Game of Thrones* theme, built to prove a point:
you can ship something rich, fast, and accessible without reaching for a framework.
The entire site — markup, styling, and interaction logic — lives in a single `index.html`.
There is nothing to `npm install` and nothing to build.

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
video/got-hero.mp4    scroll-scrubbed hero (desktop only)
video/got-poster.jpg  poster still + OG/link-preview image
vercel.json           cache + security headers
robots.txt            crawler rules
sitemap.xml           single-page sitemap
```

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

**Changing the domain** — the URL is hardcoded in `index.html`, `robots.txt`, and `sitemap.xml`
(static HTML can't template it):

```bash
grep -rl 'yugank.vercel.app' . --exclude-dir=.git \
  | xargs sed -i '' 's|yugank\.vercel\.app|YOUR-NEW-DOMAIN.com|g'
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

[![Website](https://img.shields.io/badge/Website-yugank.vercel.app-000?style=flat-square&logo=vercel)](https://yugank.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-yugankfatehpuria4-181717?style=flat-square&logo=github)](https://github.com/yugankfatehpuria4)
[![Email](https://img.shields.io/badge/Email-yugankfatehpuria786@gmail.com-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:yugankfatehpuria786@gmail.com)

<sub>Built by hand, one file, no framework.</sub>

</div>
