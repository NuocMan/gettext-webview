      const fileInput = document.getElementById('file-input');
      const table = document.getElementById('po-table');
      const tableBody = document.getElementById('table-body');
      const placeholder = document.getElementById('placeholder');
      const langA = document.getElementById('lang-a');
      const langB = document.getElementById('lang-b');
      const themeToggle = document.getElementById('theme-toggle');
      const STORAGE_KEY = 'gettext-webview:slots';
      const slots = [null, null];
      let pendingSlot = 0;

      function persist() {
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(slots),
          );
        } catch {
          // storage full or unavailable: keep working in-memory
        }
      }

      function restore() {
        try {
          const raw = sessionStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === 2) {
            slots[0] = parsed[0];
            slots[1] = parsed[1];
          }
        } catch {
          // corrupted data: start fresh
        }
      }

      const applyTheme = (dark) => {
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

      async function downloadFile(file) {
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
        const file = fileInput.files[0];
        if (!file) return;
        try {
          slots[pendingSlot] = await loadPoFile(file);
        } catch (err) {
          console.error(`Failed to parse ${file.name}`, err);
        }
        fileInput.value = '';
        persist();
        render();
      });

      function promptLoad(slot) {
        pendingSlot = slot;
        fileInput.value = '';
        fileInput.click();
      }

      const warnButtons = [null, null];
      const jumpCursor = [-1, -1];
      let renderedMsgids = [];

      function emptyCount(col) {
        const file = slots[col];
        if (!file) return 0;
        const map = new Map(file.entries.map((e) => [e.msgid, e]));
        return renderedMsgids.reduce(
          (n, msgid) => n + ((map.get(msgid)?.msgstr ?? '') === '' ? 1 : 0),
          0,
        );
      }

      function refreshWarnings() {
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

      function jumpToNextEmpty(col) {
        const file = slots[col];
        if (!file) return;
        const map = new Map(file.entries.map((e) => [e.msgid, e]));
        const emptyIndexes = renderedMsgids
          .map((msgid, idx) => ((map.get(msgid)?.msgstr ?? '') === '' ? idx : -1))
          .filter((idx) => idx >= 0);
        if (emptyIndexes.length === 0) return;
        const next = emptyIndexes.find((idx) => idx > jumpCursor[col]);
        const target = next !== undefined ? next : emptyIndexes[0];
        jumpCursor[col] = target;
        const row = tableBody.children[target];
        const td = row?.children[col + 1];
        const textarea = td?.querySelector('textarea');
        if (textarea) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          textarea.focus();
          textarea.classList.remove('flash');
          void textarea.offsetWidth;
          textarea.classList.add('flash');
          setTimeout(() => textarea.classList.remove('flash'), 1000);
        }
      }

      function render() {
        const loaded = slots.filter((s) => s !== null);
        placeholder.hidden = loaded.length > 0;
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
                  .filter((s) => s && s !== slots[i])
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

        if (loaded.length === 0) {
          tableBody.replaceChildren();
          return;
        }

        renderedMsgids = [...new Set(loaded.flatMap((f) => f.entries.map((e) => e.msgid)))];
        const msgids = renderedMsgids;
        jumpCursor[0] = -1;
        jumpCursor[1] = -1;
        const entryMaps = slots.map(
          (f) => (f ? new Map(f.entries.map((e) => [e.msgid, e])) : null),
        );
        const textareas = [];
        const rows = document.createDocumentFragment();
        for (const msgid of msgids) {
          const tr = document.createElement('tr');
          const msgidCell = document.createElement('td');
          msgidCell.textContent = msgid;
          tr.appendChild(msgidCell);

          for (const [col, entryMap] of entryMaps.entries()) {
            const td = document.createElement('td');
            td.className = 'msgstr';
            let entry = entryMap?.get(msgid);
            if (!entry && slots[col]) {
              entry = { msgid, msgstr: '' };
              slots[col].entries.push(entry);
              entryMap?.set(msgid, entry);
            }
            if (entry) {
              const input = document.createElement('textarea');
              input.rows = 1;
              input.value = entry.msgstr;
              input.setAttribute('aria-label', `msgstr for "${msgid}"`);
              const autoSize = () => {
                const needed = input.scrollHeight;
                if (needed > td.offsetHeight) {
                  td.style.height = `${needed}px`;
                }
              };
              input.addEventListener('input', () => {
                entry.msgstr = input.value;
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
            ta.closest('td').style.height = `${heights[i]}px`;
          }
        });
        refreshWarnings();
      }

      restore();
      render();
