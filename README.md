# Gettext Webview

A single-page application to load, view, compare, edit, and download internationalization files (`.po` / `.pot`), built with [Astro](https://astro.build) and [pofile-ts](https://www.npmjs.com/package/pofile-ts).

## Features

- **Two language columns** side by side, each independently managed from its floating header:
  - **Load** — pick a `.po` / `.pot` file; it loads immediately (no confirm step)
  - **New** — start a language from scratch, seeded with the msgids already in the table
  - **Unload** — free a column; its data is flushed from storage
  - **Download** — export the language (including your edits) as a `.po` file
  - **Editable language name** — feeds the `Language` header of downloaded files
- **Scrollable comparison table**: `msgid` column plus the two language columns, with rounded, separated row cards and a sticky header
- **Editing**: `msgstr` values are editable in place (multi-line, auto-growing); missing msgids are editable too (a new entry is created on the fly). `msgid` is read-only. Modified cells are highlighted.
- **Empty-translation warning**: each language header shows a `⚠ count` badge when translations are missing; clicking it jumps to the next empty cell, cycling through all of them
- **Persistence**: both language slots are saved to `sessionStorage` on every change and restored on reload; unloading a language flushes its data immediately
- **Light/dark theme**: toggle in the header, respects your OS preference on first visit, and remembers your choice

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
│   └── po.ts        # PO file parsing / serialization (pofile-ts)
├── scripts/
│   └── app.ts       # SPA logic: columns, editing, warnings, persistence
├── styles/
│   └── global.css   # Global styles and theming (light/dark)
└── pages/
    └── index.astro  # Page markup
```

## Notes

- Styles in `global.css` are global (unscoped): the table is built dynamically in JS, so Astro's per-component style scoping would not match the created elements.
- The app supports two language columns; msgids shown are the union of all loaded languages.
- Downloaded files are written with the `Language` header set to the column's language name.
