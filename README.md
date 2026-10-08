# MultiplAI — sito

Sito vetrina di MultiplAI: formazione e consulenza AI per persone e PMI.
Una pagina sola, HTML/CSS/JS statici, nessun passaggio di build. Animazioni con
[GSAP](https://gsap.com/), ospitato nel sito insieme ai font: nessuna richiesta a
servizi esterni, quindi nessun dato di navigazione verso terzi e il sito funziona
anche offline.

```
index.html                   tutta la pagina
assets/css/style.css         stili (mobile first, breakpoint a 900px), palette "Matrix"
assets/css/intro.css         stili dell'intro
assets/js/matrix-rain.js     motore della pioggia di codice (Canvas 2D)
assets/js/intro.js           regia dell'intro (timeline GSAP) e pioggia di sfondo dell'hero
assets/js/main.js            menu, modulo, mini-quiz, animazioni della pagina
assets/js/vendor/            GSAP e ScrollTrigger
assets/fonts/                font ospitati (licenze in FONT-LICENSES.md)
assets/img/og-image.png      anteprima social 1200×630
```

## L'intro

Alla prima visita della sessione parte una sequenza di circa 6 secondi: si aprono le
palpebre, compare "Svegliati.", la pioggia di codice scrive il logo, sotto il logo
si decifra "Non sei più solo." e subito dopo uno scanner spazza via l'intro. L'hero
risponde al perché: "Hai un team AI." È una sequenza originale in stile cyberpunk,
non una riproduzione di scene o personaggi del film.

**Pillole.** La pillola rossa è il percorso "Per te" (workshop), la blu "Per la tua
azienda": stesso codice colore nei pulsanti dell'hero, nelle due schede "Da dove parti?"
e nei pulsanti di sezione. I pulsanti generici ("Parliamone", "Invia richiesta") restano verdi.

Quando non parte: con `prefers-reduced-motion`, ai link con ancora (`#contatti`), alle
visite successive nella stessa sessione, senza JavaScript (dopo 4 s di sicurezza).
Si salta con il pulsante "Salta", Esc, Invio, Spazio o un tocco dopo 1,5 s.

| Parametro URL | Effetto |
| --- | --- |
| `?intro=1` | forza l'intro (il link "Rivedi l'intro" nel footer lo usa) |
| `?intro=0` | la salta |
| `?nodegrade=1` | disattiva la riduzione automatica della qualità (solo per i test) |

Testi e tempi si cambiano in cima a `assets/js/intro.js` (`TEXT` e `TIMING`). La
palette è nei token `:root` di `style.css`. La pioggia riduce da sola la qualità
(niente strato di fondo e bagliore, poi risoluzione ridotta) se il dispositivo non regge i frame.

## Provarlo in locale

Basta aprire `index.html` nel browser. Con un server locale (consigliato):

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Da completare prima del lancio

| Dove | Cosa |
| --- | --- |
| `index.html` | `[EMAIL]`, `[TELEFONO]`, `[RAGIONE SOCIALE E INDIRIZZO]` |
| `index.html` | foto dei tre fondatori (sostituire il blocco `.portrait`) e bio di Enrico e Simone |
| `index.html` | `[DATE E PREZZO]` dei workshop e i tre `[PREZZO]` dei formati aziendali |
| `index.html` | citazioni e nomi delle testimonianze (`[CITAZIONE]`, `[NOME]`) |
| `index.html` | pagina privacy e Impressum: oggi sono ancore vuote nel footer |
| `assets/js/main.js` | `FORM_ENDPOINT`: finché è vuoto il modulo mostra il ringraziamento ma non invia nulla |

## Il modulo

Il modulo raccoglie nome, email, telefono, azienda, interesse e, per chi sceglie
"Workshop", un mini-questionario sul livello. Serve un servizio che riceva i dati:
[Formspree](https://formspree.io/), [Web3Forms](https://web3forms.com/) o una
funzione serverless. Incollare l'URL in `FORM_ENDPOINT` e il modulo inizia a
inviare, con messaggio di errore se la chiamata fallisce.

C'è un campo trappola nascosto (`website`) contro i bot: se è compilato, l'invio
viene ignorato.

## Pubblicazione

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `root`.
Per il dominio proprio serve un file `CNAME` con `multiplai.ch` e i record DNS
indicati nella [documentazione GitHub](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).
In alternativa Vercel o Netlify: nessuna configurazione, si collega il repo.

## Misurazione

Prima di distribuire flyer e QR: analitica senza cookie (Plausible o Matomo) e un
link diverso per canale, così si sa da dove arrivano i contatti. Il tag va
inserito prima di `</head>`.

## Accessibilità e prestazioni

Testo leggibile anche senza JavaScript, aree cliccabili da 44 px,
`prefers-reduced-motion` rispettato. L'intro è un dialogo con testo alternativo per gli
screen reader e il resto della pagina è `inert` mentre è attivo. Se GSAP o il motore
della pioggia non si caricano, l'intro viene saltata e la pagina resta completa.

**Caratteri.** Titoli, logo e wordmark dell'intro: Martian Mono Bold; testo: IBM Plex Sans; etichette e dettagli: Martian Mono. Tutti OFL, ospitati nel sito. Il wordmark dell'intro usa lo stesso font del logo (costante `WORD_FONT` in `intro.js`). I caratteri originali del film non sono usati: il disegno del loro codice e del titolo è di terzi.
