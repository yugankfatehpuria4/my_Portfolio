/* ═══════════════════════════════════════════════════════════════════════
   app.js — the content console

   Editors are declared as HTML strings and bound by path: every input
   carries data-path="projects.3.title" and one delegated listener writes
   it into the content object. Typing therefore never re-renders the form,
   which is what keeps focus and cursor position intact; only structural
   edits (add / delete / reorder / image swap) redraw a section.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const S = {
    content: null,
    saved: null, // last published/loaded state, for dirty comparison + revert
    section: 'overview',
    pass: null,
    secrets: {},
    pending: new Map(), // path -> {bytes, dataUrl, size}
    open: new Set(), // expanded list items
    template: null
  };

  /* ── path access ──────────────────────────────────────────────────── */
  const get = (path, root) =>
    path.split('.').reduce((o, k) => (o == null ? o : o[k]), root || S.content);

  function set(path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    let o = S.content;
    for (const k of keys) o = o[k];
    o[last] = val;
  }

  /* ── chrome ───────────────────────────────────────────────────────── */

  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 300);
    }, kind === 'err' ? 6000 : 2600);
  }

  function modal(title, bodyHtml, buttons) {
    const d = $('#modal');
    d.innerHTML =
      `<div class="dh">${esc(title)}</div><div class="db">${bodyHtml}</div>` +
      `<div class="df">${buttons
        .map((b, i) => `<button class="btn ${b.cls || ''}" data-mi="${i}">${esc(b.label)}</button>`)
        .join('')}</div>`;
    d.showModal();
    return new Promise((res) => {
      d.onclick = (e) => {
        const b = e.target.closest('[data-mi]');
        if (!b) return;
        const btn = buttons[+b.dataset.mi];
        if (btn.keepOpen) return res({ action: btn.action, dialog: d });
        d.close();
        res({ action: btn.action, dialog: d });
      };
      d.oncancel = () => res({ action: 'cancel' });
    });
  }

  const isDirty = () => JSON.stringify(S.content) !== JSON.stringify(S.saved) || S.pending.size > 0;

  function markDirty() {
    const d = isDirty();
    $('#dirty').classList.toggle('on', d);
    if (d) saveDraftSoon();
    refreshPreviewSoon();
  }

  let draftTimer;
  const saveDraftSoon = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const ok = AdminStore.draft.save(S.content);
      $('#savedAt').textContent = ok
        ? 'draft saved ' + new Date().toLocaleTimeString()
        : 'draft too large to autosave';
    }, 700);
  };

  /* ── sections ─────────────────────────────────────────────────────── */

  const SECTIONS = [
    { id: 'overview', label: 'Overview', grp: 'Content' },
    { id: 'profile', label: 'Profile & hero' },
    { id: 'projects', label: 'Projects', count: (c) => c.projects.length },
    { id: 'side', label: 'Side builds', count: (c) => c.sideProjects.length },
    { id: 'experience', label: 'Experience', count: (c) => c.experience.length },
    { id: 'stack', label: 'Tech stack', count: (c) => c.stack.reduce((n, r) => n + r.items.length, 0) },
    { id: 'honors', label: 'Honors', count: (c) => c.honors.length },
    { id: 'ride', label: 'The Ride' },
    { id: 'contact', label: 'Contact' },
    { id: 'chapters', label: 'Cinematic hero', count: (c) => c.chapters.length, grp: 'Site' },
    { id: 'seo', label: 'SEO & meta' },
    { id: 'settings', label: 'Settings', grp: 'System' }
  ];

  function drawSidebar() {
    let html = '';
    SECTIONS.forEach((s) => {
      if (s.grp) html += `<div class="grp">${s.grp}</div>`;
      const n = s.count ? s.count(S.content) : null;
      html +=
        `<button data-sec="${s.id}" class="${S.section === s.id ? 'on' : ''}">` +
        `<span>${esc(s.label)}</span>${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
    });
    $('#side').innerHTML = html;
  }

  /* ── field builders ───────────────────────────────────────────────── */

  const fText = (label, path, o = {}) =>
    `<div class="f"><label>${esc(label)}${o.opt ? ' <span class="opt">optional</span>' : ''}</label>
     <input type="${o.type || 'text'}" data-path="${path}" value="${esc(get(path))}"
       ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.mono ? 'class="mono"' : ''}>
     ${o.help ? `<p class="help">${o.help}</p>` : ''}</div>`;

  const fArea = (label, path, o = {}) =>
    `<div class="f"><label>${esc(label)}${o.opt ? ' <span class="opt">optional</span>' : ''}</label>
     <textarea data-path="${path}" rows="${o.rows || 3}"
       ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(get(path))}</textarea>
     ${o.help ? `<p class="help">${o.help}</p>` : ''}</div>`;

  const fSel = (label, path, opts) =>
    `<div class="f"><label>${esc(label)}</label><select data-path="${path}">
     ${opts
       .map((o) => `<option value="${esc(o.v)}" ${get(path) === o.v ? 'selected' : ''}>${esc(o.t)}</option>`)
       .join('')}</select></div>`;

  const fSwitch = (label, path) =>
    `<div class="f"><label class="sw"><input type="checkbox" data-path="${path}" data-bool
       ${get(path) ? 'checked' : ''}><span>${esc(label)}</span></label></div>`;

  const fTags = (label, path, help) => {
    const items = get(path) || [];
    return `<div class="f"><label>${esc(label)}</label>
      <div class="tags" data-tags="${path}">
        ${items
          .map(
            (t, i) =>
              `<span class="tag" draggable="true" data-ti="${i}"><b>${esc(t)}</b>` +
              `<button type="button" data-tagdel="${i}" aria-label="Remove">×</button></span>`
          )
          .join('')}
        <input type="text" placeholder="add…" data-tagadd>
      </div>${help ? `<p class="help">${help}</p>` : ''}</div>`;
  };

  /* Thumbnail resolves through the pending map so a just-picked image is
     visible before it has been published. */
  const thumb = (src) => {
    const p = S.pending.get(src);
    return p ? p.dataUrl : src ? '../' + src : '';
  };

  const fImg = (label, path, o = {}) => {
    const src = get(path);
    const pend = S.pending.has(src);
    const bg = thumb(src);
    return `<div class="f"><label>${esc(label)}</label>
      <div class="img">
        <div class="th" style="${bg ? `background-image:url('${bg}')` : ''}">${bg ? '' : 'no image'}</div>
        <div class="meta">
          <p class="path">${esc(src) || '—'}${pend ? ' <span class="new">• new, not published</span>' : ''}</p>
          <button class="btn sm" type="button" data-img="${path}" data-maxw="${o.maxW || 1600}"
            data-name="${esc(o.name || '')}">Replace image…</button>
          ${o.help ? `<p class="help">${o.help}</p>` : ''}
        </div>
      </div></div>`;
  };

  /* ── list scaffolding ─────────────────────────────────────────────── */

  function listBlock(name, arr, titleOf, bodyOf, addLabel) {
    if (!arr.length)
      return (
        `<div class="empty">Nothing here yet.</div>` +
        `<button class="btn pri" style="margin-top:12px" data-act="add" data-list="${name}">+ ${esc(addLabel)}</button>`
      );

    const items = arr
      .map((it, i) => {
        const key = name + ':' + (it.id || i);
        const open = S.open.has(key);
        return `<div class="item ${open ? 'open' : 'closed'}" draggable="true" data-list="${name}" data-i="${i}">
          <div class="item-h" data-toggle="${key}">
            <span class="gr">⠿</span>
            <span class="ix">${String(i + 1).padStart(2, '0')}</span>
            <span class="ti" data-title-for="${name}.${i}">${esc(titleOf(it, i))}</span>
            <button class="btn gh" type="button" data-act="up"  data-list="${name}" data-i="${i}" title="Move up">↑</button>
            <button class="btn gh" type="button" data-act="down" data-list="${name}" data-i="${i}" title="Move down">↓</button>
            <button class="btn gh" type="button" data-act="dup"  data-list="${name}" data-i="${i}" title="Duplicate">⧉</button>
            <button class="btn gh" type="button" data-act="del"  data-list="${name}" data-i="${i}" title="Delete">✕</button>
          </div>
          <div class="item-b">${bodyOf(it, i)}</div>
        </div>`;
      })
      .join('');

    return (
      items +
      `<button class="btn pri" style="margin-top:6px" data-act="add" data-list="${name}">+ ${esc(addLabel)}</button>`
    );
  }

  const BLANK = {
    projects: () => ({
      id: 'p' + Date.now().toString(36),
      title: 'New project',
      tag: 'Category',
      tagColor: '',
      big: false,
      desc: 'What it does and the number that proves it.',
      image: '',
      imageAlt: '',
      fallback: { from: '#132033', to: '#0f1a2b', color: 'var(--cyan)', text: '◆' },
      codeUrl: '',
      liveUrl: '',
      chips: []
    }),
    sideProjects: () => ({
      id: 's' + Date.now().toString(36),
      meta: 'Category',
      title: 'New build',
      url: '',
      ariaLabel: '',
      desc: ''
    }),
    experience: () => ({
      id: 'x' + Date.now().toString(36),
      role: 'Role title',
      at: '@ Company',
      when: 'MON YEAR – MON YEAR',
      org: 'Company · Location',
      variant: '',
      bullets: ['What you shipped, with the impact number.'],
      photos: [],
      chips: []
    }),
    honors: () => ({ id: 'h' + Date.now().toString(36), icon: 'medal', title: 'New honor', desc: '' }),
    chapters: () => ({ sigil: '✦', subtitle: 'SUBTITLE', title: 'Chapter title', body: 'Chapter copy.' }),
    stack: () => ({ id: 'r' + Date.now().toString(36), name: 'New row', variant: '', items: [] })
  };

  /* ── section views ────────────────────────────────────────────────── */

  const VIEW = {};

  VIEW.overview = () => {
    const c = S.content;
    const stats = [
      ['Projects', c.projects.length],
      ['Side builds', c.sideProjects.length],
      ['Experience', c.experience.length],
      ['Stack items', c.stack.reduce((n, r) => n + r.items.length, 0)],
      ['Honors', c.honors.length],
      ['Hero chapters', c.chapters.length]
    ];
    const gh = S.secrets.token ? `${S.secrets.owner}/${S.secrets.repo}` : null;
    return `<h2 class="hd">Overview</h2>
      <p class="hd-sub">Edit here, hit <b>Publish</b>, and the site rebuilds itself. Publishing
        regenerates <span class="mono">index.html</span> from <span class="mono">content.json</span> —
        you never touch the markup.</p>
      <div class="card"><div class="row">
        ${stats
          .map(
            (s) =>
              `<div style="min-width:120px"><div style="font:600 26px/1 var(--sans)">${s[1]}</div>
               <div style="font:11px/1 var(--mono);color:var(--tx3);margin-top:6px;text-transform:uppercase;letter-spacing:.08em">${s[0]}</div></div>`
          )
          .join('')}
      </div></div>
      <div class="card">
        <div class="f"><label>Publish target</label></div>
        <dl class="kv">
          <dt>mode</dt><dd>${gh ? 'GitHub — commits and auto-deploys' : 'Local — writes or downloads files'}</dd>
          ${gh ? `<dt>repo</dt><dd>${esc(gh)} <span style="color:var(--tx3)">@ ${esc(S.secrets.branch || 'main')}</span></dd>` : ''}
          <dt>pending images</dt><dd>${S.pending.size}</dd>
        </dl>
        ${!gh ? `<p class="help" style="margin-top:12px">Connect a repo in <b>Settings</b> to publish straight from the browser.</p>` : ''}
      </div>`;
  };

  VIEW.profile = () => `
    <h2 class="hd">Profile &amp; hero</h2>
    <p class="hd-sub">The bento block at the top of the page. Prose fields accept inline HTML —
      <span class="mono">&lt;b&gt;</span> for emphasis, <span class="mono">&lt;span class="it"&gt;</span> for the italic accent.</p>
    <div class="card">
      <div class="row">${fText('First name', 'profile.firstName')}${fText('Last name', 'profile.lastName')}</div>
      ${fText('Availability pill', 'profile.availability')}
      ${fText('Kicker line', 'profile.kicker')}
      ${fArea('Tagline', 'profile.tagline', { rows: 4, help: 'Inline HTML allowed.' })}
      ${fText('Résumé link', 'profile.resumeUrl', { type: 'url' })}
    </div>
    <div class="card">
      ${fImg('Profile photo', 'profile.photo', { maxW: 900, name: 'profile', help: 'Portrait crop works best.' })}
      ${fText('Photo alt text', 'profile.photoAlt')}
      <div class="row">${fText('Location chip', 'profile.locationChip')}${fText('Photo caption', 'profile.photoCaption')}</div>
      ${fText('Photo role line', 'profile.photoRole')}
    </div>
    <div class="card">
      <div class="row">
        ${fText('Primary button', 'profile.ctaPrimary.label')}${fText('Primary link', 'profile.ctaPrimary.href')}
      </div>
      <div class="row">
        ${fText('Secondary button', 'profile.ctaSecondary.label')}${fText('Secondary link', 'profile.ctaSecondary.href')}
      </div>
    </div>
    <div class="card">
      <div class="f"><label>“Now” tile</label></div>
      ${fText('Label', 'now.label')}
      ${fText('Title', 'now.title', { help: 'Inline HTML allowed.' })}
      ${fArea('Description', 'now.desc', { rows: 2 })}
    </div>
    <div class="card">
      <div class="f"><label>“Current obsession” tile</label></div>
      <div class="row">${fText('Label', 'core.label')}${fText('Title', 'core.title')}</div>
      ${fText('Subtitle', 'core.subtitle')}
    </div>
    <div class="card">
      <div class="f"><label>Stats strip</label></div>
      ${S.content.stats
        .map(
          (s, i) =>
            `<div class="row">${fText('Value ' + (i + 1), `stats.${i}.value`)}${fText('Label ' + (i + 1), `stats.${i}.label`)}</div>`
        )
        .join('')}
    </div>
    <div class="card">${fTags('Hero marquee', 'heroMarquee', 'The scrolling ribbon in the bento. Drag to reorder.')}</div>
    <div class="card">
      <div class="f"><label>Social links</label></div>
      ${S.content.socials
        .map((s, i) => `<div class="row">${fText(s.label, `socials.${i}.url`, { type: 'url' })}</div>`)
        .join('')}
    </div>`;

  VIEW.projects = () =>
    `<h2 class="hd">Projects</h2>
     <p class="hd-sub">Drag a card by its header — or use ↑ ↓ — to change the order they appear on the site.
       “Featured” makes a card span two columns.</p>` +
    listBlock(
      'projects',
      S.content.projects,
      (p) => p.title,
      (p, i) => `
        <div class="row">${fText('Title', `projects.${i}.title`)}${fText('Tag', `projects.${i}.tag`)}</div>
        ${fArea('Description', `projects.${i}.desc`, { rows: 3, help: 'Inline HTML allowed.' })}
        ${fTags('Tech chips', `projects.${i}.chips`)}
        <div class="row">
          ${fText('Code URL', `projects.${i}.codeUrl`, { type: 'url', opt: true })}
          ${fText('Live URL', `projects.${i}.liveUrl`, { type: 'url', opt: true })}
        </div>
        ${fSwitch('Featured (wide card)', `projects.${i}.big`)}
        ${fText('Preview image URL', `projects.${i}.image`, {
          opt: true,
          help: 'A GitHub social preview works well: https://opengraph.githubassets.com/1/user/repo'
        })}
        ${fText('Image alt', `projects.${i}.imageAlt`, { opt: true })}
        <div class="card" style="background:var(--panel2);margin:14px 0 0">
          <div class="f"><label>Fallback tile <span class="opt">shown while the image loads, or if it fails</span></label></div>
          <div class="row">
            ${fText('Gradient from', `projects.${i}.fallback.from`, { mono: true })}
            ${fText('Gradient to', `projects.${i}.fallback.to`, { mono: true })}
          </div>
          <div class="row">
            ${fText('Accent colour', `projects.${i}.fallback.color`, { mono: true })}
            ${fText('Glyph / text', `projects.${i}.fallback.text`)}
          </div>
          ${fText('Tag colour', `projects.${i}.tagColor`, { mono: true, opt: true })}
        </div>`,
      'Add project'
    );

  VIEW.side = () =>
    `<h2 class="hd">Side builds</h2>
     <p class="hd-sub">The smaller cards under the main grid.</p>` +
    listBlock(
      'sideProjects',
      S.content.sideProjects,
      (p) => p.title,
      (p, i) => `
        <div class="row">${fText('Title', `sideProjects.${i}.title`)}${fText('Category', `sideProjects.${i}.meta`)}</div>
        ${fArea('Description', `sideProjects.${i}.desc`, { rows: 2, help: 'Inline HTML allowed.' })}
        ${fText('Link', `sideProjects.${i}.url`, { type: 'url' })}
        ${fText('Link aria-label', `sideProjects.${i}.ariaLabel`, { help: 'Read aloud by screen readers, e.g. “Finance GPT on GitHub”.' })}`,
      'Add side build'
    );

  VIEW.experience = () =>
    `<h2 class="hd">Experience</h2>
     <p class="hd-sub">Internships and roles, newest first. Each entry can carry its own photo strip.</p>` +
    listBlock(
      'experience',
      S.content.experience,
      (x) => `${x.role} ${x.at}`,
      (x, i) => `
        <div class="row">${fText('Role', `experience.${i}.role`)}${fText('At', `experience.${i}.at`, { ph: '@ Company' })}</div>
        <div class="row">${fText('Dates', `experience.${i}.when`)}${fSel('Accent', `experience.${i}.variant`, [
          { v: '', t: 'Default' },
          { v: 'v', t: 'Alternate' }
        ])}</div>
        ${fText('Organisation line', `experience.${i}.org`)}
        <div class="f"><label>Bullets <span class="opt">inline HTML allowed</span></label>
          ${x.bullets
            .map(
              (b, j) =>
                `<div style="display:flex;gap:8px;margin-bottom:8px">
                   <textarea data-path="experience.${i}.bullets.${j}" rows="2" style="flex:1">${esc(b)}</textarea>
                   <button class="btn gh" type="button" data-act="delsub" data-list="experience.${i}.bullets" data-i="${j}" title="Remove">✕</button>
                 </div>`
            )
            .join('')}
          <button class="btn sm" type="button" data-act="addsub" data-list="experience.${i}.bullets" data-kind="string">+ Add bullet</button>
        </div>
        ${fTags('Tech chips', `experience.${i}.chips`)}
        <div class="f"><label>Photos <span class="opt">resized and compressed on upload</span></label>
          <div class="gal">
            ${x.photos
              .map(
                (ph, j) => `<div class="cell">
                  <div class="th" style="background-image:url('${thumb(ph.src)}')"></div>
                  <input type="text" data-path="experience.${i}.photos.${j}.caption" value="${esc(ph.caption)}" placeholder="caption">
                  <button class="btn sm rm" type="button" data-act="delsub" data-list="experience.${i}.photos" data-i="${j}">Remove</button>
                </div>`
              )
              .join('')}
            <div class="cell">
              <button class="btn sm" type="button" data-addphoto="experience.${i}.photos"
                style="width:132px;height:88px;justify-content:center">+ Photo</button>
            </div>
          </div>
        </div>`,
      'Add experience'
    );

  VIEW.stack = () =>
    `<h2 class="hd">Tech stack</h2>
     <p class="hd-sub">Three scrolling rows. Type a technology and press Enter to add it; drag a chip to reorder.</p>` +
    listBlock(
      'stack',
      S.content.stack,
      (r) => `${r.name} — ${r.items.length} items`,
      (r, i) => `
        <div class="row">${fText('Row name', `stack.${i}.name`, { help: 'Internal label only.' })}
        ${fSel('Direction', `stack.${i}.variant`, [
          { v: '', t: 'Left, normal speed' },
          { v: 'rev', t: 'Right (reversed)' },
          { v: 'am', t: 'Left, slower' }
        ])}</div>
        ${fTags('Technologies', `stack.${i}.items`)}`,
      'Add row'
    );

  VIEW.honors = () =>
    `<h2 class="hd">Honors</h2><p class="hd-sub">Certifications and awards.</p>` +
    listBlock(
      'honors',
      S.content.honors,
      (h) => h.title,
      (h, i) => `
        ${fText('Title', `honors.${i}.title`)}
        ${fArea('Description', `honors.${i}.desc`, { rows: 2 })}
        ${fSel('Icon', `honors.${i}.icon`, [
          { v: 'medal', t: 'Medal' },
          { v: 'pen', t: 'Pen' },
          { v: 'globe', t: 'Globe' },
          { v: 'star', t: 'Star' },
          { v: 'code', t: 'Code' }
        ])}`,
      'Add honor'
    );

  VIEW.ride = () => `
    <h2 class="hd">The Ride</h2>
    <p class="hd-sub">The personal section between the stack and honors.</p>
    <div class="card">
      ${fImg('Background photo', 'ride.image', { maxW: 1800, name: 'ride' })}
      ${fText('Photo alt', 'ride.imageAlt')}
    </div>
    <div class="card">
      ${fText('Label', 'ride.label')}
      ${fText('Heading', 'ride.title', { help: 'Inline HTML allowed.' })}
      ${S.content.ride.paragraphs
        .map(
          (p, j) =>
            `<div class="f"><label>Paragraph ${j + 1}</label>
              <div style="display:flex;gap:8px">
                <textarea data-path="ride.paragraphs.${j}" rows="3" style="flex:1">${esc(p)}</textarea>
                <button class="btn gh" type="button" data-act="delsub" data-list="ride.paragraphs" data-i="${j}">✕</button>
              </div></div>`
        )
        .join('')}
      <button class="btn sm" type="button" data-act="addsub" data-list="ride.paragraphs" data-kind="string">+ Add paragraph</button>
      <div style="height:14px"></div>
      ${fTags('Chips', 'ride.chips')}
      ${fText('Corner caption', 'ride.caption')}
    </div>`;

  VIEW.contact = () => `
    <h2 class="hd">Contact</h2><p class="hd-sub">The closing card and its copy-to-clipboard details.</p>
    <div class="card">
      ${fText('Kicker', 'contact.kicker')}
      ${fArea('Heading', 'contact.heading', { rows: 2, help: 'Inline HTML allowed — <br> for the line break.' })}
      ${fArea('Lead paragraph', 'contact.lead', { rows: 3 })}
      <div class="row">${fText('Button label', 'contact.ctaLabel')}${fText('Button link', 'contact.ctaHref')}</div>
    </div>
    ${S.content.contact.cards
      .map(
        (cd, i) => `<div class="card">
          <div class="row">${fText('Label', `contact.cards.${i}.label`)}${fText('Shown value', `contact.cards.${i}.value`)}</div>
          <div class="row">${fText('Copied value', `contact.cards.${i}.copy`, {
            help: 'What lands on the clipboard.'
          })}${fSel('Icon', `contact.cards.${i}.icon`, [
          { v: 'mail', t: 'Mail' },
          { v: 'phone', t: 'Phone' },
          { v: 'pin', t: 'Location' }
        ])}</div>
        </div>`
      )
      .join('')}
    <div class="card">
      <div class="f"><label>Footer</label></div>
      ${fArea('Line 1', 'footer.line1', { rows: 2 })}
      ${fArea('Line 2', 'footer.line2', { rows: 2 })}
      ${fArea('Closing quote', 'footer.quote', { rows: 2 })}
    </div>`;

  VIEW.chapters = () =>
    `<h2 class="hd">Cinematic hero</h2>
     <p class="hd-sub">The scroll-scrubbed intro. Each chapter is one beat as the video plays;
       the first is also what shows without JavaScript and under reduced motion.</p>` +
    listBlock(
      'chapters',
      S.content.chapters,
      (ch) => `${ch.sigil}  ${ch.title}`,
      (ch, i) => `
        <div class="row">${fText('Sigil', `chapters.${i}.sigil`)}${fText('Subtitle', `chapters.${i}.subtitle`)}</div>
        ${fText('Title', `chapters.${i}.title`)}
        ${fArea('Body', `chapters.${i}.body`, { rows: 3 })}`,
      'Add chapter'
    );

  VIEW.seo = () => `
    <h2 class="hd">SEO &amp; meta</h2>
    <p class="hd-sub">Title, description and the link-preview card people see when the site is shared.</p>
    <div class="card">
      ${fText('Page title', 'meta.title')}
      ${fArea('Description', 'meta.description', { rows: 3, help: 'Around 155 characters reads best in search results.' })}
      ${fArea('Keywords', 'meta.keywords', { rows: 2 })}
      <div class="row">${fText('Author', 'meta.author')}${fText('Theme colour', 'meta.themeColor', { mono: true })}</div>
      ${fText('Site URL', 'meta.siteUrl', {
        type: 'url',
        help: 'Also appears in robots.txt and sitemap.xml — update those by hand if you change hosts.'
      })}
    </div>
    <div class="card">
      <div class="f"><label>Link preview (Open Graph / Twitter)</label></div>
      ${fText('OG title', 'meta.ogTitle')}
      ${fArea('OG description', 'meta.ogDescription', { rows: 2 })}
      ${fText('OG image path', 'meta.ogImage', { mono: true })}
      ${fText('OG image alt', 'meta.ogImageAlt')}
    </div>`;

  VIEW.settings = () => {
    const s = S.secrets;
    const connected = !!s.token;
    return `<h2 class="hd">Settings</h2>
      <p class="hd-sub">Where Publish sends your changes.</p>
      <div class="note ${connected ? 'info' : 'warn'}">
        <div>${
          connected
            ? `Connected to <b>${esc(s.owner)}/${esc(s.repo)}</b> on branch <b>${esc(s.branch || 'main')}</b>.
               Publishing commits directly and Vercel redeploys on its own.`
            : `No repo connected. Publish will write files locally instead — into the folder you pick,
               or to your Downloads. Add a token below to publish straight from here.`
        }</div>
      </div>
      <div class="card">
        <div class="f"><label>GitHub repository</label></div>
        <div class="row">
          <div class="f"><label>Owner</label><input type="text" id="ghOwner" value="${esc(s.owner || '')}" placeholder="yugankfatehpuria4"></div>
          <div class="f"><label>Repo</label><input type="text" id="ghRepo" value="${esc(s.repo || '')}" placeholder="portfolio"></div>
          <div class="f"><label>Branch</label><input type="text" id="ghBranch" value="${esc(s.branch || 'main')}" placeholder="main"></div>
        </div>
        <div class="f"><label>Fine-grained access token</label>
          <input type="password" id="ghToken" value="${esc(s.token || '')}" placeholder="github_pat_…" class="mono">
          <p class="help">Create at <b>GitHub → Settings → Developer settings → Fine-grained tokens</b>.
            Scope it to this one repository with <b>Contents: Read and write</b> — nothing else.
            It is encrypted with your passphrase before it touches storage, and never leaves your browser
            except to call api.github.com.</p>
        </div>
        <div style="display:flex;gap:9px;margin-top:14px">
          <button class="btn" id="btnTestGh">Test connection</button>
          <button class="btn pri" id="btnSaveGh">Save</button>
          ${connected ? `<button class="btn dang" id="btnClearGh">Disconnect</button>` : ''}
        </div>
      </div>
      <div class="card">
        <div class="f"><label>Local publishing</label></div>
        <p class="help" style="margin-bottom:12px">Without a repo connected, Publish writes the changed files
          straight into your project folder${
            AdminStore.targets.local.available() ? '' : ' — unavailable in this browser, so files download instead'
          }.</p>
        ${
          AdminStore.targets.local.available()
            ? `<button class="btn" id="btnPickDir">Choose project folder…</button>
               <span class="mono" style="margin-left:10px;color:var(--tx3)" id="dirName">${
                 AdminStore.targets.local.handle ? esc(AdminStore.targets.local.handle.name) : 'not chosen'
               }</span>`
            : ''
        }
      </div>
      <div class="card">
        <div class="f"><label>Danger zone</label></div>
        <p class="help" style="margin-bottom:12px">Forgets the passphrase, the stored token and any unpublished draft
          in this browser. Your published site is untouched.</p>
        <button class="btn dang" id="btnReset">Reset admin</button>
      </div>`;
  };

  function draw() {
    $('#editor').innerHTML = (VIEW[S.section] || VIEW.overview)();
    drawSidebar();
    $('#editor').scrollTop = 0;
  }

  /* ── events ───────────────────────────────────────────────────────── */

  // typing: write through, never redraw
  $('#editor').addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.path) {
      set(el.dataset.path, el.dataset.bool !== undefined ? el.checked : el.value);
      const m = el.dataset.path.match(/^([a-zA-Z]+)\.(\d+)\./);
      if (m) {
        const t = $(`[data-title-for="${m[1]}.${m[2]}"]`);
        if (t) {
          const it = S.content[m[1]][m[2]];
          t.textContent = it.title || `${it.role || ''} ${it.at || ''}`.trim() || it.name || '';
        }
      }
      markDirty();
    }
  });
  $('#editor').addEventListener('change', (e) => {
    if (e.target.dataset.path && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) {
      set(e.target.dataset.path, e.target.dataset.bool !== undefined ? e.target.checked : e.target.value);
      markDirty();
    }
  });

  $('#side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    S.section = b.dataset.sec;
    draw();
  });

  $('#editor').addEventListener('click', async (e) => {
    const tog = e.target.closest('[data-toggle]');
    if (tog && !e.target.closest('.btn')) {
      const k = tog.dataset.toggle;
      S.open.has(k) ? S.open.delete(k) : S.open.add(k);
      tog.closest('.item').classList.toggle('open');
      tog.closest('.item').classList.toggle('closed');
      return;
    }

    const act = e.target.closest('[data-act]');
    if (act) return handleAct(act);

    const tagDel = e.target.closest('[data-tagdel]');
    if (tagDel) {
      const path = tagDel.closest('[data-tags]').dataset.tags;
      get(path).splice(+tagDel.dataset.tagdel, 1);
      markDirty();
      return draw();
    }

    const img = e.target.closest('[data-img]');
    if (img) return pickImage(img.dataset.img, +img.dataset.maxw, img.dataset.name);

    const addPhoto = e.target.closest('[data-addphoto]');
    if (addPhoto) return pickPhoto(addPhoto.dataset.addphoto);

    if (e.target.id === 'btnSaveGh') return saveGh();
    if (e.target.id === 'btnTestGh') return testGh();
    if (e.target.id === 'btnClearGh') return clearGh();
    if (e.target.id === 'btnPickDir') return pickDir();
    if (e.target.id === 'btnReset') return resetAdmin();
  });

  // tag input: Enter adds, Backspace on empty removes the last
  $('#editor').addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-tagadd]')) return;
    const path = e.target.closest('[data-tags]').dataset.tags;
    const arr = get(path);
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      arr.push(v);
      markDirty();
      draw();
      // put the caret back in the same tag box
      const box = $(`[data-tags="${path}"] [data-tagadd]`);
      if (box) box.focus();
    } else if (e.key === 'Backspace' && !e.target.value && arr.length) {
      arr.pop();
      markDirty();
      draw();
      const box = $(`[data-tags="${path}"] [data-tagadd]`);
      if (box) box.focus();
    }
  });

  function handleAct(el) {
    const { act, list, i, kind } = el.dataset;
    const idx = +i;

    if (act === 'add') {
      S.content[list].push(BLANK[list]());
      const it = S.content[list][S.content[list].length - 1];
      S.open.add(list + ':' + (it.id || S.content[list].length - 1));
      markDirty();
      return draw();
    }
    if (act === 'addsub') {
      get(list).push(kind === 'string' ? '' : {});
      markDirty();
      return draw();
    }
    if (act === 'delsub') {
      get(list).splice(idx, 1);
      markDirty();
      return draw();
    }

    const arr = S.content[list];
    if (act === 'up' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    if (act === 'down' && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    if (act === 'dup') {
      const copy = clone(arr[idx]);
      copy.id = (copy.id || 'i') + '-' + Date.now().toString(36).slice(-4);
      arr.splice(idx + 1, 0, copy);
    }
    if (act === 'del') {
      if (!confirm(`Delete “${arr[idx].title || arr[idx].role || arr[idx].name || 'this item'}”?`)) return;
      arr.splice(idx, 1);
    }
    markDirty();
    draw();
  }

  /* drag to reorder — list items and stack chips share one handler */
  let dragSrc = null;
  $('#editor').addEventListener('dragstart', (e) => {
    const item = e.target.closest('.item[draggable], .tag[draggable]');
    if (!item) return;
    dragSrc = item;
    item.classList.add('drag');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  $('#editor').addEventListener('dragend', () => {
    if (dragSrc) dragSrc.classList.remove('drag');
    $$('.over').forEach((x) => x.classList.remove('over'));
    dragSrc = null;
  });
  $('#editor').addEventListener('dragover', (e) => {
    if (!dragSrc) return;
    const over = e.target.closest('.item, .tag');
    if (!over || over === dragSrc) return;
    const sameKind = over.className.split(' ')[0] === dragSrc.className.split(' ')[0];
    if (!sameKind) return;
    e.preventDefault();
    $$('.over').forEach((x) => x.classList.remove('over'));
    over.classList.add('over');
  });
  $('#editor').addEventListener('drop', (e) => {
    if (!dragSrc) return;
    const over = e.target.closest('.item, .tag');
    if (!over || over === dragSrc) return;
    e.preventDefault();

    if (dragSrc.classList.contains('item')) {
      const listName = dragSrc.dataset.list;
      if (over.dataset.list !== listName) return;
      const arr = S.content[listName];
      const [moved] = arr.splice(+dragSrc.dataset.i, 1);
      arr.splice(+over.dataset.i, 0, moved);
    } else {
      const path = dragSrc.closest('[data-tags]').dataset.tags;
      if (over.closest('[data-tags]').dataset.tags !== path) return;
      const arr = get(path);
      const [moved] = arr.splice(+dragSrc.dataset.ti, 1);
      arr.splice(+over.dataset.ti, 0, moved);
    }
    markDirty();
    draw();
  });

  /* ── images ───────────────────────────────────────────────────────── */

  function chooseFile() {
    return new Promise((res) => {
      const inp = $('#filePick');
      inp.value = '';
      inp.onchange = () => res(inp.files[0] || null);
      inp.click();
    });
  }

  async function pickImage(path, maxW, name) {
    const file = await chooseFile();
    if (!file) return;
    try {
      const img = await AdminStore.processImage(file, { maxW, maxH: maxW, name: name || path.split('.').pop() });
      S.pending.set(img.path, img);
      set(path, img.path);
      toast(`Image ready — ${(img.size / 1024).toFixed(0)} KB, ${img.width}×${img.height}`);
      markDirty();
      draw();
    } catch (err) {
      toast('Could not read that image: ' + err.message, 'err');
    }
  }

  async function pickPhoto(listPath) {
    const file = await chooseFile();
    if (!file) return;
    try {
      const img = await AdminStore.processImage(file, { maxW: 900, maxH: 900, name: 'photo' });
      S.pending.set(img.path, img);
      get(listPath).push({ src: img.path, alt: '', caption: '// caption' });
      toast(`Photo added — ${(img.size / 1024).toFixed(0)} KB`);
      markDirty();
      draw();
    } catch (err) {
      toast('Could not read that image: ' + err.message, 'err');
    }
  }

  /* ── preview ──────────────────────────────────────────────────────── */

  async function template() {
    if (!S.template) {
      const r = await fetch('../index.html', { cache: 'no-store' });
      if (!r.ok) throw new Error('could not read index.html (' + r.status + ')');
      S.template = await r.text();
    }
    return S.template;
  }

  /* The preview is the real artifact: same renderer, same template. Only
     two substitutions are made — a <base> so relative paths resolve from
     /admin/, and pending images swapped to their data URLs since they are
     not on disk yet. */
  async function buildPreview() {
    let html = PortfolioRender.build(S.content, await template());
    html = html.replace('<head>', '<head>\n<base href="../">');
    S.pending.forEach((img, path) => {
      html = html.split('"' + path + '"').join('"' + img.dataUrl + '"');
    });
    return html;
  }

  let previewTimer;
  function refreshPreviewSoon() {
    if (!$('#preview').classList.contains('on')) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 600);
  }

  async function refreshPreview() {
    try {
      $('#frame').srcdoc = await buildPreview();
    } catch (err) {
      toast('Preview failed: ' + err.message, 'err');
    }
  }

  $('#btnPreview').onclick = () => {
    const on = $('#preview').classList.toggle('on');
    $('#editor').classList.toggle('split', on);
    if (on) refreshPreview();
  };
  $('#btnRefresh').onclick = refreshPreview;

  /* ── publish ──────────────────────────────────────────────────────── */

  async function collectFiles() {
    const html = PortfolioRender.build(S.content, await template());
    const files = [
      { path: 'content.json', text: JSON.stringify(S.content, null, 2) + '\n' },
      { path: 'index.html', text: html }
    ];
    S.pending.forEach((img, path) => files.push({ path, bytes: img.bytes }));
    return files;
  }

  async function publish() {
    const btn = $('#btnPublish');
    btn.disabled = true;
    const log = [];
    const push = (m) => {
      log.push('• ' + m);
      const el = $('#pubLog');
      if (el) el.textContent = log.join('\n');
    };

    try {
      $('#status').textContent = 'building…';
      const files = await collectFiles();

      const gh = S.secrets.token ? S.secrets : null;
      const summary =
        `<p style="margin:0 0 14px;line-height:1.6">` +
        (gh
          ? `Commit <b>${files.length}</b> file(s) to <b>${esc(gh.owner)}/${esc(gh.repo)}</b> on
             <b>${esc(gh.branch || 'main')}</b>. Vercel will redeploy automatically.`
          : `Write <b>${files.length}</b> file(s) ${
              AdminStore.targets.local.handle ? 'into <b>' + esc(AdminStore.targets.local.handle.name) + '</b>' : 'locally'
            }.`) +
        `</p><div class="log" id="pubLog">${files.map((f) => '  ' + f.path).join('\n')}</div>`;

      const res = await modal('Publish changes', summary, [
        { label: 'Cancel', action: 'cancel' },
        { label: gh ? 'Commit & deploy' : 'Write files', action: 'go', cls: 'ok', keepOpen: true }
      ]);
      if (res.action !== 'go') {
        btn.disabled = false;
        $('#status').textContent = '';
        return;
      }

      let out;
      if (gh) {
        out = await AdminStore.targets.github.write(files, gh, push);
      } else if (AdminStore.targets.local.handle) {
        push('writing files');
        out = await AdminStore.targets.local.write(files);
      } else if (AdminStore.targets.local.available()) {
        push('choose your project folder');
        await AdminStore.targets.local.connect();
        out = await AdminStore.targets.local.write(files);
      } else {
        push('downloading');
        out = await AdminStore.targets.download.write(files);
      }

      res.dialog.close();

      // published: this is the new baseline
      S.pending.clear();
      S.saved = clone(S.content);
      S.template = null; // index.html changed; re-read it next time
      AdminStore.draft.clear();
      markDirty();
      draw();

      $('#status').textContent = 'published ' + new Date().toLocaleTimeString();
      toast(
        out.sha ? `Committed ${out.sha} to ${out.where} — Vercel is deploying.` : `Wrote ${out.written} file(s).`,
        'ok'
      );
    } catch (err) {
      $('#status').textContent = '';
      const d = $('#modal');
      if (d.open) d.close();
      toast('Publish failed: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  $('#btnPublish').onclick = publish;

  /* ── settings actions ─────────────────────────────────────────────── */

  const ghFromForm = () => ({
    owner: $('#ghOwner').value.trim(),
    repo: $('#ghRepo').value.trim(),
    branch: $('#ghBranch').value.trim() || 'main',
    token: $('#ghToken').value.trim()
  });

  async function testGh() {
    const cfg = ghFromForm();
    if (!cfg.owner || !cfg.repo || !cfg.token) return toast('Owner, repo and token are all required.', 'err');
    try {
      $('#btnTestGh').disabled = true;
      const info = await AdminStore.targets.github.verify(cfg);
      toast(`Connected to ${info.repo} @ ${info.branch}${info.private ? ' (private)' : ''}.`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      $('#btnTestGh').disabled = false;
    }
  }

  async function saveGh() {
    const cfg = ghFromForm();
    try {
      if (cfg.token) await AdminStore.targets.github.verify(cfg);
      S.secrets = cfg;
      await AdminStore.saveSecrets(S.pass, S.secrets);
      toast('Settings saved.', 'ok');
      draw();
    } catch (err) {
      toast('Not saved — ' + err.message, 'err');
    }
  }

  async function clearGh() {
    S.secrets = {};
    await AdminStore.saveSecrets(S.pass, {});
    toast('Repo disconnected.');
    draw();
  }

  async function pickDir() {
    try {
      const name = await AdminStore.targets.local.connect();
      $('#dirName').textContent = name;
      toast('Folder connected: ' + name, 'ok');
    } catch (err) {
      if (err.name !== 'AbortError') toast('Could not open that folder: ' + err.message, 'err');
    }
  }

  async function resetAdmin() {
    const r = await modal(
      'Reset admin?',
      `<p style="margin:0;line-height:1.6">This clears your passphrase, the stored GitHub token and any
       unpublished draft in this browser. Your published site is not affected.</p>`,
      [{ label: 'Cancel', action: 'cancel' }, { label: 'Reset', action: 'go', cls: 'dang' }]
    );
    if (r.action !== 'go') return;
    AdminStore.destroyVault();
    location.reload();
  }

  /* ── import / export / revert ─────────────────────────────────────── */

  $('#btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(S.content, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $('#btnImport').onclick = () => {
    const inp = $('#jsonPick');
    inp.value = '';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.projects || !data.profile) throw new Error('that file is not a portfolio content.json');
        S.content = data;
        markDirty();
        draw();
        toast('Imported.', 'ok');
      } catch (err) {
        toast('Import failed: ' + err.message, 'err');
      }
    };
    inp.click();
  };

  $('#btnRevert').onclick = async () => {
    if (!isDirty()) return toast('Nothing to revert.');
    const r = await modal(
      'Discard changes?',
      `<p style="margin:0;line-height:1.6">Everything since the last publish will be lost.</p>`,
      [{ label: 'Keep editing', action: 'cancel' }, { label: 'Discard', action: 'go', cls: 'dang' }]
    );
    if (r.action !== 'go') return;
    S.content = clone(S.saved);
    S.pending.clear();
    AdminStore.draft.clear();
    markDirty();
    draw();
  };

  $('#btnLock').onclick = () => {
    if (isDirty() && !confirm('You have unpublished changes. They stay saved as a draft. Lock anyway?')) return;
    location.reload();
  };

  addEventListener('beforeunload', (e) => {
    if (S.pending.size) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      publish();
    }
  });

  /* ── boot ─────────────────────────────────────────────────────────── */

  async function loadContent() {
    const r = await fetch('../content.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('content.json not found (' + r.status + ')');
    return r.json();
  }

  async function start(secrets, pass) {
    S.secrets = secrets || {};
    S.pass = pass;

    const live = await loadContent();
    S.saved = clone(live);

    const d = AdminStore.draft.load();
    if (d && JSON.stringify(d.content) !== JSON.stringify(live)) {
      const r = await modal(
        'Unpublished draft found',
        `<p style="margin:0;line-height:1.6">There are unpublished edits in this browser from
         <b>${new Date(d.at).toLocaleString()}</b>. Pick up where you left off, or start from the live site?</p>
         <p class="help" style="margin:12px 0 0">Any images you had picked need re-adding either way —
         image data is not kept in the draft.</p>`,
        [{ label: 'Start from live', action: 'live' }, { label: 'Restore draft', action: 'draft', cls: 'pri' }]
      );
      S.content = r.action === 'draft' ? d.content : clone(live);
      if (r.action === 'live') AdminStore.draft.clear();
    } else {
      S.content = clone(live);
    }

    $('#gate').hidden = true;
    $('#app').hidden = false;
    draw();
    markDirty();
  }

  /* lock screen: first visit sets a passphrase, later ones unlock */
  (function gate() {
    const first = !AdminStore.vaultExists();
    if (first) {
      $('#gateTitle').textContent = 'Set a passphrase';
      $('#gateSub').textContent = 'first run · this encrypts your publish token';
      $('#pw').autocomplete = 'new-password';
      $('#pw2Wrap').hidden = false;
      $('#gateBtn').textContent = 'Create';
      $('#gateHint').innerHTML =
        'Chosen once and stored nowhere — if you lose it, reset the panel and reconnect your repo. ' +
        'It encrypts the GitHub token this browser keeps.';
    } else {
      $('#gateHint').innerHTML = 'Locked to this browser. Forgotten it? Clear site data and set it up again.';
    }

    $('#gateForm').onsubmit = async (e) => {
      e.preventDefault();
      const pw = $('#pw').value;
      const err = $('#gateErr');
      err.textContent = '';
      if (!pw) return;

      $('#gateBtn').disabled = true;
      try {
        if (first) {
          if (pw.length < 8) throw new Error('Use at least 8 characters.');
          if (pw !== $('#pw2').value) throw new Error('The two passphrases do not match.');
          await AdminStore.createVault(pw, {});
          await start({}, pw);
        } else {
          const v = await AdminStore.unlockVault(pw);
          await start(v.secrets, pw);
        }
      } catch (ex) {
        err.textContent = ex.message === 'bad-passphrase' ? 'Wrong passphrase.' : ex.message;
        $('#gateBtn').disabled = false;
        $('#pw').select();
      }
    };
  })();
})();
