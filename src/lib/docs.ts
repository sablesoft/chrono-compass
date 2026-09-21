// src/lib/docs.ts
import { writable } from 'svelte/store';

export type DocLanguage = {
    code: string;
    label: string;
};

export const DOC_LANGUAGES: DocLanguage[] = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
];

export type DocsState = {
    open: boolean;
    loading: boolean;
    md: string;
    url: string;
    title: string;
    lang: string;
    languages: DocLanguage[];
};

const DOCS_LANG_STORAGE_KEY = 'chrono-docs-lang';

export function getPreferredLang2(): string {
    if (typeof window !== 'undefined') {
        try {
            const saved = window.localStorage.getItem(DOCS_LANG_STORAGE_KEY);
            if (saved && DOC_LANGUAGES.some(lang => lang.code === saved)) return saved;
        } catch {}
    }

    if (typeof navigator === 'undefined') return 'en';

    const languages = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

    return languages.some(lang => lang?.toLowerCase().startsWith('ru'))
        ? 'ru'
        : 'en';
}

function savePreferredLang2(lang: string) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(DOCS_LANG_STORAGE_KEY, lang);
    } catch {}
}

function isHtml(text: string): boolean {
    return /^\s*<!doctype\s+html/i.test(text) || /^\s*<html\b/i.test(text);
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const text = await res.text();
    if (isHtml(text)) throw new Error(`Got HTML instead of markdown for ${url}`);
    return text;
}

async function loadDocExact(path: string, lang: string): Promise<{ url: string; md: string; lang: string }> {
    const cleanPath = path.replace(/^\/+/, '');
    const url = `/docs/${lang}/${cleanPath}`;
    const md = await fetchText(url);
    return { url, md, lang };
}

/**
 * Loads docs from:
 *   /docs/{lang2}/{path}
 * with fallback to:
 *   /docs/en/{path}
 */
export async function loadDoc(path: string, lang2?: string): Promise<{ url: string; md: string; lang: string }> {
    const lang = lang2 || getPreferredLang2();

    try {
        return await loadDocExact(path, lang);
    } catch {
        if (lang === 'en') throw new Error(`Docs unavailable for ${path}`);
        return loadDocExact(path, 'en');
    }
}

async function availableLanguages(path: string): Promise<DocLanguage[]> {
    const checks = await Promise.all(
        DOC_LANGUAGES.map(async language => {
            try {
                await loadDocExact(path, language.code);
                return language;
            } catch {
                return null;
            }
        })
    );

    return checks.filter((language): language is DocLanguage => language !== null);
}

function titleFromPath(path: string): string {
    const clean = path.replace(/^\/+/, '');
    const file = clean.split('/').pop() || 'docs';
    const base = file.replace(/\.md$/i, '');

    return base
        .split(/[-_]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export function useDocs(
    getPath: () => string,
    opts?: {
        getTitle?: () => string;
        dbg?: { log: Function; warn: Function; group: Function };
        tag?: () => string;
    }
) {
    const state = writable<DocsState>({
        open: false,
        loading: false,
        md: '',
        url: '',
        title: '',
        lang: getPreferredLang2(),
        languages: []
    });

    let runId = 0;
    let currentTitle = '';

    async function loadIntoState(path: string, lang?: string, discoverLanguages = false) {
        const myRun = ++runId;

        state.update(s => ({
            ...s,
            loading: true,
            md: '',
            url: ''
        }));

        try {
            const [doc, languages] = await Promise.all([
                loadDoc(path, lang),
                discoverLanguages ? availableLanguages(path) : Promise.resolve(null)
            ]);

            if (myRun !== runId) return;

            state.update(s => ({
                ...s,
                loading: false,
                url: doc.url,
                md: doc.md,
                lang: doc.lang,
                languages: languages ?? s.languages
            }));
        } catch (e) {
            if (myRun !== runId) return;

            const msg = `# Docs unavailable\n\n${String(e)}`;
            opts?.dbg?.warn?.('docs load failed', { err: String(e), path });

            state.update(s => ({
                ...s,
                loading: false,
                md: msg
            }));
        }
    }

    async function openDocs() {
        const path = getPath();
        currentTitle = opts?.getTitle?.() ?? `${titleFromPath(path)} — Docs`;

        state.set({
            open: true,
            loading: true,
            md: '',
            url: '',
            title: currentTitle,
            lang: getPreferredLang2(),
            languages: []
        });

        opts?.dbg?.group?.(`${opts?.tag?.() ?? ''} docs.open`, () =>
            opts?.dbg?.log?.('openDocs', { path })
        );

        await loadIntoState(path, getPreferredLang2(), true);
    }

    async function selectLanguage(lang: string) {
        if (!DOC_LANGUAGES.some(language => language.code === lang)) return;

        const path = getPath();
        savePreferredLang2(lang);
        await loadIntoState(path, lang, false);
    }

    function closeDocs() {
        runId++;
        state.update(s => ({ ...s, open: false }));
    }

    return {
        state,
        openDocs,
        selectLanguage,
        closeDocs
    };
}
