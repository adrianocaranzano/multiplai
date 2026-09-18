# MultiplAI — sito

Sito vetrina di MultiplAI: formazione e consulenza AI per persone e PMI.
Una pagina sola, HTML/CSS/JS statici, nessun passaggio di build. Animazioni con
[GSAP](https://gsap.com/) caricato da CDN, sobrie e disattivabili.

```
index.html              tutta la pagina
assets/css/style.css    stili (mobile first, breakpoint a 900px)
assets/js/main.js       menu, modulo, mini-quiz, animazioni
```

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
| `index.html` | `og:image` (1200×630) per le anteprime sui social |
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

Testo leggibile anche senza JavaScript, contrasti conformi a WCAG AA, aree
cliccabili da 44 px, `prefers-reduced-motion` rispettato. Se la CDN di GSAP non
risponde, la pagina resta completa e statica.
