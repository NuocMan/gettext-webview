# Gettext Webview

A single-page application to load, view, compare, edit, and download internationalization files (`.po` / `.pot`), built with [Astro](https://astro.build) and [pofile-ts](https://www.npmjs.com/package/pofile-ts).

## Features

- Load multiple `.po` / `.pot` files (one per language)
- Scrollable comparison table: `msgid` plus the `msgstr` of the first two loaded languages
- Parse and serialize PO files via `pofile-ts`

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Start the dev server at `localhost:4321`      |
| `npm run build`   | Build the production site to `./dist/`        |
| `npm run preview` | Preview the production build locally         |

## Project structure

```
src/
├── lib/
│   └── po.ts        # PO file loading / serialization helpers (pofile-ts)
└── pages/
    └── index.astro  # SPA page with the comparison table
```
