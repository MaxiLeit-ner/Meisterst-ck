// Penthouse-Büro: Spielwelt der App. Zeichnet das Büro je Ausbaustufe und die Figur, die durch den Raum läuft.
// Jedes Bild ist eine reine Funktion der Zeit t.

// Shared helpers + style registry for the style-frame explorations.
// Every style is a pure function of time: draw(ctx, W, H, t). Same t => same pixels.
(function () {
  const STYLES = (window.STYLES = window.STYLES || []);
  window.registerStyle = (s) => STYLES.push(s);

  const H = (window.H = {});

  // ---------- seeded randomness ----------
  // H.rng(seed) -> r() in [0,1). Extras: r.range(a,b), r.int(a,b), r.pick(arr), r.gauss(), r.chance(p)
  H.rng = function (seed = 1) {
    let a = typeof seed === 'string' ? hashStr(seed) : (seed >>> 0) || 1;
    const r = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- gradient noise ----------
  // H.makeNoise(seed) -> { n2(x,y), n3(x,y,z), fbm2(x,y,oct), fbm3(x,y,z,oct) }  (outputs roughly -1..1)
  H.makeNoise = function (seed = 1) {
    const r = H.rng(seed), p = new Uint8Array(512), perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    const g3 = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
    function n3(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(lerp(lerp(g3(p[AA], x, y, z), g3(p[BA], x - 1, y, z), u), lerp(g3(p[AB], x, y - 1, z), g3(p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(g3(p[AA + 1], x, y, z - 1), g3(p[BA + 1], x - 1, y, z - 1), u), lerp(g3(p[AB + 1], x, y - 1, z - 1), g3(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }
    const n2 = (x, y) => n3(x, y, 0.5);
    const fbm3 = (x, y, z, oct = 4) => { let s = 0, a = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2; } return s / norm; };
    const fbm2 = (x, y, oct = 4) => fbm3(x, y, 0.5, oct);
    return { n2, n3, fbm2, fbm3 };
  };

  // ---------- math ----------
  H.lerp = (a, b, t) => a + (b - a) * t;
  H.clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  H.map = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
  H.smooth = (e0, e1, x) => { const t = H.clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  H.ease = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    back: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };

  // ---------- color ----------
  H.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  H.rgba = (hexOrArr, a = 1) => { const [r, g, b] = Array.isArray(hexOrArr) ? hexOrArr : H.hex(hexOrArr); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  H.mix = (c1, c2, t) => { const a = Array.isArray(c1) ? c1 : H.hex(c1), b = Array.isArray(c2) ? c2 : H.hex(c2); return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t); };

  // ---------- canvas utilities ----------
  // Offscreen canvas of the same logical size (use for layers, masks, compositing).
  H.layer = (W, H_, ) => { const c = document.createElement('canvas'); c.width = W; c.height = H_; return c; };
  // Monochrome grain / film noise over the whole canvas. amount ~ 0.03-0.15
  H.grain = function (ctx, W, Hh, amount = 0.08, seed = 7, mono = true) {
    const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), d = img.data, r = H.rng(seed), k = amount * 255;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * k;
      if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      else { d[i] += (r() - 0.5) * k; d[i + 1] += (r() - 0.5) * k; d[i + 2] += (r() - 0.5) * k; }
    }
    ctx.putImageData(img, 0, 0);
  };
  // Paper-ish texture tile: fills with base color + fibrous noise (cheap; drawn into ctx).
  H.paper = function (ctx, W, Hh, base = '#f3ecdc', seed = 3, strength = 0.06) {
    ctx.save(); ctx.fillStyle = base; ctx.fillRect(0, 0, W, Hh);
    const nz = H.makeNoise(seed), cell = 4, [br, bg, bb] = H.hex(base);
    for (let y = 0; y < Hh; y += cell) for (let x = 0; x < W; x += cell) {
      const v = nz.fbm2(x * 0.01, y * 0.01, 3) * 0.6 + nz.n2(x * 0.15, y * 0.04) * 0.4;
      const s = 1 + v * strength * 2;
      ctx.fillStyle = `rgb(${br * s | 0},${bg * s | 0},${bb * s | 0})`; ctx.fillRect(x, y, cell, cell);
    }
    ctx.restore();
  };
  // Vignette
  H.vignette = function (ctx, W, Hh, strength = 0.5, color = '0,0,0') {
    const g = ctx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.3, W / 2, Hh / 2, Math.hypot(W, Hh) * 0.6);
    g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${strength})`);
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh); ctx.restore();
  };

  // ---------- rendering entry ----------
  // Renders style into canvas at logical 1280x720 (canvas can be any pixel size; it is scaled).
  H.W = 1280; H.H = 720;
  H.loadFonts = async function (style) {
    const specs = style.fonts || [];
    try { const sample = 'AaZz09' + (window.FONT_SAMPLE || '');
      await Promise.all(specs.map((f) => document.fonts.load(f, sample))); await document.fonts.ready; } catch (e) { /* render anyway */ }
  };
  H.render = function (style, canvas, t) {
    const ctx = canvas.getContext('2d', { willReadFrequently: !!style.readsPixels });
    const sx = canvas.width / H.W, sy = canvas.height / H.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.scale(sx, sy);
    style.draw(ctx, H.W, H.H, t == null ? style.frameT || 0 : t);
    ctx.restore();
  };
})();


(function(){
  // ===== Penthouse-Büro: isometrischer Schnitt, moderner Look =====
  const T2 = Math.PI * 2;
  const rrc = (x, X, Y, w, h, r) => { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  const glo = (x, cx, cy, r, col, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, H.rgba(col, a)); g.addColorStop(1, H.rgba(col, 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, T2); x.fill(); };
  const tx = (x, s, cx, cy, px, col, o = {}) => { x.save(); x.font = `${o.w || 800} ${px}px "Manrope", "Nunito", sans-serif`; x.textAlign = o.align || 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, cx, cy); x.restore(); };
  const spk = (x, cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r); x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill(); };

  const C = { wall: '#e9e2d6', wallS: '#d9d0c1', wallD: '#cbc1b0', floor: '#d8c3a5', floor2: '#cdb595', slab: '#8d8a86', slabD: '#6f6c69',
    wood: ['#d9a777', '#b9855a', '#9c6c45'], black: ['#3a3d45', '#2a2c33', '#1d1f25'], white: ['#ffffff', '#ecebe8', '#d9d7d2'],
    green: ['#6fbf73', '#4f9e5a', '#3a7d45'], accent: '#ff7a59', accent2: '#3f7cff', glass: 'rgba(170,215,255,0.35)', sofa: ['#9fb4c7', '#7f97ad', '#677f96'], rug: '#b9c9b4' };

  const ISO = { ox: 300, oy: 300, tw: 82, th: 41 };
  const P = (i, j, z = 0) => [ISO.ox + (i - j) * ISO.tw / 2, ISO.oy + (i + j) * ISO.th / 2 - z];
  const poly = (x, pts, f, st) => { x.beginPath(); pts.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); if (f) { x.fillStyle = f; x.fill(); } if (st) { x.strokeStyle = st; x.lineWidth = 1.5; x.stroke(); } };
  function box(x, i, j, w, d, h, c, z0 = 0) {
    const A = P(i, j, z0 + h), B = P(i + w, j, z0 + h), Cc = P(i + w, j + d, z0 + h), D = P(i, j + d, z0 + h);
    poly(x, [D, Cc, P(i + w, j + d, z0), P(i, j + d, z0)], c[1]); poly(x, [Cc, B, P(i + w, j, z0), P(i + w, j + d, z0)], c[2]); poly(x, [A, B, Cc, D], c[0]);
  }
  // Fläche auf der hinteren Wand (Ebene j=jw), von i0..i1, Höhe z0..z1
  const wallQuad = (i0, i1, jw, z0, z1) => [P(i0, jw, z1), P(i1, jw, z1), P(i1, jw, z0), P(i0, jw, z0)];
  const wallQuadB = (j0, j1, iw, z0, z1) => [P(iw, j0, z1), P(iw, j1, z1), P(iw, j1, z0), P(iw, j0, z0)];

  function skyline(x, quad, night) {
    x.save(); x.beginPath(); quad.forEach((p, k) => k ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.clip();
    const ys = quad.map(p => p[1]), xs = quad.map(p => p[0]), y0 = Math.min(...ys), y1 = Math.max(...ys), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const g = x.createLinearGradient(0, y0, 0, y1);
    if (night) { g.addColorStop(0, '#1b2350'); g.addColorStop(1, '#ff9a6b'); } else { g.addColorStop(0, '#9fd3ff'); g.addColorStop(1, '#e8f4ff'); }
    x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
    const r = H.rng(night ? 8 : 4);
    for (let bx = x0; bx < x1; bx += r.range(16, 28)) {
      const bh = r.range(30, (y1 - y0) * 0.75), bw = r.range(14, 26);
      x.fillStyle = night ? '#2a2f55' : 'rgba(120,150,190,0.55)'; x.fillRect(bx, y1 - bh, bw, bh);
      if (night) for (let wy = y1 - bh + 6; wy < y1 - 4; wy += 9) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) if (r() < 0.45) { x.fillStyle = '#ffd98a'; x.fillRect(wx, wy, 2.5, 3.5); }
    }
    x.restore();
    // Fenstersprossen
    x.strokeStyle = '#2a2c33'; x.lineWidth = 3; x.beginPath(); quad.forEach((p, k) => k ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.stroke();
  }

  // ---------- Möbel ----------
  function desk(x, i, j, z = 0) { box(x, i, j, 1.6, 0.8, 4, C.wood, z + 30); box(x, i + 0.05, j + 0.05, 0.12, 0.7, 30, C.black, z); box(x, i + 1.43, j + 0.05, 0.12, 0.7, 30, C.black, z); }
  function laptop(x, i, j, z = 0) { box(x, i, j, 0.5, 0.35, 2, C.white, z + 34); const a = P(i, j + 0.02, z + 36), b = P(i + 0.5, j + 0.02, z + 36); poly(x, [a, b, [b[0], b[1] - 20], [a[0], a[1] - 20]], '#2a2c33'); poly(x, [[a[0] + 3, a[1] - 3], [b[0] - 3, b[1] - 3], [b[0] - 3, b[1] - 17], [a[0] + 3, a[1] - 17]], '#5b8cff'); }
  function monitor(x, i, j, z = 0) { box(x, i + 0.2, j + 0.1, 0.1, 0.1, 12, C.black, z + 34); const a = P(i, j, z + 46), b = P(i + 0.7, j, z + 46); poly(x, [a, b, [b[0], b[1] - 32], [a[0], a[1] - 32]], '#1d1f25'); poly(x, [[a[0] + 3, a[1] - 3], [b[0] - 3, b[1] - 3], [b[0] - 3, b[1] - 29], [a[0] + 3, a[1] - 29]], '#7bc4a0'); }
  function chair(x, i, j, z = 0) { box(x, i, j, 0.5, 0.5, 4, C.black, z + 22); box(x, i + 0.22, j + 0.22, 0.06, 0.06, 22, C.black, z); const a = P(i, j + 0.5, z + 26), b = P(i + 0.5, j + 0.5, z + 26); poly(x, [a, b, [b[0], b[1] - 26], [a[0], a[1] - 26]], C.black[0]); }
  function plant(x, i, j, s = 1, z = 0) { box(x, i, j, 0.4, 0.4, 20 * s, C.white, z); const [px, py] = P(i + 0.2, j + 0.2, z + 20 * s); [[0, -26, 20], [-14, -14, 15], [14, -16, 16], [0, -42, 13]].forEach(([dx, dy, r], k) => { x.fillStyle = C.green[k % 2]; x.beginPath(); x.ellipse(px + dx * s, py + dy * s, r * s, r * s * 0.8, 0, 0, T2); x.fill(); }); }
  function rug(x, i, j, w, d, col, z = 0) { poly(x, [P(i, j, z + 0.5), P(i + w, j, z + 0.5), P(i + w, j + d, z + 0.5), P(i, j + d, z + 0.5)], col); }
  function sofa(x, i, j, z = 0) { box(x, i, j, 2, 0.8, 18, C.sofa, z); box(x, i, j, 2, 0.25, 36, C.sofa, z); box(x, i, j, 0.25, 0.8, 26, C.sofa, z); box(x, i + 1.75, j, 0.25, 0.8, 26, C.sofa, z); }
  function shelf(x, i, j, z = 0) { box(x, i, j, 1.2, 0.35, 90, C.white, z); for (let k = 1; k < 4; k++) { const a = P(i, j + 0.35, z + k * 22), b = P(i + 1.2, j + 0.35, z + k * 22); x.strokeStyle = C.wallD; x.lineWidth = 2; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); }
    const r = H.rng(2); for (let k = 0; k < 3; k++) for (let m = 0; m < 5; m++) { if (r() < 0.3) continue; const p = P(i + 0.15 + m * 0.2, j + 0.36, z + k * 22 + 4); x.fillStyle = r.pick([C.accent, C.accent2, '#3a3d45', '#c9a23a', C.green[1]]); x.fillRect(p[0] - 4, p[1] - 16, 8, 16); } }
  function lamp(x, i, j, z = 0) { box(x, i, j, 0.12, 0.12, 80, C.black, z); const [px, py] = P(i + 0.06, j + 0.06, z + 86); glo(x, px, py + 10, 70, '#ffd98a', 0.45); x.fillStyle = '#ffe9b8'; x.beginPath(); x.ellipse(px, py, 18, 10, 0, 0, T2); x.fill(); }
  function screenTV(x, i, z0) { const q = wallQuad(i, i + 1.6, 0.16, z0, z0 + 52); poly(x, q, '#1d1f25'); const g = x.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]); g.addColorStop(0, '#3f7cff'); g.addColorStop(1, '#7bc4a0'); const k = 5; poly(x, [[q[0][0] + k, q[0][1] + k], [q[1][0] - k, q[1][1] + k], [q[2][0] - k, q[2][1] - k], [q[3][0] + k, q[3][1] - k]], g); }
  function trophy(x, i, j, z) { box(x, i, j, 0.3, 0.3, 6, C.black, z); const [px, py] = P(i + 0.15, j + 0.15, z + 6); x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(px - 10, py - 30); x.lineTo(px + 10, py - 30); x.quadraticCurveTo(px + 9, py - 12, px, py - 10); x.quadraticCurveTo(px - 9, py - 12, px - 10, py - 30); x.fill(); x.fillRect(px - 2, py - 10, 4, 8); glo(x, px, py - 22, 30, '#f2c230', 0.4); }
  function coffee(x, i, j, z) { box(x, i, j, 0.35, 0.3, 26, C.black, z); const [px, py] = P(i + 0.17, j + 0.3, z + 14); x.fillStyle = '#ff7a59'; x.beginPath(); x.arc(px, py, 4, 0, T2); x.fill(); }

  // ---------- Raum ----------
  function room(x, stage, night) {
    const W_ = 6, D_ = 5, WH = stage >= 3 ? 230 : 130;
    // Bodenplatte
    box(x, 0, 0, W_, D_, 16, [C.floor, C.slab, C.slabD]);
    for (let k = 1; k < W_ * 2; k++) { const a = P(k / 2, 0, 16), b = P(k / 2, D_, 16); x.strokeStyle = C.floor2; x.lineWidth = 1; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); }
    // Rückwände
    box(x, 0, 0, W_, 0.16, WH, [C.wallS, C.wall, C.wallS], 16);
    box(x, 0, 0, 0.16, D_, WH, [C.wallS, C.wallD, C.wall], 16);
    // Fensterfront in der linken Wand
    const nW = stage >= 2 ? 2 : 1;
    for (let k = 0; k < nW; k++) skyline(x, wallQuadB(0.6 + k * 2.1, 2.3 + k * 2.1, 0.16, 46, stage >= 3 ? 210 : 120), night);
    return WH;
  }

  function sceneBody(x, stage, t, night) {
    x.save();
    const WH = room(x, stage, night);
    const z = 16;
    if (stage === 1) {
      rug(x, 1.6, 1.6, 2.6, 2.0, '#e6dccb', z);
      desk(x, 2, 1.2, z); laptop(x, 2.5, 1.35, z); chair(x, 2.5, 2.2, z);
      plant(x, 4.7, 0.5, 1, z);
      box(x, 0.6, 3.6, 0.8, 0.8, 22, ['#c9c2b6', '#b3ab9e', '#9e968a'], z); // Kiste
    } else {
      rug(x, 2.6, 2.4, 2.8, 2.2, C.rug, z);
      desk(x, 1.0, 0.7, z); monitor(x, 1.3, 0.75, z); laptop(x, 1.95, 0.9, z); chair(x, 1.5, 1.7, z);
      shelf(x, 3.4, 0.2, z); plant(x, 5.3, 0.4, 1.2, z);
      screenTV(x, 4.6, z + 40);
    }
    drawWalker(x, stage, t);
    if (stage >= 2) {
      sofa(x, 2.9, 3.6, z);
      box(x, 3.4, 2.7, 1.0, 0.6, 14, C.wood, z); // Couchtisch
      lamp(x, 5.5, 3.0, z); plant(x, 0.4, 4.3, 0.9, z);
    }
    if (stage >= 3) {
      const z2 = z + 120;
      // Galerie (obere Etage) hinten
      box(x, 0, 0, 6, 2.2, 12, ['#d8c3a5', C.white[1], C.white[2]], z2 - 12);
      // Glasgeländer
      poly(x, [P(0.2, 2.2, z2 + 34), P(6, 2.2, z2 + 34), P(6, 2.2, z2), P(0.2, 2.2, z2)], 'rgba(190,225,255,0.35)', 'rgba(255,255,255,0.7)');
      // Treppe
      for (let k = 0; k < 8; k++) box(x, 5.2, 2.2 + 0.35 * (7 - k), 0.7, 0.35, 15, C.wood, z + k * 15);
      // Lounge oben
      sofa(x, 0.8, 1.0, z2); plant(x, 3.4, 0.4, 1.1, z2); trophy(x, 4.2, 0.6, z2 + 0); coffee(x, 2.9, 0.4, z2);
      lamp(x, 0.3, 1.6, z2);
    }
    x.restore();
  }
  let cam = function (x, stage) { x.translate(300, stage >= 3 ? 580 : 525); x.scale(1.22, 1.22); x.translate(-322, stage >= 3 ? -380 : -430); }


  // ---------- Figuren: modern, weich schattiert, mit Lauf-Zyklus ----------
  const WHO = {
    m: { name: 'Leon', skin: ['#f4cdaa', '#dfae88'], hair: ['#3b2a22', '#5a4134'], top: ['#5b8cff', '#3d6be0', '#2f55b8'], pants: ['#2c3140', '#22262f'], shoe: ['#ffffff', '#d6d6d6'], accent: '#ffd23f' },
    w: { name: 'Mia', skin: ['#f6d2b6', '#e2b392'], hair: ['#7a3f24', '#a0583a'], top: ['#ff7a59', '#e95f3e', '#c94b2e'], pants: ['#2f3a55', '#252e45'], shoe: ['#ffffff', '#d6d6d6'], accent: '#ffffff' } };
  let CUR = 'w';
  // o: { pose, phase (Laufzyklus 0..1), moving, back, flip, t }
  function person(x, px, py, s, who, o = {}) {
    const c = WHO[who], t = o.t || 0, pose = o.pose || 'stand', mv = o.moving ? 1 : 0;
    const ph = (o.phase || 0) * T2, step = Math.sin(ph), bob = mv ? Math.abs(Math.cos(ph)) * 2.5 : Math.sin(t * 2) * 0.8;
    x.save(); x.translate(px, py); x.scale(s * (o.flip ? -1 : 1), s);
    // Schatten
    x.fillStyle = 'rgba(30,20,10,0.18)'; x.beginPath(); x.ellipse(0, 0, 24, 8, 0, 0, T2); x.fill();
    x.translate(0, -bob);
    // Beine (Füße heben sich abwechselnd)
    for (const sd of [-1, 1]) {
      const lift = mv ? Math.max(0, sd * step) * 7 : 0, swing = mv ? sd * step * 4 : 0;
      const g = x.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, c.pants[0]); g.addColorStop(1, c.pants[1]);
      x.fillStyle = g; rrc(x, sd * 8 - 6 + swing * 0.3, -50, 12, 46 - lift, 6); x.fill();
      x.fillStyle = c.shoe[1]; x.beginPath(); x.ellipse(sd * 9 + swing, -5 - lift + 1.5, 10, 5.5, 0, 0, T2); x.fill();
      x.fillStyle = c.shoe[0]; x.beginPath(); x.ellipse(sd * 9 + swing, -6 - lift, 10, 5, 0, 0, T2); x.fill();
    }
    // Arme: Winkel aus Pose oder Laufschwung
    const arm = (sd, ang, behind) => {
      const sx = sd * 17, sy = -86, L1 = 19, L2 = 18;
      const a1 = ang, a2 = ang + (pose === 'coffee' && sd > 0 ? 1.2 * sd : 0.15 * sd);
      const ex = sx + Math.sin(a1) * L1, ey = sy + Math.cos(a1) * L1, hx = ex + Math.sin(a2) * L2, hy = ey + Math.cos(a2) * L2;
      x.strokeStyle = behind ? c.top[2] : c.top[1]; x.lineCap = 'round'; x.lineWidth = 10;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
      x.strokeStyle = c.skin[behind ? 1 : 0]; x.lineWidth = 8; x.beginPath(); x.moveTo(ex, ey); x.lineTo(hx, hy); x.stroke();
      x.fillStyle = c.skin[0]; x.beginPath(); x.arc(hx, hy, 5.2, 0, T2); x.fill();
      return [hx, hy];
    };
    let aL, aR;
    if (mv) { aL = -0.18 + step * 0.45; aR = 0.18 - step * 0.45; }
    else if (pose === 'cheer') { const w = Math.sin(t * 9) * 0.12; aL = -2.6 - w; aR = 2.6 + w; }
    else if (pose === 'wave') { aL = -0.2; aR = 2.55 + Math.sin(t * 8) * 0.3; }
    else if (pose === 'coffee') { aL = -0.2; aR = 0.9; }
    else { aL = -0.2 + Math.sin(t * 1.5) * 0.03; aR = 0.2 - Math.sin(t * 1.5) * 0.03; }
    // Haare hinten (lang bei Mia)
    if (who === 'w' && !o.back) { x.fillStyle = c.hair[0]; x.beginPath(); x.moveTo(-20, -126); x.quadraticCurveTo(-24, -98, -16, -88); x.lineTo(16, -88); x.quadraticCurveTo(24, -98, 20, -126); x.closePath(); x.fill(); }
    // Oberkörper (leicht tailliert, zweifarbig schattiert)
    const tg = x.createLinearGradient(-22, -100, 22, -46); tg.addColorStop(0, c.top[0]); tg.addColorStop(0.55, c.top[1]); tg.addColorStop(1, c.top[2]);
    x.fillStyle = tg; x.beginPath(); x.moveTo(-19, -98); x.quadraticCurveTo(-23, -72, -17, -46); x.lineTo(17, -46); x.quadraticCurveTo(23, -72, 19, -98); x.quadraticCurveTo(0, -103, -19, -98); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(-17, -52, 34, 6);
    if (!o.back) {
      if (who === 'w') { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(-8, -99); x.lineTo(0, -86); x.lineTo(8, -99); x.closePath(); x.fill(); }
      else { x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-7, -98); x.lineTo(0, -90); x.lineTo(7, -98); x.stroke(); x.fillStyle = c.accent; x.beginPath(); x.arc(9, -78, 3, 0, T2); x.fill(); }
    }
    const hR = arm(1, aR, false); arm(-1, aL, false);
    if (pose === 'coffee' && !mv) { x.fillStyle = '#ffffff'; rrc(x, hR[0] - 6, hR[1] - 17, 12, 15, 3); x.fill(); x.fillStyle = '#ff7a59'; x.fillRect(hR[0] - 6, hR[1] - 11, 12, 4); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(hR[0] - 2, hR[1] - 20); x.quadraticCurveTo(hR[0] + 2, hR[1] - 26, hR[0] - 1, hR[1] - 31); x.stroke(); }
    // Hals
    x.fillStyle = c.skin[1]; rrc(x, -5, -108, 10, 12, 4); x.fill();
    // Kopf
    const hg = x.createRadialGradient(-5, -130, 2, 0, -124, 22); hg.addColorStop(0, c.skin[0]); hg.addColorStop(1, c.skin[1]);
    x.fillStyle = hg; x.beginPath(); x.ellipse(0, -124, 17, 19, 0, 0, T2); x.fill();
    if (!o.back) for (const sd of [-1, 1]) { x.fillStyle = c.skin[1]; x.beginPath(); x.ellipse(sd * 17, -122, 3.5, 5, 0, 0, T2); x.fill(); }
    if (o.back) {
      // Rückansicht: Haare bedecken den Hinterkopf
      x.fillStyle = c.hair[0]; x.beginPath(); x.ellipse(0, -127, 18.5, 18, 0, 0, T2); x.fill();
      if (who === 'w') { x.beginPath(); x.arc(0, -147, 10, 0, T2); x.fill(); x.fillStyle = c.hair[1]; x.beginPath(); x.arc(-3, -150, 3.5, 0, T2); x.fill(); }
      x.fillStyle = c.hair[1]; x.beginPath(); x.ellipse(-6, -134, 6, 3, -0.5, 0, T2); x.fill();
    } else {
      // Haare vorne
      x.fillStyle = c.hair[0];
      if (who === 'm') {
        x.beginPath(); x.moveTo(-18, -122); x.quadraticCurveTo(-20, -146, 0, -146); x.quadraticCurveTo(16, -147, 19, -128); x.quadraticCurveTo(10, -138, -4, -134); x.quadraticCurveTo(-12, -132, -18, -122); x.fill();
        x.fillStyle = c.hair[1]; x.beginPath(); x.ellipse(2, -141, 8, 2.6, -0.2, 0, T2); x.fill();
      } else {
        x.beginPath(); x.moveTo(-19, -116); x.quadraticCurveTo(-21, -145, 0, -145); x.quadraticCurveTo(21, -145, 19, -116); x.quadraticCurveTo(14, -134, 2, -134); x.quadraticCurveTo(-10, -132, -19, -116); x.fill();
        x.beginPath(); x.arc(0, -150, 10, 0, T2); x.fill();
        x.fillStyle = c.hair[1]; x.beginPath(); x.ellipse(-6, -140, 7, 2.6, -0.4, 0, T2); x.fill(); x.beginPath(); x.arc(-3, -153, 3.2, 0, T2); x.fill();
      }
      // Gesicht
      const blink = (t % 4.1) < 0.12 ? 0.15 : 1, happy = pose === 'cheer';
      x.fillStyle = c.hair[0]; for (const sd of [-1, 1]) { rrc(x, sd * 7 - 4, -133, 8, 2.2, 1.1); x.fill(); }
      for (const sd of [-1, 1]) {
        if (happy) { x.strokeStyle = '#2a2230'; x.lineWidth = 2; x.beginPath(); x.arc(sd * 6.5, -124, 3.2, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
        else { x.fillStyle = '#2a2230'; x.beginPath(); x.ellipse(sd * 6.5, -125, 2.6, 3.2 * blink, 0, 0, T2); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(sd * 6.5 - 0.9, -126.2, 0.9, 0, T2); x.fill(); }
      }
      x.fillStyle = 'rgba(180,110,80,0.35)'; x.beginPath(); x.ellipse(0, -119.5, 1.8, 1.2, 0, 0, T2); x.fill();
      x.fillStyle = 'rgba(255,120,120,0.32)'; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * 11, -118, 3.6, 2.1, 0, 0, T2); x.fill(); }
      if (happy) { x.fillStyle = '#8a3a3a'; x.beginPath(); x.arc(0, -114.5, 4.2, 0, Math.PI); x.fill(); }
      else { x.strokeStyle = '#6a3a3a'; x.lineWidth = 1.8; x.lineCap = 'round'; x.beginPath(); x.arc(0, -116, 3.4, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); }
    }
    x.restore();
  }

  // Laufwege pro Stufe: [i, j, Wartezeit s, Pose beim Warten]
  const PATHS = {
    1: [[3.0, 2.9, 2.4, 'coffee'], [4.4, 2.2, 1.6, 'stand'], [4.3, 4.0, 0, ''], [2.3, 4.2, 1.8, 'wave'], [1.7, 3.0, 0, '']],
    2: [[2.0, 2.45, 2.4, 'coffee'], [3.2, 2.35, 0, ''], [4.9, 2.4, 2.0, 'cheer'], [3.2, 2.35, 0, ''], [2.45, 3.1, 0, ''], [2.45, 4.5, 1.8, 'wave'], [1.0, 4.0, 0, ''], [1.0, 2.7, 0, '']],
  };
  PATHS[3] = PATHS[2];
  function walker(stage, t) {
    const pts = PATHS[stage], SPD = 0.9;
    const segs = []; let T = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if (a[2] > 0) { segs.push({ t0: T, t1: T + a[2], a, b: a, wait: a[3] }); T += a[2]; }
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ t0: T, t1: T + d / SPD, a, b }); T += d / SPD;
    }
    const u = ((t % T) + T) % T, sg = segs.find(s => u >= s.t0 && u < s.t1) || segs[0];
    const f = (u - sg.t0) / (sg.t1 - sg.t0 || 1), i = sg.a[0] + (sg.b[0] - sg.a[0]) * f, j = sg.a[1] + (sg.b[1] - sg.a[1]) * f;
    const moving = !sg.wait;
    const [sx0, sy0] = P(sg.a[0], sg.a[1]), [sx1, sy1] = P(sg.b[0], sg.b[1]);
    const back = moving && sy1 < sy0 - 2, flip = moving ? sx1 < sx0 : (stage === 1 ? false : true);
    return { i, j, moving, pose: sg.wait || 'stand', back, flip, phase: (u * 1.8) % 1 };
  }

  function drawWalker(x, stage, t) { const w = walker(stage, t), p = P(w.i, w.j, 16); person(x, p[0], p[1], 0.68, CUR, { ...w, t }); }
  function hud(x, W, lvl, title, night) {
    const ink = night ? '#ffffff' : '#20232b', sub = night ? '#b8bfe0' : '#6b6f7a';
    x.save(); x.fillStyle = night ? 'rgba(255,255,255,0.1)' : '#ffffff'; rrc(x, 24, 28, W - 48, 74, 37); x.fill();
    x.fillStyle = '#f2c230'; x.beginPath(); x.arc(66, 65, 16, 0, T2); x.fill(); tx(x, lvl.coins, 92, 66, 28, ink, { align: 'left' });
    tx(x, 'Level ' + lvl.n, W / 2 + 30, 66, 28, ink); tx(x, lvl.streak, W - 64, 66, 26, C.accent, { align: 'right' }); x.restore();
    tx(x, title, W / 2, 152, 40, ink, { w: 800 }); tx(x, lvl.sub, W / 2, 196, 24, sub, { w: 600 });
  }


  // Kamera passend zur Leinwand: Raum zentriert und so groß wie möglich
  function fit(x, W, H_, stage) {
    const rw = 470, rh = stage >= 3 ? 470 : 360, cy = stage >= 3 ? 330 : 380;
    const s = Math.min(W / rw, H_ / rh) * 0.95;
    x.translate(W / 2, H_ / 2 + (stage >= 3 ? 10 : 6)); x.scale(s, s); x.translate(-322, -cy);
  }
  window.Buero = {
    stageFor: (L) => L >= 15 ? 3 : L >= 5 ? 2 : 1,
    names: { 1: 'Das Start-Loft', 2: 'Das eigene Büro', 3: 'Das Maisonette-Penthouse' },
    who: WHO,
    setWho(w) { CUR = w === 'm' ? 'm' : 'w'; },
    // Raum mit laufender Figur
    room(x, W, H_, stage, t, night) {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.restore();
      x.save(); const k = x.canvas.width / W; x.scale(k, k);
      const g = x.createLinearGradient(0, 0, 0, H_);
      if (night) { g.addColorStop(0, '#171a33'); g.addColorStop(1, '#2b2f55'); } else { g.addColorStop(0, '#f6f3ee'); g.addColorStop(1, '#ebe5dc'); }
      x.fillStyle = g; x.fillRect(0, 0, W, H_);
      ISO.oy = 330; x.save(); fit(x, W, H_, stage);
      const keep = cam; cam = () => {}; // Szene ohne eigene Kamera zeichnen
      try { sceneBody(x, stage, t, night); } finally { cam = keep; }
      x.restore(); x.restore();
    },
    // einzelne Figur (Morgen-Bildschirm, Level-up)
    figure(x, W, H_, pose, t) {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.restore();
      x.save(); const k = x.canvas.width / W; x.scale(k, k); person(x, W / 2, H_ - 8, (H_ - 16) / 160, CUR, { pose, t }); x.restore();
    }
  };
})();
