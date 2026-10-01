/* MultiplAI — digital rain engine.

   Canvas 2D + a pre-rendered glyph atlas: each frame is a few thousand drawImage
   calls and nothing else, so it stays smooth on phones. No dependencies except
   GSAP's ticker, which drives it (one clock for the engine and the intro timeline).

   Original implementation. The glyphs come from a subsetted open-licence font
   (see assets/fonts/FONT-LICENSES.md), mirrored and set in falling columns.
   No asset, frame or typeface from any film is used.

   Public surface (all that intro.js needs):
     MultiplaiRain.ready()                      -> Promise, glyph font loaded
     new MultiplaiRain.Rain(canvas, opts)       -> engine instance
       opts.mode      'intro' | 'ambient'
       opts.bloom     <canvas> for the cheap glow layer (optional)
       opts.fpsCap    e.g. 30 on phones for the ambient layer
     rain.start() / rain.stop() / rain.destroy()
     rain.buildMask(paint)  rain.reveal(seconds)   the "code forms the logo" effect
     rain.setPointer(x, y)                          cursor makes glyphs glow
     live knobs, tweened by GSAP:  speed, dim, heldAlpha, glitch, bloomAlpha */
(function (global) {
  'use strict';

  // half-width katakana (U+FF66–FF9D) + digits + a few symbols, same family of shapes
  // as the classic look, built from code points so nothing depends on copy-paste.
  var GLYPHS = [], cp;
  for (cp = 0xFF66; cp <= 0xFF9D; cp++) GLYPHS.push(String.fromCharCode(cp));
  GLYPHS = GLYPHS.concat('0123456789:.=*+-<>|'.split(''));
  var NG = GLYPHS.length;

  var LEVELS = 16;      // brightness steps; the last one is the white "head" of a drop
  var HEAD = LEVELS - 1;
  var FAMILY = 'RainGlyphs, "Noto Sans CJK JP", "Hiragino Kaku Gothic ProN", "MS Gothic", monospace';
  var rnd = Math.random;

  function levelStyle(lv, am) {
    am = am || 1;
    if (lv === HEAD) return 'rgba(228,255,238,' + am + ')';
    var u = lv / (LEVELS - 2);
    var w = Math.max(0, (u - 0.8) / 0.2);                 // leading cells go slightly pale
    var r = Math.round(140 * w);
    var g = Math.round(80 + 175 * Math.pow(u, 0.9));
    var b = Math.round(20 + 45 * u + 110 * w);
    var a = (0.10 + 0.90 * Math.pow(u, 1.25)) * am;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  }

  function buildAtlas(cw, ch, alphaMul) {
    var c = document.createElement('canvas');
    c.width = cw * NG; c.height = ch * LEVELS;
    var g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = Math.round(ch * 0.8) + 'px ' + FAMILY;
    for (var lv = 0; lv < LEVELS; lv++) {
      g.fillStyle = levelStyle(lv, alphaMul);
      for (var i = 0; i < NG; i++) {
        g.save();
        g.translate(i * cw + cw / 2, lv * ch + ch / 2 + ch * 0.03);
        g.scale(-1, 1);                                    // mirrored, like the original look
        g.fillText(GLYPHS[i], 0, 0);
        g.restore();
      }
    }
    return c;
  }

  function newDrop(L, col, initial) {
    var len = 8 + rnd() * 22;
    return {
      col: col,
      len: len,
      v: (7 + rnd() * 15) * L.speed,                       // rows per second
      y: initial ? -len + rnd() * (L.rows + len) : -len - rnd() * L.rows * 0.8,
      h: -1,
      wait: 0,
      sweep: false
    };
  }

  function makeLayer(W, H, cw, ch, o) {
    var cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
    var L = {
      cw: cw, ch: ch, cols: cols, rows: rows,
      alpha: o.alpha, speed: o.speed,
      glyph: new Uint8Array(cols * rows),
      held: new Uint8Array(cols * rows),
      drops: [], sweeps: [],
      mask: null, maskType: null, maskList: null
    };
    var i, c;
    for (i = 0; i < L.glyph.length; i++) L.glyph[i] = (rnd() * NG) | 0;
    for (c = 0; c < cols; c++) {
      L.drops.push(newDrop(L, c, true));
      if (rnd() < o.second) L.drops.push(newDrop(L, c, true));
    }
    return L;
  }

  function profile(mode) {
    var w = global.innerWidth, small = w < 700, mid = w < 1100;
    var intro = mode === 'intro';
    return {
      chCss: intro ? (small ? 14 : mid ? 16 : 19) : (small ? 15 : mid ? 18 : 21),
      dprCap: intro ? 2 : 1.5,
      small: small
    };
  }

  /* ------------------------------------------------------------------ */

  function Rain(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = opts.mode || 'intro';
    this.fpsCap = opts.fpsCap || 0;
    this.bloomCanvas = opts.bloom || null;
    this.useBack = opts.back !== false;
    this.useBloom = !!this.bloomCanvas;
    this.noDegrade = !!opts.noDegrade;
    this.dprScale = 1;

    // live knobs
    this.speed = 1;
    this.dim = 1;            // brightness of the free-falling rain
    this.heldAlpha = 1;      // brightness of the cells that make up the logo
    this.glitch = 0;         // 0..1
    this.bloomAlpha = 1;     // 0..1 (applied to the bloom canvas by the caller via CSS)

    this.running = false;
    this.frame = 0;
    this.pointer = null;
    this.cost = 0;           // ms per frame spent in update+draw (moving average)
    this._slow = 0;
    this._degraded = 0;
    this._acc = 0;
    this.resize();
  }

  Rain.prototype.resize = function () {
    var cv = this.canvas, p = profile(this.mode);
    var cssW = global.innerWidth, cssH = global.innerHeight;
    var dpr = Math.min(global.devicePixelRatio || 1, p.dprCap) * this.dprScale;
    this.dpr = dpr;
    this.cssW = cssW; this.cssH = cssH;
    this.W = cv.width = Math.round(cssW * dpr);
    this.H = cv.height = Math.round(cssH * dpr);

    var ch = Math.max(8, Math.round(p.chCss * dpr)), cw = Math.round(ch * 0.62);
    this.acw = cw; this.ach = ch;
    this.atlas = buildAtlas(cw, ch);
    this.front = makeLayer(this.W, this.H, cw, ch, { alpha: 1, speed: 1, second: p.small ? 0.9 : 0.5 });
    this.logo = null;                              // built on demand by buildMask()

    var bch = Math.max(6, Math.round(ch * 0.6)), bcw = Math.round(bch * 0.62);
    this.back = this.useBack
      ? makeLayer(this.W, this.H, bcw, bch, { alpha: 0.4, speed: 0.6, second: p.small ? 0.7 : 0.35 })
      : null;
    this.atlasB = this.back ? buildAtlas(bcw, bch, 0.42) : null;   // own, pre-dimmed atlas: 1:1 blits, no alpha blending

    if (this.bloomCanvas && this.useBloom) {
      var midW = Math.ceil(this.W / 4), midH = Math.ceil(this.H / 4);
      this.mid = this.mid || document.createElement('canvas');
      this.mid.width = midW; this.mid.height = midH;
      this.midCtx = this.mid.getContext('2d');
      this.bloomCanvas.width = Math.ceil(this.W / 12);
      this.bloomCanvas.height = Math.ceil(this.H / 12);
      this.bloomCtx = this.bloomCanvas.getContext('2d');
      this.midCtx.imageSmoothingQuality = 'medium';
      this.bloomCtx.imageSmoothingQuality = 'medium';
    }
    this._maskPaint && this.buildMask(this._maskPaint);
  };

  /* Turn a painted shape into a per-cell coverage map on the front grid.
     paint(ctx, accentOnly) draws white shapes in CSS pixels. Called twice:
     once for the whole shape, once for the "accent" part only. */
  Rain.prototype.buildMask = function (paint) {
    this._maskPaint = paint;
    // The logo gets its own, finer grid: letters need ~10 rows to be readable, rain cells are bigger.
    var lch = Math.max(6, Math.round((this.logoCell || 9) * this.dpr)), lcw = Math.round(lch * 0.62);
    this.atlas2 = buildAtlas(lcw, lch);
    this.acw2 = lcw; this.ach2 = lch;
    var L = this.logo = makeLayer(this.W, this.H, lcw, lch, { alpha: 1, speed: 1, second: 0 });
    L.drops = [];
    var S = 3, mw = L.cols * S, mh = L.rows * S;
    var cv = document.createElement('canvas');
    cv.width = mw; cv.height = mh;
    var g = cv.getContext('2d', { willReadFrequently: true });
    var sx = (S / L.cw) * this.dpr, sy = (S / L.ch) * this.dpr;
    var cols = L.cols, rows = L.rows;

    function pass(accentOnly) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, mw, mh);
      g.setTransform(sx, 0, 0, sy, 0, 0);
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      paint(g, accentOnly);
      var d = g.getImageData(0, 0, mw, mh).data;
      var out = new Uint8Array(cols * rows), c, r, i, j, sum;
      for (c = 0; c < cols; c++) {
        for (r = 0; r < rows; r++) {
          sum = 0;
          for (j = 0; j < S; j++) for (i = 0; i < S; i++) {
            sum += d[(((r * S + j) * mw) + (c * S + i)) * 4 + 3];
          }
          out[c * rows + r] = Math.min(255, Math.round(sum / (S * S)));
        }
      }
      return out;
    }

    var all = pass(false), acc = pass(true);
    var list = [], type = new Uint8Array(cols * rows), k;
    for (k = 0; k < all.length; k++) {
      if (all[k] > 56) {
        list.push(k);
        type[k] = acc[k] > all[k] * 0.5 ? 2 : 1;
      }
    }
    L.mask = all; L.maskType = type; L.maskList = Int32Array.from(list);
    L.held.fill(0);
  };

  /* Send a fast bright drop down every column that holds part of the shape.
     Each drop latches the cells it crosses, so the logo is written by the rain. */
  Rain.prototype.reveal = function (seconds) {
    var L = this.logo;
    if (!L) return;
    if (!L.maskList || !L.maskList.length) return;
    var seen = {}, list = [], i, c;
    for (i = 0; i < L.maskList.length; i++) {
      c = (L.maskList[i] / L.rows) | 0;
      if (!seen[c]) {
        seen[c] = 1;
        list.push({
          col: c, len: 14 + rnd() * 8, y: -4, h: -1, sweep: true,
          v: (L.rows + 26) / (seconds * 0.5),
          wait: rnd() * seconds * 0.45
        });
      }
    }
    L.sweeps = list;
    this._revealEnd = seconds;
    this._revealT = 0;
  };

  Rain.prototype.holdAll = function () {            // finish instantly (used when skipping)
    var L = this.logo;
    if (!L) return;
    if (!L.maskList) return;
    for (var i = 0; i < L.maskList.length; i++) L.held[L.maskList[i]] = 1;
    L.sweeps = [];
    this._revealEnd = 0;
  };

  Rain.prototype.setPointer = function (x, y) {      // CSS pixels; null to clear
    this.pointer = x == null ? null : { x: x * this.dpr, y: y * this.dpr };
  };

  /* ------------------------------ update ------------------------------ */

  Rain.prototype._advance = function (L, dt, speed) {
    var drops = L.drops, i, d, head, r, from, to, idx;
    for (i = 0; i < drops.length; i++) {
      d = drops[i];
      d.y += d.v * dt * speed;
      head = Math.floor(d.y);
      if (head !== d.h) {
        from = Math.max(d.h + 1, 0); to = Math.min(head, L.rows - 1);
        for (r = from; r <= to; r++) L.glyph[d.col * L.rows + r] = (rnd() * NG) | 0;
        d.h = head;
      }
      if (d.y - d.len > L.rows) {
        var n = newDrop(L, d.col, false);
        d.y = n.y; d.len = n.len; d.v = n.v; d.h = -1;
      }
    }
    // random glyph churn, like unstable code
    var churn = Math.ceil(L.glyph.length * dt * 0.25);
    for (i = 0; i < churn; i++) L.glyph[(rnd() * L.glyph.length) | 0] = (rnd() * NG) | 0;
  };

  Rain.prototype._advanceSweeps = function (dt) {
    var L = this.logo, s = L.sweeps, i, d, head, r, from, to, idx, alive = false;
    for (i = 0; i < s.length; i++) {
      d = s[i];
      if (d.done) continue;
      if (d.wait > 0) { d.wait -= dt; alive = true; continue; }
      d.y += d.v * dt;
      head = Math.floor(d.y);
      if (head !== d.h) {
        from = Math.max(d.h + 1, 0); to = Math.min(head, L.rows - 1);
        for (r = from; r <= to; r++) {
          idx = d.col * L.rows + r;
          L.glyph[idx] = (rnd() * NG) | 0;
          if (L.maskType[idx]) L.held[idx] = 1;
        }
        d.h = head;
      }
      if (d.y - d.len > L.rows) d.done = true; else alive = true;
    }
    if (!alive && s.length) { L.sweeps = []; }
  };

  Rain.prototype.update = function (dt) {
    if (dt > 0.05) dt = 0.05;
    this._advance(this.front, dt, this.speed);
    if (this.back) this._advance(this.back, dt, this.speed);
    if (this.logo && this.logo.sweeps.length) this._advanceSweeps(dt);
  };

  /* ------------------------------- draw ------------------------------- */

  Rain.prototype._drawLayer = function (L, alpha, drops, A, acw, ach) {
    var ctx = this.ctx;
    var cw = L.cw, ch = L.ch, rows = L.rows, glyph = L.glyph, nl = LEVELS - 2;
    var P = this.pointer, pr2 = 0, i, d, head, len, x, base, k, r, t, lvl, dx, dy, cy;
    if (P) { pr2 = Math.pow(150 * this.dpr, 2); }
    ctx.globalAlpha = alpha;
    for (i = 0; i < drops.length; i++) {
      d = drops[i];
      if (d.wait > 0 || d.done) continue;
      head = Math.floor(d.y); len = d.len | 0; x = d.col * cw; base = d.col * rows;
      for (k = 0; k <= len; k++) {
        r = head - k;
        if (r < 0) break;
        if (r >= rows) continue;
        if (k === 0) lvl = HEAD;
        else { t = 1 - k / len; lvl = (t * t * nl * (t > 0.6 ? 1.1 : 1) + 0.5) | 0; if (lvl > nl) lvl = nl; }
        if (P) {
          dx = x + cw / 2 - P.x; cy = r * ch + ch / 2; dy = cy - P.y;
          if (dx * dx + dy * dy < pr2) lvl = Math.min(HEAD, lvl + 6);
        }
        if (lvl === 0) continue;                         // too faint to see, skip the blit
        ctx.drawImage(A, glyph[base + r] * acw, lvl * ach, acw, ach, x, r * ch, cw, ch);
      }
    }
  };

  Rain.prototype._drawHeld = function () {
    var L = this.logo, ml = L && L.maskList;
    if (!ml || !ml.length || this.heldAlpha < 0.01) return;
    var ctx = this.ctx, A = this.atlas2, acw = this.acw2, ach = this.ach2;
    var rows = L.rows, cw = L.cw, ch = L.ch, j, idx, c, r, lvl, cov;
    ctx.globalAlpha = this.heldAlpha;
    for (j = 0; j < ml.length; j++) {
      idx = ml[j];
      if (!L.held[idx]) continue;
      c = (idx / rows) | 0; r = idx - c * rows;
      cov = L.mask[idx] / 255;
      lvl = L.maskType[idx] === 2 ? 12 + Math.round(cov * 3) : 8 + Math.round(cov * 6);
      if (rnd() < 0.03) lvl = Math.max(1, lvl - 3);        // twinkle
      if (rnd() < 0.012) L.glyph[idx] = (rnd() * NG) | 0;
      ctx.drawImage(A, L.glyph[idx] * acw, lvl * ach, acw, ach, c * cw, r * ch, cw, ch);
    }
  };

  Rain.prototype.draw = function () {
    var ctx = this.ctx, cv = this.canvas, W = this.W, H = this.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.back) this._drawLayer(this.back, 1, this.back.drops, this.atlasB, this.back.cw, this.back.ch);
    this._drawLayer(this.front, this.dim, this.front.drops, this.atlas, this.acw, this.ach);
    if (this.logo && this.logo.sweeps.length) this._drawLayer(this.logo, 1, this.logo.sweeps, this.atlas2, this.acw2, this.ach2);
    this._drawHeld();
    ctx.globalAlpha = 1;

    var g = this.glitch;
    if (g > 0.01) {
      var n = Math.ceil(g * 10), i, y, h, dx;
      for (i = 0; i < n; i++) {
        y = (rnd() * H) | 0; h = (4 + rnd() * H * 0.07) | 0; dx = ((rnd() - 0.5) * g * W * 0.14) | 0;
        ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
      }
      if (rnd() < g * 0.6) {
        ctx.globalAlpha = 0.22 * g; ctx.fillStyle = '#b6ffc8';
        ctx.fillRect(0, (rnd() * H) | 0, W, (2 + rnd() * 8) | 0);
        ctx.globalAlpha = 1;
      }
    }

    if (this.bloomCtx && this.bloomAlpha > 0.01 && (this.frame % 3) === 0) {            // glow is soft: 20 fps is plenty
      this.midCtx.clearRect(0, 0, this.mid.width, this.mid.height);
      this.midCtx.drawImage(cv, 0, 0, W, H, 0, 0, this.mid.width, this.mid.height);
      this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
      this.bloomCtx.drawImage(this.mid, 0, 0, this.mid.width, this.mid.height,
                              0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
    }
    this.frame++;
  };

  /* ------------------------------ lifecycle ------------------------------ */

  Rain.prototype.step = function (dt) {
    var t0 = global.performance ? performance.now() : 0;
    this.update(dt);
    this.draw();
    if (t0) {
      var c = performance.now() - t0;
      this.cost = this.cost ? this.cost * 0.9 + c * 0.1 : c;
    }
    if (!this.noDegrade) this._watch(dt);
  };

  // If the device cannot keep up, quietly lower the quality instead of stuttering.
  Rain.prototype._watch = function (dt) {
    if (this.fpsCap) return;
    if (dt > 1 / 26 && dt < 0.2) this._slow++; else this._slow = Math.max(0, this._slow - 2);
    if (this._slow > 40 && this._degraded < 2) {
      this._slow = 0; this._degraded++;
      if (this._degraded === 1) {
        this.useBack = false; this.back = null;
        this.useBloom = false; this.bloomCtx = null;
        if (this.bloomCanvas) this.bloomCanvas.style.display = 'none';
      } else {
        this.dprScale = 0.75; this.resize();
      }
      if (global.console && console.info) console.info('[rain] reduced quality, level', this._degraded);
    }
  };

  Rain.prototype.start = function () {
    if (this.running) return;
    var self = this;
    this.running = true;
    this._tick = function (time, delta) {
      var dt = delta / 1000;
      if (self.fpsCap) {
        self._acc += dt;
        if (self._acc < 1 / self.fpsCap - 0.003) return;
        dt = self._acc; self._acc = 0;
      }
      self.step(dt);
    };
    global.gsap.ticker.add(this._tick);
  };

  Rain.prototype.stop = function () {
    if (!this.running) return;
    this.running = false;
    global.gsap.ticker.remove(this._tick);
  };

  Rain.prototype.destroy = function () {
    this.stop();
    this.canvas.width = this.canvas.height = 1;
    this.atlas = null; this.front = this.back = null;
  };

  global.MultiplaiRain = {
    Rain: Rain,
    GLYPHS: GLYPHS,
    randomGlyph: function () { return GLYPHS[(rnd() * NG) | 0]; },
    ready: function () {
      var load = (global.document && document.fonts && document.fonts.load)
        ? document.fonts.load('20px RainGlyphs', GLYPHS.slice(0, 6).join(''))
        : Promise.resolve();
      return Promise.race([load.catch(function () {}), new Promise(function (r) { setTimeout(r, 1500); })]);
    }
  };
})(window);
