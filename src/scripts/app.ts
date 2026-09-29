import type { LoadedPoFile, PoEntry } from '../lib/po.ts';

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const table = document.getElementById('po-table') as HTMLTableElement;
const tableBody = document.getElementById('table-body') as HTMLTableSectionElement;
const placeholder = document.getElementById('placeholder') as HTMLElement;
const langA = document.getElementById('lang-a') as HTMLTableCellElement;
const langB = document.getElementById('lang-b') as HTMLTableCellElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const templateActions = document.getElementById('template-actions') as HTMLElement;
const STORAGE_KEY = 'gettext-webview:slots';
const slots: (LoadedPoFile | null)[] = [null, null];
let template: LoadedPoFile | null = null;
let pendingSlot = 0;
let pendingTemplate = false;

function persist(): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ slots, template }),
    );
  } catch {
    // storage full or unavailable: keep working in-memory
  }
}

function restore(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) {
      slots[0] = (parsed[0] ?? null) as LoadedPoFile | null;
      slots[1] = (parsed[1] ?? null) as LoadedPoFile | null;
    } else if (parsed && typeof parsed === 'object') {
      const data = parsed as { slots?: unknown[]; template?: unknown };
      if (Array.isArray(data.slots)) {
        slots[0] = (data.slots[0] ?? null) as LoadedPoFile | null;
        slots[1] = (data.slots[1] ?? null) as LoadedPoFile | null;
        template = (data.template ?? null) as LoadedPoFile | null;
      }
    }
  } catch {
    // corrupted data: start fresh
  }
}

const applyTheme = (dark: boolean): void => {
  document.documentElement.classList.toggle('dark', dark);
  themeToggle.textContent = dark ? '☀️' : '🌙';
};
const storedTheme = localStorage.getItem('theme');
applyTheme(
  storedTheme
    ? storedTheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches,
);
themeToggle.addEventListener('click', () => {
  const dark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme(dark);
});

async function downloadFile(file: LoadedPoFile): Promise<void> {
  const { poToString } = await import('../lib/po.ts');
  const blob = new Blob([poToString(file)], { type: 'text/x-gettext-translation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener('change', async () => {
  const { loadPoFile } = await import('../lib/po.ts');
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const loaded = await loadPoFile(file);
    if (pendingTemplate) {
      template = loaded;
    } else {
      slots[pendingSlot] = loaded;
    }
  } catch (err) {
    console.error(`Failed to parse ${file.name}`, err);
  }
  fileInput.value = '';
  persist();
  render();
});

function promptLoad(slot: number): void {
  pendingSlot = slot;
  pendingTemplate = false;
  fileInput.value = '';
  fileInput.click();
}

function promptLoadTemplate(): void {
  pendingTemplate = true;
  fileInput.value = '';
  fileInput.click();
}

const warnButtons: (HTMLButtonElement | null)[] = [null, null];
const jumpCursor: number[] = [-1, -1];
let renderedMsgids: string[] = [];
let renderedUnknown = new Set<string>();

function entryMapOf(file: LoadedPoFile): Map<string, PoEntry> {
  return new Map(file.entries.map((e): [string, PoEntry] => [e.msgid, e]));
}

function emptyCount(col: number): number {
  const file = slots[col];
  if (!file) return 0;
  const map = entryMapOf(file);
  return renderedMsgids.reduce(
    (n, msgid) =>
      n +
      (!renderedUnknown.has(msgid) && (map.get(msgid)?.msgstr ?? '') === '' ? 1 : 0),
    0,
  );
}

function refreshWarnings(): void {
  for (const col of [0, 1]) {
    const btn = warnButtons[col];
    if (!btn) continue;
    const n = emptyCount(col);
    if (n > 0) {
      btn.textContent = `⚠ ${n}`;
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  }
}

function jumpToNextEmpty(col: number): void {
  const file = slots[col];
  if (!file) return;
  const map = entryMapOf(file);
  const emptyIndexes = renderedMsgids
    .map((msgid, idx) =>
      !renderedUnknown.has(msgid) && (map.get(msgid)?.msgstr ?? '') === '' ? idx : -1,
    )
    .filter((idx) => idx >= 0);
  if (emptyIndexes.length === 0) return;
  const next = emptyIndexes.find((idx) => idx > jumpCursor[col]);
  const target = next !== undefined ? next : emptyIndexes[0];
  jumpCursor[col] = target;
  const row = tableBody.children[target];
  const td = row?.children[col + 1];
  const textarea = td?.querySelector('textarea');
  if (row && textarea) {
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    textarea.focus();
    textarea.classList.remove('flash');
    void textarea.offsetWidth;
    textarea.classList.add('flash');
    setTimeout(() => textarea.classList.remove('flash'), 1000);
  }
}

function render(): void {
  const loaded = slots.filter((s): s is LoadedPoFile => s !== null);
  placeholder.hidden = loaded.length > 0 || template !== null;
  templateActions.replaceChildren();
  if (!template) {
    const tplLoad = document.createElement('button');
    tplLoad.type = 'button';
    tplLoad.className = 'load';
    tplLoad.textContent = 'Load';
    tplLoad.title = 'Load a .pot template';
    tplLoad.addEventListener('click', promptLoadTemplate);
    templateActions.appendChild(tplLoad);
  } else {
    const tplTag = document.createElement('span');
    tplTag.className = 'tpl-name';
    tplTag.textContent = template.name;
    tplTag.title = 'Template (.pot)';
    templateActions.appendChild(tplTag);
    const tplUnload = document.createElement('button');
    tplUnload.type = 'button';
    tplUnload.textContent = 'Unload';
    tplUnload.addEventListener('click', () => {
      template = null;
      persist();
      render();
    });
    templateActions.appendChild(tplUnload);
  }
  [langA, langB].forEach((th, i) => {
    const file = slots[i];
    th.replaceChildren();
    if (!file) {
      const inner = document.createElement('span');
      inner.className = 'th-inner';
      const actions = document.createElement('span');
      actions.className = 'actions';
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'load';
      load.textContent = 'Load';
      load.addEventListener('click', () => promptLoad(i));
      actions.appendChild(load);
      const fresh = document.createElement('button');
      fresh.type = 'button';
      fresh.textContent = 'New';
      fresh.addEventListener('click', () => {
        slots[i] = {
          name: 'new.po',
          language: 'new',
          entries: slots
            .filter((s): s is LoadedPoFile => s !== null && s !== slots[i])
            .flatMap((s) => s.entries.map((e) => ({ msgid: e.msgid, msgstr: '' }))),
        };
        render();
      });
      actions.appendChild(fresh);
      inner.appendChild(actions);
      th.appendChild(inner);
      return;
    }
    const inner = document.createElement('span');
    inner.className = 'th-inner';
    const head = document.createElement('span');
    head.className = 'lang-head';
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'lang-name';
    name.value = file.language;
    name.setAttribute('aria-label', 'Language name');
    name.addEventListener('input', () => {
      file.language = name.value;
    });
    name.addEventListener('change', persist);
    head.appendChild(name);
    inner.appendChild(head);
    const actions = document.createElement('span');
    actions.className = 'actions';
    const warn = document.createElement('button');
    warn.type = 'button';
    warn.className = 'warn';
    warn.title = 'Jump to next empty msgstr';
    warn.addEventListener('click', () => jumpToNextEmpty(i));
    warnButtons[i] = warn;
    actions.appendChild(warn);
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Download';
    download.addEventListener('click', () => downloadFile(file));
    actions.appendChild(download);
    const unload = document.createElement('button');
    unload.type = 'button';
    unload.textContent = 'Unload';
    unload.addEventListener('click', () => {
      slots[i] = null;
      persist();
      render();
    });
    actions.appendChild(unload);
    inner.appendChild(actions);
    th.appendChild(inner);
  });

  if (loaded.length === 0 && !template) {
    tableBody.replaceChildren();
    return;
  }

  const templateIds = template ? template.entries.map((e) => e.msgid) : [];
  const templateSet = new Set(templateIds);
  const loadedIds = new Set(loaded.flatMap((f) => f.entries.map((e) => e.msgid)));
  const knownIds: string[] = [];
  const unknownIds: string[] = [];
  for (const msgid of loadedIds) {
    if (template && !templateSet.has(msgid)) unknownIds.push(msgid);
    else knownIds.push(msgid);
  }
  if (template) {
    const knownSet = new Set(knownIds);
    knownIds.length = 0;
    for (const id of templateIds) {
      if (knownSet.has(id) || !loadedIds.has(id)) knownIds.push(id);
    }
  }
  renderedMsgids = [...knownIds, ...unknownIds];
  const msgids = renderedMsgids;
  const unknownSet = new Set(unknownIds);
  renderedUnknown = unknownSet;
  jumpCursor[0] = -1;
  jumpCursor[1] = -1;
  const entryMaps = slots.map(
    (f) => (f ? entryMapOf(f) : null),
  );
  const textareas: HTMLTextAreaElement[] = [];
  const rows = document.createDocumentFragment();
  for (const msgid of msgids) {
    const tr = document.createElement('tr');
    const msgidCell = document.createElement('td');
    if (unknownSet.has(msgid)) {
      msgidCell.classList.add('unknown');
      const icon = document.createElement('span');
      icon.className = 'err';
      icon.textContent = '⚠️';
      icon.title = 'msgid not found in template (.pot)';
      msgidCell.appendChild(icon);
    }
    msgidCell.appendChild(document.createTextNode(msgid));
    tr.appendChild(msgidCell);

    for (const [col, entryMap] of entryMaps.entries()) {
      const td = document.createElement('td');
      td.className = 'msgstr';
      if (unknownSet.has(msgid)) td.classList.add('unknown');
      let entry = entryMap?.get(msgid);
      const slot = slots[col];
      if (!entry && slot) {
        entry = { msgid, msgstr: '' };
        slot.entries.push(entry);
        entryMap?.set(msgid, entry);
      }
      if (entry) {
        const current = entry;
        const input = document.createElement('textarea');
        input.rows = 1;
        input.value = current.msgstr;
        input.setAttribute('aria-label', `msgstr for "${msgid}"`);
        const autoSize = () => {
          const needed = input.scrollHeight;
          if (needed > td.offsetHeight) {
            td.style.height = `${needed}px`;
          }
        };
        input.addEventListener('input', () => {
          current.msgstr = input.value;
          input.classList.add('dirty');
          autoSize();
          refreshWarnings();
          persist();
        });
        textareas.push(input);
        td.appendChild(input);
      } else {
        td.textContent = '';
      }
      tr.appendChild(td);
    }
    rows.appendChild(tr);
  }
  tableBody.replaceChildren(rows);
  const heights = textareas.map((ta) => ta.scrollHeight);
  textareas.forEach((ta, i) => {
    if (heights[i] > 0) {
      ta.closest('td')!.style.height = `${heights[i]}px`;
    }
  });
  refreshWarnings();
}

restore();
render();
