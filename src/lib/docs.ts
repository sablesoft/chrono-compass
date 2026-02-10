// src/lib/docs.ts
import { writable } from 'svelte/store';

export type DocsState = {
    open: boolean;
    loading: boolean;
    md: string;
    url: string;
    title: string;
};

function getPreferredLang2(): string {
    if (typeof navigator === 'undefined') return 'en';

    const list = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || 'en'];

    const first = (list[0] || 'en').toLowerCase();
    const lang2 = first.split('-')[0]?.slice(0, 2) || 'en';

    return /^[a-z]{2}$/.test(lang2) ? lang2 : 'en';
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

/**
 * Loads docs from:
 *   /docs/{lang2}/{path}
 * with fallback to:
 *   /docs/en/{path}
 *
 * Input example:
 *   "cycles/diurnal.md"
 *   "wheels/compass-wheel.md"
 */
export async function loadDoc(path: string, lang2?: string): Promise<{ url: string; md: string; lang: string }> {
    const lang = lang2 || getPreferredLang2();

    const cleanPath = path.replace(/^\/+/, ''); // no leading slash
    const url1 = `/docs/${lang}/${cleanPath}`;

    try {
        const md = await fetchText(url1);
        if (/^\s*<!doctype\s+html/i.test(md) || /^\s*<html\b/i.test(md)) {
            throw new Error(`Got HTML instead of markdown for ${url1}`);
        }
        return { url: url1, md, lang };
    } catch {
        const url2 = `/docs/en/${cleanPath}`;
        const md = await fetchText(url2);
        if (/^\s*<!doctype\s+html/i.test(md) || /^\s*<html\b/i.test(md)) {
            throw new Error(`Got HTML instead of markdown for ${url2}`);
        }
        return { url: url2, md, lang: 'en' };
    }
}

function titleFromPath(path: string): string {
    const clean = path.replace(/^\/+/, '');
    const file = clean.split('/').pop() || 'docs';
    const base = file.replace(/\.md$/i, '');

    return base
        .split(/[-_]+/)               // kebab-case + snake_case
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
        title: ''
    });

    let runId = 0;

    async function openDocs() {
        const path = getPath();
        const myRun = ++runId;

        const title = opts?.getTitle?.() ?? `${titleFromPath(path)} — Docs`;

        state.set({
            open: true,
            loading: true,
            md: '',
            url: '',
            title
        });

        opts?.dbg?.group?.(`${opts?.tag?.() ?? ''} docs.open`, () =>
            opts?.dbg?.log?.('openDocs', { path })
        );

        try {
            const { url, md, lang } = await loadDoc(path);

            if (myRun !== runId) return;

            state.update(s => ({
                ...s,
                loading: false,
                url,
                md,
                title: `${title} (${lang})`
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

    function closeDocs() {
        runId++; // invalidate any in-flight load
        state.update(s => ({ ...s, open: false }));
    }

    return {
        state,
        openDocs,
        closeDocs
    };
}
