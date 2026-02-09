// src/lib/wheel/ui/useWheelDocs.ts
import { CYCLE_META } from '../../cycles/meta';
import type { CycleKind } from '../../cycles/types';
import { loadCycleDoc } from '../../docs';

export function useWheelDocs(getKind: () => CycleKind, dbg?: { log: Function; warn: Function; group: Function }, wheelTag?: () => string) {
    let open = false;
    let loading = false;
    let md = '';
    let url = '';
    let title = '';

    async function openDocs() {
        const kind = getKind();
        open = true;
        loading = true;
        md = '';
        url = '';
        title = `${CYCLE_META[kind].label} — Docs`;

        dbg?.group?.(`${wheelTag?.() ?? ''} docs.open`, () => dbg?.log?.('openDocs', { kind }));

        try {
            const { url: u, md: m, lang } = await loadCycleDoc(kind);
            url = u;
            md = m;
            title = `${CYCLE_META[kind].label} — Docs (${lang})`;
        } catch (e) {
            md = `# Docs unavailable\n\n${String(e)}`;
            dbg?.warn?.('docs load failed', { err: String(e) });
        } finally {
            loading = false;
        }
    }

    function closeDocs() {
        open = false;
    }

    return {
        get open() { return open; },
        get loading() { return loading; },
        get md() { return md; },
        get url() { return url; },
        get title() { return title; },
        openDocs,
        closeDocs
    };
}
