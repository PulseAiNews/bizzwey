# BizzWey corporate landing page

Static, self-contained landing page for `https://www.bizzwey.com/`.

## Scope

- English is the reference language.
- Fifteen complete translations are included: French, Spanish, German, Italian, Portuguese, Dutch, Polish, Turkish, Arabic, Simplified Chinese, Japanese, Korean, Hindi, Indonesian and Russian.
- Arabic automatically switches the page to right-to-left layout.
- No external JavaScript, font, image or analytics dependency.
- The page respects `prefers-reduced-motion` and remains readable without JavaScript.

## Production target

VPS5 / WeyGate static root: `/var/www/bizzwey/`

Copy the contents of this directory to the production root. Do not copy or deploy `apps/weynews-web`, and do not modify `/var/www/weycockpit`.

## Local preview

```bash
python3 -m http.server 4173 --directory sites/bizzwey.com
```

Then open `http://127.0.0.1:4173/`.
