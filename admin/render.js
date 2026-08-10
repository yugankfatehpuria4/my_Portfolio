/* ═══════════════════════════════════════════════════════════════════════
   render.js — content.json  ➜  the site's markup

   This is the build step. The public site ships fully baked HTML: nothing
   here runs in a visitor's browser. The admin panel calls these functions
   at publish time and splices the output into index.html between the
   <!--#c:name--> markers, which is why every template below reproduces the
   hand-written markup exactly — the same classes the CSS targets and the
   same data-tilt / rv / stag hooks the effects script binds to on load.

   Rule when editing: change markup here and in index.html together, or the
   next publish silently reverts your edit.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── escaping ─────────────────────────────────────────────────────────
     Content is authored by the site owner and intentionally allows inline
     HTML (<b>, <span class="it">) in prose fields. So prose is emitted raw
     and only attribute values are escaped — quotes and angle brackets get
     encoded, but a bare & is left alone so existing entities such as &amp;
     survive a round trip instead of turning into &amp;amp;.               */
  const attr = (s) =>
    String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const raw = (s) => String(s == null ? '' : s);

  /* indent every line of a block by n spaces (first line included) */
  const ind = (n, s) => {
    const pad = ' '.repeat(n);
    return String(s)
      .split('\n')
      .map((l) => (l.trim() ? pad + l : l))
      .join('\n');
  };

  const list = (arr, fn, joiner) => (arr || []).map(fn).join(joiner === undefined ? '\n' : joiner);

  /* ── icon set ─────────────────────────────────────────────────────────
     Lifted verbatim from the original markup. Stroke width differs by
     placement (1.7 in link rows, 1.8 in cards), so the two sizes are kept
     as separate entries rather than parameterised.                        */
  const I = {
    github:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v2a4.8 4.8 0 0 1 2-2z"/><rect x="2" y="9" width="4" height="12" rx=".5"/><circle cx="4" cy="4" r="2"/></svg>',
    leetcode:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    codolio:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    externalSm:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    medal:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>',
    pen:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    globe:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    code:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z"/></svg>',
    pin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };

  const icon = (name) => I[name] || I.star;

  /* shared fragments ---------------------------------------------------- */

  const chips = (items) =>
    '<div class="chips">' + (items || []).map((c) => `<span class="chip">${raw(c)}</span>`).join('') + '</div>';

  const navList = (nav) =>
    '<ul class="nav-l">\n' +
    list(nav, (n) => `  <li><a href="${attr(n.href)}">${raw(n.label)}</a></li>`) +
    '\n</ul>';

  const socialRow = (socials) =>
    '<div class="soc">\n' +
    list(
      socials,
      (s) =>
        `  <a href="${attr(s.url)}" target="_blank" rel="noopener" aria-label="${attr(s.label)}">${icon(s.icon)}</a>`
    ) +
    '\n</div>';

  /* A marquee needs its item list twice: the CSS animation translates the
     track by exactly -50%, so the second copy is what makes the loop seam
     invisible. Duplicating here keeps that a rendering detail the content
     file never has to know about. */
  const marqueeTrack = (items) => {
    const row = (items || [])
      .map((t) => `<span class="mi"><span class="star">✦</span>${raw(t)}</span>`)
      .join('');
    return row + '\n' + row;
  };

  /* ── regions ──────────────────────────────────────────────────────────
     Each returns the inner HTML for one <!--#c:name--> marker pair.       */
  const R = {};

  R.head = (c) => {
    const m = c.meta || {};
    const url = String(m.siteUrl || '').replace(/\/+$/, '');
    const abs = (p) => (/^https?:/i.test(p) ? p : url + '/' + String(p).replace(/^\//, ''));
    return [
      `<title>${raw(m.title)}</title>`,
      `<meta name="description" content="${attr(m.description)}">`,
      `<meta name="keywords" content="${attr(m.keywords)}">`,
      `<meta name="author" content="${attr(m.author)}">`,
      `<meta name="theme-color" content="${attr(m.themeColor)}">`,
      `<meta name="robots" content="index, follow">`,
      ``,
      `<!-- ══ DEPLOYMENT: this domain appears here, in robots.txt and in sitemap.xml.`,
      `     Changing hosts? Set meta.siteUrl in content.json, then update the other two. ══ -->`,
      `<link rel="canonical" href="${attr(url + '/')}">`,
      `<meta property="og:url" content="${attr(url + '/')}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${attr(m.author)}">`,
      `<meta property="og:locale" content="en_US">`,
      `<meta property="og:title" content="${attr(m.ogTitle)}">`,
      `<meta property="og:description" content="${attr(m.ogDescription)}">`,
      `<meta property="og:image" content="${attr(abs(m.ogImage))}">`,
      `<meta property="og:image:width" content="1280">`,
      `<meta property="og:image:height" content="720">`,
      `<meta property="og:image:alt" content="${attr(m.ogImageAlt)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${attr(m.ogTitle)}">`,
      `<meta name="twitter:description" content="${attr(m.ogDescription)}">`,
      `<meta name="twitter:image" content="${attr(abs(m.ogImage))}">`
    ].join('\n');
  };

  R.floatnav = (c) =>
    [
      '<a class="brand" href="#top">Y<span class="star">✦</span></a>',
      navList(c.nav),
      `<a class="btn btn-fill" href="${attr(c.profile.resumeUrl)}" target="_blank" rel="noopener">Resume</a>`
    ].join('\n');

  /* The hero's first chapter is also its no-JS / reduced-motion resting
     state, so it is baked into the markup rather than written by script. */
  R.herostatic = (c) => {
    const ch = (c.chapters && c.chapters[0]) || {};
    return [
      `<span class="got-sigil" id="gotSigil">${raw(ch.sigil)}</span>`,
      '<div class="got-divider">',
      '  <div class="got-divider-line"></div>',
      '  <div class="got-divider-diamond"></div>',
      '  <div class="got-divider-line right"></div>',
      '</div>',
      `<span class="got-subtitle" id="gotSub">${raw(ch.subtitle)}</span>`,
      `<h1 class="got-title" id="gotTitle">${raw(ch.title)}</h1>`,
      `<p class="got-body" id="gotBody">${raw(ch.body)}</p>`
    ].join('\n');
  };

  /* the CHAPTERS array inside the effects script, between /*#c:chapters*​/ */
  R.chapters = (c) =>
    '  const CHAPTERS = [\n' +
    list(
      c.chapters,
      (ch) =>
        `    {s:${JSON.stringify(ch.sigil)}, sub:${JSON.stringify(ch.subtitle)}, t:${JSON.stringify(
          ch.title
        )},\n     b:${JSON.stringify(ch.body)}}`,
      ',\n'
    ) +
    '\n  ];';

  R.bento = (c) => {
    const p = c.profile;
    return [
      '<div class="tile tl tl-nav"><div class="glare"></div>',
      '  <a class="brand" href="#top">' + raw(p.firstName) + ' <span class="star">✦</span></a>',
      ind(2, navList(c.nav)),
      `  <a class="btn btn-line" href="${attr(p.resumeUrl)}" target="_blank" rel="noopener">Resume ↗</a>`,
      '</div>',
      '',
      '<div class="tile tl tl-intro" data-tilt><div class="glare"></div>',
      '  <div class="tin">',
      `    <div class="avail"><span class="pulse"></span>${raw(p.availability)}</div>`,
      `    <div class="kick">${raw(p.kicker)}</div>`,
      `    <h1>${raw(p.firstName)}<br>${raw(p.lastName)} <span class="star">✦</span></h1>`,
      `    <p class="tag">${raw(p.tagline)}</p>`,
      '  </div>',
      '  <div class="tin cta-row">',
      `    <a class="btn btn-fill" href="${attr(p.ctaPrimary.href)}">${raw(p.ctaPrimary.label)}</a>`,
      `    <a class="btn btn-line" href="${attr(p.ctaSecondary.href)}">${raw(p.ctaSecondary.label)}</a>`,
      ind(4, socialRow(c.socials)),
      '  </div>',
      '</div>',
      '',
      '<div class="tile tl tl-photo" data-tilt>',
      `  <img src="${attr(p.photo)}" alt="${attr(p.photoAlt)}" fetchpriority="high" decoding="async">`,
      `  <span class="chip-loc">${raw(p.locationChip)}</span>`,
      '  <div class="veil"></div>',
      '  <div class="id">',
      `    <div class="who">${raw(p.photoCaption)}</div>`,
      `    <div class="role">${raw(p.photoRole)}</div>`,
      '  </div>',
      '</div>',
      '',
      '<div class="tile tl tl-now" data-tilt><div class="glare"></div>',
      '  <div class="tin" style="display:flex;flex-direction:column;height:100%">',
      `    <div class="tl-label"><span class="d"></span>${raw(c.now.label)}</div>`,
      `    <h3>${raw(c.now.title)}</h3>`,
      `    <p>${raw(c.now.desc)}</p>`,
      '  </div>',
      '</div>',
      '',
      '<div class="tile tl tl-core">',
      '  <canvas id="blob"></canvas>',
      `  <div class="tl-label"><span class="d"></span>${raw(c.core.label)}</div>`,
      '  <div class="cap">',
      `    <div class="t">${raw(c.core.title)}</div>`,
      `    <div class="s">${raw(c.core.subtitle)}</div>`,
      '  </div>',
      '</div>',
      '',
      '<div class="tile tl tl-stats"><div class="glare"></div>',
      list(
        c.stats,
        (s) => `  <div class="st"><div class="v">${raw(s.value)}</div><div class="l">${raw(s.label)}</div></div>`
      ),
      '</div>',
      '',
      '<div class="tile tl tl-marq">',
      '  <div class="marquee"><div class="mtrack">',
      ind(4, marqueeTrack(c.heroMarquee)),
      '  </div></div>',
      '</div>'
    ].join('\n');
  };

  /* section heading + house words, shared by every themed section */
  const sectionHead = (s) =>
    [
      `<div class="slabel rv"><span class="star"${s.starColor ? ` style="color:${attr(s.starColor)}"` : ''}>${raw(
        s.star
      )}</span> ${raw(s.title)} <small>${raw(s.small)}</small></div>`,
      `<p class="house-words rv">${raw(s.houseWords)}</p>`
    ].join('\n');

  R.experience = (c) =>
    [
      sectionHead(c.experienceSection),
      '<div class="xp">',
      '',
      list(
        c.experience,
        (x) =>
          [
            `  <div class="tile xcard${x.variant ? ' ' + x.variant : ''} rv" data-tilt><div class="glare"></div>`,
            '    <div class="tin">',
            '      <div class="xtop">',
            `        <div class="xrole">${raw(x.role)} <span class="at">${raw(x.at)}</span></div>`,
            `        <div class="xwhen">${raw(x.when)}</div>`,
            '      </div>',
            `      <div class="xorg">${raw(x.org)}</div>`,
            '      <ul>',
            list(x.bullets, (b) => `        <li>${raw(b)}</li>`),
            '      </ul>',
            x.photos && x.photos.length
              ? '      <div class="xgal">\n' +
                list(
                  x.photos,
                  (ph) =>
                    `        <figure><img src="${attr(ph.src)}" alt="${attr(
                      ph.alt
                    )}" loading="lazy"><figcaption>${raw(ph.caption)}</figcaption></figure>`
                ) +
                '\n      </div>'
              : null,
            '      ' + chips(x.chips),
            '    </div>',
            '  </div>'
          ]
            .filter((l) => l !== null)
            .join('\n'),
        '\n\n'
      ),
      '',
      '</div>'
    ].join('\n');

  const projectCard = (p) => {
    const links = [
      p.codeUrl
        ? `      <a href="${attr(p.codeUrl)}" target="_blank" rel="noopener">${I.github}Code</a>`
        : null,
      p.liveUrl
        ? `      <a class="plive" href="${attr(p.liveUrl)}" target="_blank" rel="noopener">${I.external}Live</a>`
        : null
    ].filter(Boolean);

    return [
      `  <article class="tile pcard${p.big ? ' big' : ''}" data-tilt>`,
      '    <div class="pmedia">',
      `      <div class="pfall" style="background:linear-gradient(135deg,${attr(p.fallback.from)},${attr(
        p.fallback.to
      )})"><span style="color:${attr(p.fallback.color)}">${raw(p.fallback.text)}</span></div>`,
      p.image
        ? `      <img src="${attr(p.image)}" alt="${attr(p.imageAlt)}" loading="lazy" onerror="this.remove()">`
        : null,
      '    </div>',
      '    <div class="pbody"><div class="glare"></div>',
      `      <div class="ptag"${p.tagColor ? ` style="color:${attr(p.tagColor)}"` : ''}>${raw(p.tag)}</div>`,
      `      <h3>${raw(p.title)}</h3>`,
      `      <p>${raw(p.desc)}</p>`,
      '      ' + chips(p.chips),
      links.length ? '      <div class="plinks">\n' + links.join('\n') + '\n      </div>' : null,
      '    </div>',
      '  </article>'
    ]
      .filter((l) => l !== null)
      .join('\n');
  };

  R.work = (c) => {
    const w = c.workSection;
    return [
      sectionHead(w),
      '<div class="pgrid stag">',
      '',
      list(c.projects, projectCard, '\n\n'),
      '',
      '</div>',
      '',
      `<div class="hlabel rv">${raw(w.sideLabel)}</div>`,
      '<div class="hgrid stag">',
      list(
        c.sideProjects,
        (s) =>
          [
            '  <div class="tile hcard"><div class="glare"></div>',
            `    <div class="hcard-m">${raw(s.meta)}</div>`,
            `    <h4>${raw(s.title)} <a href="${attr(s.url)}" target="_blank" rel="noopener" aria-label="${attr(
              s.ariaLabel
            )}">${I.externalSm}</a></h4>`,
            `    <p>${raw(s.desc)}</p>`,
            '  </div>'
          ].join('\n')
      ),
      '</div>',
      `<div class="center rv"><a class="btn btn-line" href="${attr(
        w.allReposUrl
      )}" target="_blank" rel="noopener">${raw(w.allReposLabel)}</a></div>`
    ].join('\n');
  };

  R.stack = (c) =>
    [
      sectionHead(c.stackSection),
      '<div class="rv">',
      list(
        c.stack,
        (row) =>
          [
            `  <div class="marquee${row.variant ? ' ' + row.variant : ''}"><div class="mtrack">`,
            ind(4, marqueeTrack(row.items)),
            '  </div></div>'
          ].join('\n')
      ),
      '</div>'
    ].join('\n');

  R.ride = (c) => {
    const r = c.ride;
    return [
      sectionHead(c.rideSection),
      '<div class="tile ride rv">',
      `  <div class="bgimg"><img src="${attr(r.image)}" alt="${attr(r.imageAlt)}"></div>`,
      '  <div class="shade"></div>',
      '  <div class="rin">',
      `    <div class="tl-label"><span class="d"></span>${raw(r.label)}</div>`,
      `    <h3>${raw(r.title)}</h3>`,
      list(r.paragraphs, (p) => `    <p>${raw(p)}</p>`),
      '    ' + chips(r.chips),
      '  </div>',
      `  <div class="cap">${raw(r.caption)}</div>`,
      '</div>'
    ].join('\n');
  };

  R.honors = (c) =>
    [
      sectionHead(c.honorsSection),
      '<div class="hon stag">',
      list(
        c.honors,
        (h) =>
          [
            '  <div class="tile hocard"><div class="glare"></div>',
            `    <div class="ic">${icon(h.icon)}</div>`,
            `    <h4>${raw(h.title)}</h4>`,
            `    <p>${raw(h.desc)}</p>`,
            '  </div>'
          ].join('\n')
      ),
      '</div>'
    ].join('\n');

  R.contact = (c) => {
    const k = c.contact;
    return [
      '<div class="tile contact rv"><div class="glare"></div>',
      '  <div class="tin">',
      `    <div class="kick">${raw(k.kicker)}</div>`,
      `    <h2>${raw(k.heading)}</h2>`,
      `    <p class="lead">${raw(k.lead)}</p>`,
      `    <a class="btn btn-fill" style="font-size:14.5px;padding:15px 34px" href="${attr(
        k.ctaHref
      )}">${raw(k.ctaLabel)}</a>`,
      '    <div class="ccards">',
      list(
        k.cards,
        (cd) =>
          [
            '      <div class="ccard">',
            `        <div class="l">${icon(cd.icon)}${raw(cd.label)}</div>`,
            `        <div class="v">${raw(cd.value)}</div>`,
            `        <button class="cpy" data-copy="${attr(cd.copy)}" aria-label="${attr(cd.aria)}">${
              I.copy
            }</button>`,
            '      </div>'
          ].join('\n')
      ),
      '    </div>',
      ind(4, socialRow(c.socials)),
      '  </div>',
      '</div>'
    ].join('\n');
  };

  R.footer = (c) => {
    const f = c.footer;
    return [
      `<p class="f1">${raw(f.line1)}</p>`,
      `<p class="f2">${raw(f.line2)}</p>`,
      `<p class="f2" style="margin-top:14px;font-family:var(--fell);font-style:italic;font-size:13px;color:var(--gold);opacity:.7">${raw(
        f.quote
      )}</p>`
    ].join('\n');
  };

  /* ── splicing ─────────────────────────────────────────────────────────
     Regions are delimited by paired markers. HTML regions use
     <!--#c:name--> … <!--#c:/name-->; the one JS region inside the effects
     script uses the block-comment form so it stays valid JavaScript.      */
  function markers(name, kind) {
    return kind === 'js'
      ? { open: `/*#c:${name}*/`, close: `/*#c:/${name}*/` }
      : { open: `<!--#c:${name}-->`, close: `<!--#c:/${name}-->` };
  }

  const REGIONS = {
    head: 'html',
    floatnav: 'html',
    herostatic: 'html',
    bento: 'html',
    experience: 'html',
    work: 'html',
    stack: 'html',
    ride: 'html',
    honors: 'html',
    contact: 'html',
    footer: 'html',
    chapters: 'js'
  };

  /* Indentation is inferred from whatever precedes the opening marker, so
     the generated block lines up with the surrounding hand-written HTML
     and the published file stays readable in a diff. */
  function spliceRegion(html, name, body) {
    const kind = REGIONS[name];
    const { open, close } = markers(name, kind);
    const a = html.indexOf(open);
    const b = html.indexOf(close);
    if (a === -1 || b === -1) throw new Error(`marker for region "${name}" not found in index.html`);
    if (b < a) throw new Error(`markers for region "${name}" are out of order`);

    const lineStart = html.lastIndexOf('\n', a) + 1;
    const prefix = html.slice(lineStart, a);
    const indent = /^[ \t]*$/.test(prefix) ? prefix : '';

    return html.slice(0, a + open.length) + '\n' + ind(indent.length, body) + '\n' + indent + html.slice(b);
  }

  /* Full publish: content.json + the current index.html ➜ the new index.html */
  function build(content, templateHtml) {
    let out = templateHtml;
    Object.keys(REGIONS).forEach((name) => {
      out = spliceRegion(out, name, R[name](content));
    });
    return out;
  }

  root.PortfolioRender = { regions: R, build, spliceRegion, markers, REGIONS, icons: I };
})(typeof window !== 'undefined' ? window : globalThis);
