/* MultiplAI — interazioni e animazioni.
   Regole: il contenuto è leggibile anche senza JavaScript, niente scroll-jacking,
   e chi ha ridotto le animazioni di sistema non ne vede nessuna. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- anno nel footer ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- menu mobile ---------- */
  var burger = $('#burger'), navMobile = $('#nav-mobile');
  if (burger && navMobile) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      burger.setAttribute('aria-label', open ? 'Apri il menu' : 'Chiudi il menu');
      navMobile.hidden = open;
    });
    $$('a', navMobile).forEach(function (a) {
      a.addEventListener('click', function () {
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Apri il menu');
        navMobile.hidden = true;
      });
    });
  }

  /* ---------- ombra dell'intestazione ---------- */
  var header = $('#site-header');
  var sticky = $('#sticky-cta');
  var contact = $('#contatto');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
    if (sticky) {
      var pastHero = window.scrollY > window.innerHeight * 0.8;
      var atForm = contact && contact.getBoundingClientRect().top < window.innerHeight * 0.9;
      sticky.hidden = !(pastHero && !atForm);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- modulo: chip d'interesse e mini-quiz ---------- */
  var chips = $$('.chip');
  var hidden = $('#interesse');
  var quiz = $('#quiz');
  function setInterest(value) {
    if (hidden) hidden.value = value || '';
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.value === value));
    });
    if (quiz) quiz.hidden = value !== 'workshop' && value !== 'team';
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      setInterest(c.getAttribute('aria-pressed') === 'true' ? '' : c.dataset.value);
    });
  });
  // i pulsanti che puntano al modulo preselezionano l'interesse
  $$('[data-interest]').forEach(function (a) {
    a.addEventListener('click', function () { setInterest(a.dataset.interest); });
  });

  /* ---------- invio del modulo ----------
     FORM_ENDPOINT: incollare qui l'URL del servizio che riceve le richieste
     (Formspree, Web3Forms, una funzione serverless…). Finché è vuoto il modulo
     non invia nulla: mostra il messaggio di conferma e scrive i dati in console. */
  var FORM_ENDPOINT = '';

  var form = $('#lead-form'), thanks = $('#thanks'), errBox = $('#form-error'), submitBtn = $('#submit-btn');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errBox) errBox.hidden = true;
      if ($('#website') && $('#website').value) return; // bot
      if (!form.checkValidity()) {
        if (errBox) { errBox.textContent = 'Controlla nome ed email, per favore.'; errBox.hidden = false; }
        var firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      var data = new FormData(form);
      data.append('usi', $$('input[name=uso]:checked').map(function (i) { return i.value; }).join(', '));

      function done() {
        form.hidden = true;
        if (thanks) { thanks.hidden = false; thanks.focus && thanks.focus(); }
      }
      function fail() {
        if (errBox) { errBox.textContent = "Non siamo riusciti a inviare la richiesta. Scrivici a [EMAIL] e ci pensiamo noi."; errBox.hidden = false; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Invia richiesta'; }
      }

      if (!FORM_ENDPOINT) { console.log('Richiesta (endpoint non configurato):', Object.fromEntries(data.entries())); done(); return; }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Invio…'; }
      fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? done() : fail(); })
        .catch(fail);
    });
  }
  var resetBtn = $('#reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset(); setInterest(''); form.hidden = false;
      if (thanks) thanks.hidden = true;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Invia richiesta'; }
    });
  }

  /* ---------- animazioni ---------- */
  function showAll() {
    $$('[data-anim]').forEach(function (el) { el.style.opacity = 1; });
    $$('.spokes line').forEach(function (l) { l.style.opacity = 1; });
  }
  if (reduce) { showAll(); return; }

  window.addEventListener('load', function () {
    if (!window.gsap) { showAll(); return; }          // CDN non raggiungibile: nessuna animazione, contenuto visibile
    var gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // hero: testo che sale, raggi che si disegnano, nodi che compaiono
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to('.hero-text [data-anim]', { opacity: 1, y: 0, duration: .55, stagger: .08, startAt: { y: 18 } });
    $$('.spokes line').forEach(function (l) {
      var len = l.getTotalLength ? l.getTotalLength() : 200;
      gsap.set(l, { opacity: 1, strokeDasharray: len, strokeDashoffset: len });
    });
    tl.to('.spokes line', { strokeDashoffset: 0, duration: .7, stagger: .06 }, '-=.25')
      .from('.nodes circle', { scale: .6, opacity: 0, transformOrigin: '50% 50%', duration: .45, stagger: .06 }, '-=.5')
      .from('.node-labels text', { opacity: 0, duration: .3, stagger: .06 }, '-=.35');

    // sezioni: comparsa breve, una volta sola
    var rest = $$('[data-anim=up]').filter(function (el) { return !el.closest('.hero-text'); });
    if (window.ScrollTrigger && rest.length) {
      window.ScrollTrigger.batch(rest, {
        start: 'top 88%',
        once: true,
        onEnter: function (els) {
          gsap.to(els, { opacity: 1, y: 0, duration: .5, stagger: .07, ease: 'power2.out', startAt: { y: 22 } });
        }
      });
    } else {
      showAll();
    }
  });
})();
