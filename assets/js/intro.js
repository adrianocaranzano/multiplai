/* MultiplAI — opening sequence.

   A first-person "waking up": eyes open out of focus, the code rain sharpens, a terminal
   line wakes the visitor, the rain writes the MultiplAI wordmark, a scanner line wipes
   into the site. About 7 seconds, skippable at any time, shown once per browser session.

   Everything is timed in the TIMING block below. To shorten or lengthen the intro,
   change numbers there; nothing else needs touching.

   Skipped automatically (decided in <head>): reduced motion, repeat visit in the same
   session, deep links with a #hash, ?intro=0. Forced with ?intro=1. */
(function () {
  'use strict';

  var html = document.documentElement;
  var gsap = window.gsap, API = window.MultiplaiRain;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var noDegrade = /[?&]nodegrade=1/.test(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var debounce = function (fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; };

  var TEXT = {
    wake: 'Svegliati.',
    alone: 'Non sei più solo.',
    status: 'sistema pronto',
    wordmark: [['Multipl', false], ['AI', true]]
  };

  var TIMING = {
    flutter: 0.25,     // first, half-opened blink
    open: 1.0,         // eyes open for real
    type: 1.75,        // "Svegliati." starts typing
    typeDur: 0.8,
    hold1: 0.35,
    scramble: 0.5,     // line one decodes into line two
    hold2: 0.55,
    glitch: 0.2,
    reveal: 1.3,       // the rain writes the wordmark
    crisp: 0.45,
    hold3: 0.3,
    wipe: 0.85
  };

  /* ------------------------------------------------------------------ */
  /* ambient rain behind the hero (also used when the intro is skipped)  */
  /* ------------------------------------------------------------------ */
  var ambient = null;

  function startAmbient() {
    if (ambient || reduce || !gsap || !API) return;
    var c = $('ambient-rain');
    if (!c) return;
    var conn = navigator.connection;
    if (conn && conn.saveData) return;
    var small = innerWidth < 700;
    ambient = true;
    API.ready().then(function () {
      var r = new API.Rain(c, { mode: 'ambient', back: !small, fpsCap: small ? 30 : 0, noDegrade: noDegrade });
      ambient = r; window.__ambient = r;
      r.dim = 0.5;
      r.start();
      gsap.to(c, { opacity: 1, duration: 1.8, ease: 'power1.out' });

      var hero = document.querySelector('.hero');
      if ('IntersectionObserver' in window && hero) {
        new IntersectionObserver(function (es) {
          if (es[0].isIntersecting) r.start(); else r.stop();     // no work once the hero is off screen
        }).observe(hero);
      }
      var lastW = innerWidth;
      addEventListener('resize', debounce(function () {
        if (innerWidth !== lastW) { lastW = innerWidth; r.resize(); }
      }, 200));
      if (matchMedia('(pointer:fine)').matches) {
        addEventListener('pointermove', function (e) { r.setPointer(e.clientX, e.clientY); }, { passive: true });
        document.addEventListener('mouseleave', function () { r.setPointer(null); });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* the intro                                                           */
  /* ------------------------------------------------------------------ */
  function runIntro() {
    var intro = $('intro'), cvRain = $('intro-rain'), cvBloom = $('intro-bloom'), cvCrisp = $('intro-crisp');
    var stage = $('intro-stage'), lids = $('intro-lids'), termWrap = $('intro-terminal'), term = $('intro-text');
    var status = $('intro-status'), statusText = $('intro-status-text'), skip = $('intro-skip'), sweep = $('intro-sweep');
    var rain, tl, lay, exiting = false, phase = 0, t0 = Date.now();

    ['#site-header', '#main', '.site-footer', '#sticky-cta'].forEach(function (sel) {
      var n = document.querySelector(sel); if (n) n.setAttribute('inert', '');
    });
    try { skip.focus({ preventScroll: true }); } catch (e) {}
    gsap.to(skip, { opacity: 1, duration: 0.4, delay: 0.6 });

    /* ---- wordmark layout: one line on wide screens, stacked on phones ---- */
    function layout() {
      var w = innerWidth, h = innerHeight, stacked = w < 640;
      var m = document.createElement('canvas').getContext('2d');
      var base = 100;
      m.font = '800 ' + base + 'px Syne, sans-serif';
      var rows = stacked ? [[TEXT.wordmark[0]], [TEXT.wordmark[1]]] : [TEXT.wordmark];
      var widest = 0, i, j, p, wsum;
      var meas = rows.map(function (parts) {
        wsum = 0;
        var segs = parts.map(function (pp) { var sw = m.measureText(pp[0]).width; wsum += sw; return { t: pp[0], a: pp[1], w: sw }; });
        widest = Math.max(widest, wsum);
        return { segs: segs, w: wsum };
      });
      var target = Math.min(w * (stacked ? 0.88 : 0.74), 1000);
      var fs = Math.min(base * target / widest, stacked ? 150 : 200), k = fs / base;
      var capH = m.measureText('M').actualBoundingBoxAscent * k || fs * 0.7;
      var lh = fs * (stacked ? 1.0 : 1.0), blockH = lh * meas.length;
      var cy = h * (stacked ? 0.42 : 0.46);
      var out = { fs: fs, capH: capH, blockH: blockH, cy: cy, lines: [] };
      meas.forEach(function (row, ri) {
        var x = w / 2 - row.w * k / 2, y = cy - blockH / 2 + lh * (ri + 0.5);
        out.lines.push(row.segs.map(function (s) {
          var seg = { t: s.t, a: s.a, x: x, y: y + capH / 2, w: s.w * k };   // y = alphabetic baseline
          x += s.w * k; return seg;
        }));
      });
      return out;
    }

    function drawSegs(g, accentOnly, fillFor) {
      g.font = '800 ' + lay.fs + 'px Syne, sans-serif';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      lay.lines.forEach(function (line) {
        line.forEach(function (s) {
          if (accentOnly && !s.a) return;
          fillFor(g, s);
          g.fillText(s.t, s.x, s.y);
        });
      });
    }

    function paintMask(g, accentOnly) {
      g.lineWidth = lay.fs * 0.05;                         // fake-bold so strokes span whole cells
      drawSegs(g, accentOnly, function (gg) { gg.fillStyle = '#fff'; });
      lay.lines.forEach(function (line) {
        line.forEach(function (s) {
          if (accentOnly && !s.a) return;
          g.strokeText(s.t, s.x, s.y);
        });
      });
    }

    function paintCrisp() {
      var dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
      cvCrisp.width = Math.round(W * dpr); cvCrisp.height = Math.round(H * dpr);
      var g = cvCrisp.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      [0.34, 0.12, 0].forEach(function (blur) {            // two glow passes, then the sharp one
        g.shadowColor = 'rgba(0,255,65,0.9)'; g.shadowBlur = lay.fs * blur;
        drawSegs(g, false, function (gg, s) { gg.fillStyle = s.a ? '#00ff41' : '#d4ffdf'; });
      });
      g.shadowBlur = 0;
      var st = status.style;
      st.top = (lay.cy + lay.blockH / 2 + Math.max(26, lay.fs * 0.3)) + 'px';
    }

    /* ---- text effects ---- */
    function typeTo(el, str, dur) {
      var o = { p: 0 };
      return gsap.to(o, {
        p: 1, duration: dur,
        ease: function (p) { return Math.min(1, p + 0.035 * Math.sin(p * Math.PI * 9)); },   // uneven keystrokes
        onUpdate: function () { el.textContent = str.slice(0, Math.round(o.p * str.length)); }
      });
    }
    function decode(el, to, dur) {
      var o = { p: 0 };
      return gsap.to(o, {
        p: 1, duration: dur, ease: 'none',
        onUpdate: function () {
          var settled = Math.floor(o.p * to.length), s = '', i;
          for (i = 0; i < to.length; i++) s += (i < settled || to[i] === ' ') ? to[i] : API.randomGlyph();
          el.textContent = s;
        }
      });
    }

    /* ---- build ---- */
    function build() {
      if (exiting) return;
      rain = new API.Rain(cvRain, { mode: 'intro', bloom: cvBloom, noDegrade: noDegrade });
      window.__intro = { rain: rain };
      rain.speed = 0.25;
      rain.logoCell = innerWidth < 700 ? 7 : (innerWidth < 1100 ? 8 : 9);
      lay = layout();
      rain.buildMask(paintMask);
      paintCrisp();
      rain.start();

      var H = innerHeight, W = innerWidth, st = { rx: W * 0.6, ry: 0.5 };
      function setLids() {
        lids.style.setProperty('--rx', Math.max(1, st.rx) + 'px');
        lids.style.setProperty('--ry', Math.max(0.5, st.ry) + 'px');
      }
      setLids();

      var T = TIMING, t;
      tl = gsap.timeline({ onComplete: function () { exit(T.wipe); } });
      window.__intro.tl = tl;

      // 1. first flutter: light leaks through, then the lids drop again
      tl.fromTo(stage, { scale: 1.08 }, { scale: 1, duration: 2.8, ease: 'sine.out' }, 0.1)
        .to(st, { ry: H * 0.05, rx: W * 0.85, duration: 0.55, ease: 'sine.inOut', onUpdate: setLids }, T.flutter)
        .to(cvBloom, { opacity: 0.8, duration: 0.55, ease: 'sine.inOut' }, T.flutter)
        .to(st, { ry: 0.5, duration: 0.3, ease: 'sine.in', onUpdate: setLids }, T.flutter + 0.6)
        .to(cvBloom, { opacity: 0.25, duration: 0.3 }, T.flutter + 0.6);

      // 2. eyes open; blur first (bloom only), then the sharp rain fades in
      tl.to(st, { ry: H * 1.75, rx: W * 1.9, duration: 1.3, ease: 'power2.inOut', onUpdate: setLids }, T.open)
        .to(cvBloom, { opacity: 0.95, duration: 0.5, ease: 'sine.out' }, T.open)
        .to(cvBloom, { opacity: 0.5, duration: 1.0, ease: 'sine.inOut' }, T.open + 0.55)
        .to(cvRain, { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, T.open + 0.2)
        .to(rain, { speed: 0.75, duration: 1.2, ease: 'sine.inOut' }, T.open)
        .set(lids, { display: 'none' }, T.open + 1.35);

      // 3. terminal: line one types, decodes into line two, then glitches out
      t = T.type;
      tl.set(termWrap, { opacity: 1 }, t - 0.3)
        .to(rain, { dim: 0.5, duration: 0.6, ease: 'sine.inOut' }, t - 0.2)
        .add(typeTo(term, TEXT.wake, T.typeDur), t);
      t += T.typeDur + T.hold1;
      tl.add(decode(term, TEXT.alone, T.scramble), t);
      t += T.scramble + T.hold2;
      tl.to(rain, { glitch: 1, duration: 0.08 }, t)
        .to(termWrap, { opacity: 0, duration: 0.12, ease: 'power1.in' }, t + 0.04)
        .to(rain, { glitch: 0, duration: 0.2 }, t + T.glitch)
        .to(rain, { speed: 1.2, dim: 0.5, duration: 0.5 }, t);

      // 4. the rain writes the wordmark
      var R = t + 0.12;
      tl.call(function () { phase = 1; rain.reveal(T.reveal); }, null, R)
        .to(cvBloom, { opacity: 0.85, duration: 0.6 }, R);
      var C = R + T.reveal - 0.15;
      tl.call(function () { phase = 2; }, null, C)
        .to(cvCrisp, { opacity: 1, duration: T.crisp, ease: 'power2.out' }, C)
        .fromTo(cvCrisp, { filter: 'brightness(2.4)' }, { filter: 'brightness(1)', duration: T.crisp + 0.2, ease: 'power2.out' }, C)
        .to(rain, { heldAlpha: 0.25, speed: 0.9, duration: T.crisp }, C)
        .to(status, { opacity: 1, duration: 0.2 }, C + 0.1)
        .add(typeTo(statusText, TEXT.status, 0.45), C + 0.1);

      // 5. hold, then exit() wipes it away (called from onComplete)
      tl.to({}, { duration: T.hold3 }, C + T.crisp + 0.35);
    }

    /* ---- exit: scanner line wipes the overlay away, site appears ---- */
    function exit(dur) {
      if (exiting) return;
      exiting = true;
      if (tl) tl.pause();
      document.removeEventListener('keydown', onKey);
      gsap.to(skip, { opacity: 0, duration: 0.15 });
      document.dispatchEvent(new CustomEvent('intro:reveal'));      // hero entrance starts with the wipe
      startAmbient();
      gsap.set(sweep, { opacity: 1 });
      var p = { y: 0 }, H = innerHeight + 6;
      gsap.to(p, {
        y: H, duration: dur, ease: 'power2.inOut',
        onUpdate: function () {
          intro.style.clipPath = 'inset(' + p.y + 'px 0 0 0)';
          sweep.style.transform = 'translateY(' + p.y + 'px)';
        },
        onComplete: finish
      });
    }

    function finish() {
      try { sessionStorage.setItem('mplai-intro', '1'); } catch (e) {}
      if (rain) rain.destroy();
      intro.parentNode && intro.parentNode.removeChild(intro);
      sweep.parentNode && sweep.parentNode.removeChild(sweep);
      html.classList.remove('intro-on');
      ['#site-header', '#main', '.site-footer', '#sticky-cta'].forEach(function (sel) {
        var n = document.querySelector(sel); if (n) n.removeAttribute('inert');
      });
      window.scrollTo(0, 0);
      document.dispatchEvent(new CustomEvent('intro:done'));
    }

    function skipNow() {
      if (exiting) return;
      if (rain) { rain.holdAll(); }
      exit(0.5);
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skipNow(); }
    }
    skip.addEventListener('click', function (e) { e.stopPropagation(); skipNow(); });
    document.addEventListener('keydown', onKey);
    intro.addEventListener('pointerdown', function () { if (Date.now() - t0 > 1500) skipNow(); });

    addEventListener('resize', debounce(function () {
      if (exiting || !rain || innerWidth === rain.cssW) return;
      lay = layout(); rain.resize(); paintCrisp();
      if (phase >= 1) rain.holdAll();
    }, 200));

    var fonts = document.fonts
      ? Promise.all([
          API.ready(),
          document.fonts.load('800 100px Syne', 'MultiplAI'),
          document.fonts.load("500 20px 'JetBrains Mono'", 'Svegliati.')
        ]).catch(function () {})
      : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1800); })]).then(build);
  }

  /* ------------------------------------------------------------------ */
  clearTimeout(window.__introBoot);
  if (!gsap || !API) {                                  // scripts failed: show the site as is
    html.classList.remove('intro-on');
    var el = $('intro'); if (el) el.parentNode.removeChild(el);
    document.dispatchEvent(new CustomEvent('intro:reveal'));
    document.dispatchEvent(new CustomEvent('intro:done'));
    return;
  }
  if (html.classList.contains('intro-on') && $('intro')) runIntro();
  else startAmbient();
})();
