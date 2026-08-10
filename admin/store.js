/* ═══════════════════════════════════════════════════════════════════════
   store.js — the vault, image processing, and publish targets

   Threat model, stated plainly so it is not mistaken for more than it is:
   this is a static site, so everything here runs in the visitor's browser
   and anyone can read this file. The passphrase prompt is obscurity — it
   keeps the panel out of the way, nothing more.

   What *is* real protection is the GitHub token. It never ships in the
   repo; you paste it once and it is stored AES-GCM encrypted under a key
   derived from your passphrase with PBKDF2 (250k iterations). Without the
   passphrase the ciphertext is useless, and without the token nobody can
   write to your repo. Publishing capability is protected by cryptography;
   the UI gate is not, and is not meant to be.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const VAULT_KEY = 'yf.admin.vault.v1';
  const DRAFT_KEY = 'yf.admin.draft.v1';
  const PBKDF2_ROUNDS = 250000;
  const CHECK = 'portfolio-admin-ok';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = {
    from: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))),
    to: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  };

  /* ── vault ────────────────────────────────────────────────────────── */

  async function deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
      'deriveKey'
    ]);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  const vaultExists = () => !!localStorage.getItem(VAULT_KEY);

  /* Creates (or replaces) the vault. `secrets` holds the GitHub config;
     it may be empty if the owner only ever publishes locally. */
  async function createVault(passphrase, secrets) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const payload = enc.encode(JSON.stringify({ check: CHECK, secrets: secrets || {} }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
    localStorage.setItem(
      VAULT_KEY,
      JSON.stringify({ v: 1, salt: b64.from(salt), iv: b64.from(iv), ct: b64.from(ct) })
    );
    return { key, salt, secrets: secrets || {} };
  }

  /* Resolves to the decrypted secrets, or throws 'bad-passphrase'. A wrong
     key fails GCM's authentication tag, so no separate check is needed —
     the CHECK string only guards against a corrupted-but-valid decrypt. */
  async function unlockVault(passphrase) {
    const stored = JSON.parse(localStorage.getItem(VAULT_KEY) || 'null');
    if (!stored) throw new Error('no-vault');
    const salt = b64.to(stored.salt);
    const key = await deriveKey(passphrase, salt);
    let plain;
    try {
      plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.to(stored.iv) }, key, b64.to(stored.ct));
    } catch (e) {
      throw new Error('bad-passphrase');
    }
    const data = JSON.parse(dec.decode(plain));
    if (data.check !== CHECK) throw new Error('bad-passphrase');
    return { key, salt, secrets: data.secrets || {} };
  }

  async function saveSecrets(passphrase, secrets) {
    return createVault(passphrase, secrets);
  }

  const destroyVault = () => {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(DRAFT_KEY);
  };

  /* ── local draft (survives a reload; never contains secrets) ───────── */

  const draft = {
    save(content) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), content }));
        return true;
      } catch (e) {
        return false; // quota: large pending images
      }
    },
    load() {
      try {
        return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    clear: () => localStorage.removeItem(DRAFT_KEY)
  };

  /* ── images ───────────────────────────────────────────────────────────
     Downscaled and re-encoded in the browser so a 6 MB phone photo does
     not end up in the repo. Filenames carry a content hash because
     /media/* is served immutable for a year — a changed image must arrive
     under a new name or visitors keep the stale one until the cache
     expires. */

  const slugify = (s) =>
    String(s || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';

  async function sha8(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)]
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function processImage(file, opts) {
    const o = Object.assign({ maxW: 1600, maxH: 1600, quality: 0.82, name: '' }, opts);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, o.maxW / bitmap.width, o.maxH / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close && bitmap.close();

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', o.quality));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await sha8(bytes);
    const base = slugify(o.name || file.name.replace(/\.[^.]+$/, ''));

    return {
      path: `media/${base}-${hash}.jpg`,
      bytes,
      width: w,
      height: h,
      size: bytes.length,
      dataUrl: canvas.toDataURL('image/jpeg', o.quality)
    };
  }

  /* ── publish targets ──────────────────────────────────────────────────
     Both accept the same file list: [{path, text}] or [{path, bytes}].   */

  /* Writes straight into the working copy through the File System Access
     API. Chrome-only, and the owner picks the folder once per session. */
  const localTarget = {
    id: 'local',
    available: () => typeof window.showDirectoryPicker === 'function',
    handle: null,

    async connect() {
      this.handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'portfolio-root' });
      const perm = await this.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') throw new Error('permission-denied');
      return this.handle.name;
    },

    async write(files) {
      if (!this.handle) throw new Error('not-connected');
      for (const f of files) {
        const parts = f.path.split('/');
        const name = parts.pop();
        let dir = this.handle;
        for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(f.bytes ? f.bytes : f.text);
        await w.close();
      }
      return { written: files.length, where: this.handle.name };
    }
  };

  /* Falls back to plain downloads when the FSA API is unavailable; the
     owner drops the files into the repo themselves. */
  const downloadTarget = {
    id: 'download',
    available: () => true,
    async write(files) {
      for (const f of files) {
        const blob = f.bytes ? new Blob([f.bytes]) : new Blob([f.text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.path.split('/').pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 250)); // browsers throttle bursts
        URL.revokeObjectURL(url);
      }
      return { written: files.length, where: 'downloads' };
    }
  };

  /* One atomic commit via the Git Data API: blobs -> tree -> commit ->
     move the branch ref. Doing it through the simpler Contents API would
     mean one commit per file and a half-published state if any call
     failed midway. */
  const githubTarget = {
    id: 'github',
    available: () => true,

    async api(cfg, path, init) {
      const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init && init.body ? { 'Content-Type': 'application/json' } : {})
        }
      });
      if (!res.ok) {
        const body = await res.text();
        let msg = `GitHub ${res.status}`;
        try {
          msg += `: ${JSON.parse(body).message}`;
        } catch (e) {
          /* non-JSON error body */
        }
        if (res.status === 401) msg += ' — the token is invalid or expired.';
        if (res.status === 403) msg += ' — the token lacks Contents: write on this repo.';
        if (res.status === 404) msg += ' — repo or branch not found (check owner/repo and token scope).';
        throw new Error(msg);
      }
      return res.status === 204 ? null : res.json();
    },

    async verify(cfg) {
      const repo = await this.api(cfg, '');
      const branch = cfg.branch || repo.default_branch;
      await this.api(cfg, `/branches/${encodeURIComponent(branch)}`);
      return { repo: repo.full_name, branch, private: repo.private };
    },

    async write(files, cfg, onStep) {
      const step = onStep || (() => {});
      const branch = cfg.branch || 'main';

      step('reading branch');
      const ref = await this.api(cfg, `/git/ref/heads/${encodeURIComponent(branch)}`);
      const headSha = ref.object.sha;
      const headCommit = await this.api(cfg, `/git/commits/${headSha}`);

      step(`uploading ${files.length} file(s)`);
      const tree = [];
      for (const f of files) {
        const blob = await this.api(cfg, '/git/blobs', {
          method: 'POST',
          body: JSON.stringify(
            f.bytes
              ? { content: b64.from(f.bytes), encoding: 'base64' }
              : { content: f.text, encoding: 'utf-8' }
          )
        });
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      }

      step('building tree');
      const newTree = await this.api(cfg, '/git/trees', {
        method: 'POST',
        body: JSON.stringify({ base_tree: headCommit.tree.sha, tree })
      });

      step('committing');
      const commit = await this.api(cfg, '/git/commits', {
        method: 'POST',
        body: JSON.stringify({
          message: cfg.message || 'content: update portfolio via admin panel',
          tree: newTree.sha,
          parents: [headSha]
        })
      });

      step('moving branch');
      await this.api(cfg, `/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha })
      });

      return {
        written: files.length,
        where: `${cfg.owner}/${cfg.repo}@${branch}`,
        sha: commit.sha.slice(0, 7),
        url: commit.html_url
      };
    }
  };

  root.AdminStore = {
    vaultExists,
    createVault,
    unlockVault,
    saveSecrets,
    destroyVault,
    draft,
    processImage,
    slugify,
    sha8,
    targets: { local: localTarget, download: downloadTarget, github: githubTarget }
  };
})(window);
