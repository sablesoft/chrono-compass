// src/lib/docs.ts
export function kindToFilename(kind: string): string {
    // camelCase / PascalCase -> kebab-case
    return kind
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[_\s]+/g, '-')
        .toLowerCase();
}

export function getPreferredLang2(): string {
    if (typeof navigator === 'undefined') return 'en';

    const list = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || 'en'];

    const first = (list[0] || 'en').toLowerCase();
    // "pt-BR" -> "pt"
    const lang2 = first.split('-')[0]?.slice(0, 2) || 'en';

    // защитимся от странностей типа "C"
    return /^[a-z]{2}$/.test(lang2) ? lang2 : 'en';
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

export async function loadCycleDoc(kind: string, lang2?: string): Promise<{ url: string; md: string; lang: string }> {
    const filename = kindToFilename(kind);
    const lang = lang2 || getPreferredLang2();

    const url1 = `/docs/${lang}/cycles/${filename}.md`;
    try {
        const md = await fetchText(url1);
        return { url: url1, md, lang };
    } catch {
        const url2 = `/docs/en/cycles/${filename}.md`;
        const md = await fetchText(url2);
        return { url: url2, md, lang: 'en' };
    }
}
