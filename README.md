# Yugank Fatehpuria — Portfolio

A single-file, zero-build portfolio with a Game of Thrones theme. Static HTML,
no framework, no bundler, no `npm install`.

**Live:** https://yugank.vercel.app

---

## Structure

```
index.html            entire site — markup, CSS and JS in one file
video/got-hero.mp4    7.3 MB scroll-scrubbed hero (desktop only)
video/got-poster.jpg  poster still, also the OG/link-preview image
vercel.json           cache + security headers
robots.txt            crawler rules
sitemap.xml           single-page sitemap
```

Everything else — fonts, Three.js — loads from CDN. There is nothing to build.

---

## Deploying

### Vercel (current host)

Import the repo at [vercel.com/new](https://vercel.com/new). When it asks for a
framework preset choose **Other**, and leave build command and output directory
**empty** — this is a plain static site.

Or from the CLI:

```bash
npx vercel --prod
```

`vercel.json` handles the rest:

- `/video/*` is cached immutably for a year (the filenames don't change in place)
- the page itself must revalidate, so edits go live immediately
- range requests are served automatically, which is what makes video scrubbing work
- basic security headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`)

### Anywhere else

It's static files with relative paths, so it also works as-is on Netlify,
GitHub Pages, Cloudflare Pages, S3, or `python3 -m http.server`. The only
host-specific file is `vercel.json`.

---

## Changing the domain

The URL is hardcoded in three files (`index.html`, `robots.txt`, `sitemap.xml`)
because static HTML can't template it. To move domains, run:

```bash
grep -rl 'yugank.vercel.app' . --exclude-dir=.git | xargs sed -i '' 's|yugank\.vercel\.app|YOUR-NEW-DOMAIN.com|g'
```

Drop the `''` after `-i` on Linux.

---

## Local preview

Must be served over HTTP — opening `index.html` via `file://` breaks the video.

```bash
python3 -m http.server 8137
```

Then open http://localhost:8137

Note: `http.server` ignores `Range` headers and returns the whole 7.3 MB file
for every seek, so hero scrubbing feels choppier locally than it will in
production. Vercel serves proper `206 Partial Content`. Don't tune the video
based on how it feels here.

---

## Notes for future edits

- **Theming** runs on CSS custom properties. Each `<section>` carries a
  `data-house` attribute (`stark`, `targaryen`, `lannister`, `baratheon`,
  `tyrell`, `watch`) that rebinds the accent variables locally, so every
  descendant rule re-themes automatically. Add a house in `:root` and it's
  immediately usable.
- **The hero video is desktop-only.** Its `src` is attached by JS above 760px
  wide; phones get `got-poster.jpg` instead. A CSS `display:none` alone would
  still download all 7.3 MB.
- **Re-encoding the video?** Keep keyframes dense or scrubbing will stutter:

  ```bash
  ffmpeg -i source.mp4 -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 30 \
    -preset slow -g 12 -keyint_min 12 -sc_threshold 0 -an -movflags +faststart \
    video/got-hero.mp4
  ```

- **Three 3D effects** live at the bottom of `index.html`: the ice/ember
  particle field, the dragon-egg shader, and the card tilt. Each is wrapped in
  its own `try/catch` so a WebGL failure degrades quietly instead of blanking
  the page.
- `prefers-reduced-motion` is respected throughout — the hero collapses to a
  single static chapter and particles nearly freeze.
