// src/lib/wheel/ui/useWheelDocs.ts
import { writable } from 'svelte/store';
import { CYCLE_META } from '../../cycles/meta';
import type { CycleKind } from '../../cycles/types';
import { loadCycleDoc } from '../../docs';

export type WheelDocsState = {
    open: boolean;
    loading: boolean;
    md: string;
    url: string;
    title: string;
};

export function useWheelDocs(
    getKind: () => CycleKind,
    dbg?: { log: Function; warn: Function; group: Function },
    wheelTag?: () => string
) {
    const state = writable<WheelDocsState>({
        open: false,
        loading: false,
        md: '',
        url: '',
        title: ''
    });

    // анти-гонки для async
    let runId = 0;

    async function openDocs() {
        const kind = getKind();
        const myRun = ++runId;

        state.set({
            open: true,
            loading: true,
            md: '',
            url: '',
            title: `${CYCLE_META[kind].label} — Docs`
        });

        dbg?.group?.(`${wheelTag?.() ?? ''} docs.open`, () => dbg?.log?.('openDocs', { kind }));

        try {
            const { url, md, lang } = await loadCycleDoc(kind);

            // если за время загрузки успели закрыть/открыть другое — игнорим
            if (myRun !== runId) return;

            state.update(s => ({
                ...s,
                loading: false,
                url,
                md,
                title: `${CYCLE_META[kind].label} — Docs (${lang})`
            }));
        } catch (e) {
            if (myRun !== runId) return;

            const msg = `# Docs unavailable\n\n${String(e)}`;
            dbg?.warn?.('docs load failed', { err: String(e) });

            state.update(s => ({
                ...s,
                loading: false,
                md: msg
            }));
        }
    }

    function closeDocs() {
        // инвалидация текущего запроса
        runId++;

        state.update(s => ({
            ...s,
            open: false
        }));
    }

    return {
        state,
        openDocs,
        closeDocs
    };
}
