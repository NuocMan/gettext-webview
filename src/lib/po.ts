import { parsePo, stringifyPo, type PoItem, type PoFile } from 'pofile-ts';

export interface PoEntry {
  msgid: string;
  msgstr: string;
}

export interface LoadedPoFile {
  name: string;
  language: string;
  entries: PoEntry[];
}

function extractLanguage(name: string, parsed: PoFile): string {
  if (parsed.headers.Language) {
    return parsed.headers.Language;
  }
  const match = name.match(/([a-z]{2,3}(?:[-_][A-Z]{2})?)/i);
  return match ? match[1] : name;
}

function firstMsgstr(item: PoItem): string {
  return Array.isArray(item.msgstr) ? item.msgstr[0] ?? '' : item.msgstr ?? '';
}

export function loadPoText(name: string, text: string): LoadedPoFile {
  const parsed = parsePo(text);
  const entries: PoEntry[] = parsed.items
    .filter((item) => item.msgid !== '')
    .map((item) => ({
      msgid: item.msgid,
      msgstr: firstMsgstr(item),
    }));
  return {
    name,
    language: extractLanguage(name, parsed),
    entries,
  };
}

export async function loadPoFile(file: File): Promise<LoadedPoFile> {
  return loadPoText(file.name, await file.text());
}

export function poToString(loaded: LoadedPoFile): string {
  const poFile: PoFile = {
    comments: [],
    extractedComments: [],
    headers: { Language: loaded.language },
    headerOrder: ['Language'],
    items: loaded.entries.map((entry) => ({
      msgid: entry.msgid,
      msgctxt: null,
      references: [],
      msgid_plural: null,
      msgstr: [entry.msgstr],
      comments: [],
      extractedComments: [],
      flags: {},
      obsolete: false,
    })),
  };
  return stringifyPo(poFile);
}
