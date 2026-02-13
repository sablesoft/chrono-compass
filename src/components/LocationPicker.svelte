<!-- src/components/LocationPicker.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Portal from 'svelte-portal';
    import { debug } from '../lib/debug';

    import {
        currentLocation,
        savedLocations,
        setLocation,
        saveLocation,
        deleteSavedLocation,
        trySetGeolocationAsCurrentOnce,
        getSystemTimeZone,
        ensureAtLeastOneSavedLocation,
        getGreenwichLocation
    } from '../lib/location/store';

    import { IANA_TIMEZONES } from '../lib/location/iana';
    import type { Location, SavedLocation } from '../lib/location/types';

    const dbg = debug('Location', '📍');

    /**
     * CONTROLLED API
     * - value: текущая локация для конкретного колеса/хедера
     * - locked: замок для конкретного колеса/хедера
     * - onChange: сообщаем наверх, что выбрана/изменена локация
     * - onToggleLock: сообщаем наверх, что замок переключили
     *
     * Backward-compatible:
     * - если value === null → берём $currentLocation (global)
     * - если onChange не задан → пишем в global store (setLocation)
     *
     * IMPORTANT (new UX):
     * - НИКАКИХ авто-emit на input/change.
     * - Пользователь правит draft, затем жмёт Apply → только тогда emit + close.
     */
    export let value: Location | null = null;
    export let locked = false;

    export let onToggleLock: ((next: boolean) => void) | null = null;

    type ChangeMeta = { savedId: string; lockOnApply?: boolean };

    export let onChange: ((loc: Location, meta: ChangeMeta) => void) | null = null;

    let faceLoc: Location;
    $: faceLoc = value ?? $currentLocation;

    function emitToggleLock(next: boolean) {
        if (onToggleLock) onToggleLock(next);
        else locked = next; // fallback
    }

    let open = false;
    let modalEl: HTMLDivElement | null = null;

    // selected saved id (must exist on Apply)
    let selectedId = '';

    // drafts
    let labelDraft = '';
    let latDraft = '';
    let lonDraft = '';
    let tzDraft = '';
    let tzSearch = '';
    let filteredTz: string[] = [];

    const COORD_DP = 3;

    function roundCoord(v: number, dp = COORD_DP) {
        return Number(v.toFixed(dp));
    }
    function fmtCoord(v: number) {
        return roundCoord(v, COORD_DP).toFixed(COORD_DP);
    }

    function getOffsetLabel(tz: string) {
        try {
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset'
            }).formatToParts(now);

            const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
            return offset.replace('GMT', 'UTC');
        } catch {
            return '';
        }
    }

    function syncDraftFromLocation(loc: Location) {
        labelDraft = (loc.label ?? 'New place').trim();
        latDraft = fmtCoord(loc.lat ?? 0);
        lonDraft = fmtCoord(loc.lon ?? 0);
        tzDraft = (loc.tz && loc.tz.trim()) ? loc.tz.trim() : (getSystemTimeZone() || 'UTC');
    }

    function syncDraftFromValue() {
        syncDraftFromLocation(faceLoc);
    }

    function parseDraft(): Location | null {
        const lat = Number(String(latDraft).replace(',', '.'));
        const lon = Number(String(lonDraft).replace(',', '.'));
        const label = (labelDraft || 'New place').trim();
        const tz = (tzDraft || getSystemTimeZone() || 'UTC').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const latN = Math.max(-90, Math.min(90, lat));
        const lonN = ((lon + 180) % 360 + 360) % 360 - 180;

        return {
            lat: roundCoord(latN),
            lon: roundCoord(lonN),
            label: label || 'New place',
            tz
        };
    }

    function newLoc() {
        selectedId = '';
        syncDraftFromValue();
    }

    function pickSaved(id: string) {
        const p = $savedLocations.find((x: SavedLocation) => x.id === id);
        if (!p) return;

        selectedId = id;
        syncDraftFromLocation({ lat: p.lat, lon: p.lon, label: p.label, tz: p.tz });
    }

    function onPickChange(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLSelectElement)) return;
        pickSaved(el.value);
    }

    function save() {
        const loc = parseDraft();
        if (!loc) return;

        const id = saveLocation(loc);
        if (!id) return;

        selectedId = id;
    }

    function del() {
        if (!selectedId) return;
        deleteSavedLocation(selectedId);
        selectedId = '';
    }

    function ensureSelectedIdOrCreateFallback(loc: Location): string {
        // selectedId points to existing saved → ok
        if (selectedId && $savedLocations.some((x) => x.id === selectedId)) return selectedId;

        // any saved exists → pick first
        if ($savedLocations.length) {
            selectedId = $savedLocations[0].id;
            return selectedId;
        }

        // none → create fallback saved
        selectedId = ensureAtLeastOneSavedLocation(loc);
        return selectedId;
    }

    function apply() {
        const loc = parseDraft() ?? faceLoc ?? getGreenwichLocation();

        // guarantee there is ALWAYS a saved location id
        const savedId = ensureSelectedIdOrCreateFallback(loc);

        // GLOBAL mode (value===null): face renders from $currentLocation, so keep it synced
        if (value === null) setLocation(loc);

        if (onChange) {
            onChange(loc, { savedId, lockOnApply: value !== null });
        } else {
            // fallback global apply
            setLocation(loc);
        }

        close('apply');
    }

    function openModal() {
        open = true;

        // enforce invariant globally: at least 1 saved exists
        ensureAtLeastOneSavedLocation(faceLoc ?? getGreenwichLocation());

        syncDraftFromValue();

        // best-effort: highlight matching saved
        const cur = faceLoc;
        const hit = $savedLocations.find((p: SavedLocation) =>
            Math.abs(p.lat - cur.lat) < 1e-9 &&
            Math.abs(p.lon - cur.lon) < 1e-9 &&
            p.label === cur.label &&
            p.tz === cur.tz
        );
        selectedId = hit?.id ?? ($savedLocations[0]?.id ?? '');

        document.body.style.overflow = 'hidden';

        queueMicrotask(() => {
            modalEl?.focus();

            // GPS hint only for global mode
            if (value === null) {
                trySetGeolocationAsCurrentOnce();
            }
        });
    }

    function close(reason = 'close') {
        open = false;
        document.body.style.overflow = '';
        dbg.log?.('close', reason);
    }

    function toggle() {
        open ? close('toggle') : openModal();
    }

    function toggleLock(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        emitToggleLock(!locked);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            close('esc');
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => {
        window.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = '';
    });

    $: {
        const q = (tzSearch || '').trim().toLowerCase();
        filteredTz = q ? IANA_TIMEZONES.filter((t) => t.toLowerCase().includes(q)) : IANA_TIMEZONES.slice(0, 60);
    }
</script>

<div class="wrap">
    <div
            class="face"
            role="button"
            tabindex="0"
            aria-haspopup="dialog"
            aria-expanded={open}
            on:click|stopPropagation={toggle}
            on:keydown|stopPropagation={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    }}
    >
    <span class="left seg">
      <span class="label" title={faceLoc.label}>{faceLoc.label}</span>
    </span>

        <span class="right">
      <span class="tz seg tzSeg" title={faceLoc.tz}>
        {getOffsetLabel(faceLoc.tz)}
      </span>

        <button
                class="lockBtn seg ui-lock"
                class:locked={locked}
                type="button"
                aria-label={locked ? 'Unlock location' : 'Lock location'}
                title={locked ? 'Location locked' : 'Location follows global'}
                on:click|stopPropagation={toggleLock}
        >
          <span class="lockIco" aria-hidden="true">{locked ? '🔒' : '🔓'}</span>
        </button>
    </span>
    </div>
</div>

{#if open}
    <Portal target="body">
        <div class="overlay" on:click={(e) => { if (e.target === e.currentTarget) close('overlay'); }}>
            <div
                    class="modal"
                    bind:this={modalEl}
                    tabindex="-1"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Location picker"
                    on:click|stopPropagation
            >
                <header class="modalTop">
                    <div class="modalTitle">Location</div>
                    <button class="x" type="button" aria-label="Close" on:click={() => close('x')}>×</button>
                </header>

                <div class="modalBody">
                    <div class="row2">
                        <div class="field">
                            <label class="lbl">Saved</label>
                            <select class="sel" bind:value={selectedId} on:change={onPickChange}>
                                <option value="" disabled>{$savedLocations.length ? 'Pick…' : 'No saved locations'}</option>
                                {#each $savedLocations as p}
                                    <option value={p.id}>{p.label} · {getOffsetLabel(p.tz)}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="field">
                            <label class="lbl">Name</label>
                            <input class="inp" bind:value={labelDraft} />
                        </div>
                    </div>

                    <div class="row3">
                        <div class="field">
                            <label class="lbl">Lat</label>
                            <input class="inp" bind:value={latDraft} inputmode="decimal" />
                        </div>
                        <div class="field">
                            <label class="lbl">Lon</label>
                            <input class="inp" bind:value={lonDraft} inputmode="decimal" />
                        </div>
                        <div class="field">
                            <label class="lbl">TZ</label>
                            <button
                                    class="miniBtn"
                                    type="button"
                                    title="Use system time zone"
                                    on:click={() => { tzDraft = getSystemTimeZone() || 'UTC'; }}
                            >
                                System
                            </button>
                        </div>
                    </div>

                    <div class="tzBlock">
                        <div class="tzTop">
                            <div class="lbl2">Timezone</div>
                            <div class="hint">{faceLoc.tz} · {getOffsetLabel(faceLoc.tz)}</div>
                        </div>

                        <input class="inp" placeholder="Search IANA timezone..." bind:value={tzSearch} />

                        <select class="sel tzList" size="7" bind:value={tzDraft}>
                            {#each filteredTz as tz}
                                <option value={tz}>{tz} · {getOffsetLabel(tz)}</option>
                            {/each}
                        </select>

                        <div class="hint2">
                            System detected: {getSystemTimeZone()} · {getOffsetLabel(getSystemTimeZone() || 'UTC')}
                        </div>
                    </div>
                </div>

                <footer class="modalBottom">
                    <div class="leftBtns">
                        <button class="btn ghost" type="button" on:click={newLoc}>New</button>
                        <button class="btn danger" type="button" on:click={del} disabled={!selectedId}>Delete</button>
                        <button class="btn" type="button" on:click={save}>Save</button>
                    </div>

                    <div class="rightBtns">
                        <button class="btn ghost" type="button" on:click={() => close('close')}>Close</button>
                        <button class="btn primary" type="button" on:click={apply}>Apply</button>
                    </div>
                </footer>
            </div>
        </div>
    </Portal>
{/if}

<style>
    .wrap {
        position: relative;
        min-width: 0;
    }

    /* === FACE как у TimePicker: капсула + сегменты === */
    .face {
        width: 100%;
        display: inline-flex;
        align-items: stretch;              /* как у TimePicker */
        border-radius: 12px;               /* было 14px → как у TimePicker */
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        overflow: hidden;                  /* важно для сегментов */
        min-width: 0;
        cursor: pointer;
    }

    /* делаем внутренности сегментами */
    .left,
    .right {
        display: inline-flex;
        align-items: center;
        min-width: 0;
    }

    /* label-сегмент */
    .left {
        padding: 6px 10px;                 /* похоже на seg padding */
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;                    /* занимает остаток */
    }

    /* tz+lock сегменты справа */
    .right {
        margin-left: auto;
        flex: 0 0 auto;
    }

    /* общий стиль “сегмента” (как button.seg) */
    .seg {
        border-radius: 0;
        background: transparent;
        outline: none;
        box-shadow: none;
        padding: 6px 10px;
        min-width: 0;                      /* 🔥 не раздуваемся */
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        height: auto;
    }

    /* визуальные разделители между сегментами */
    .seg + .seg {
        border-left: 1px solid var(--btn-border);
    }

    /* hover/focus как в TimePicker */
    .seg:hover {
        outline: none;
        box-shadow: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    .seg:focus,
    .seg:focus-visible {
        outline: none;
        box-shadow: none;
    }

    /* label */
    .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 850;
        font-size: 15px;                   /* как timeText */
        letter-spacing: 0.01em;
        opacity: 0.95;
    }

    /* tz */
    .tz {
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
        font-weight: 850;
        white-space: nowrap;
        font-size: 13px;
        letter-spacing: 0.04em;
    }

    /* применяем seg-стили к конкретным кускам разметки */
    .left { }
    .right .tzWrap { } /* если решишь обернуть tz в div позже — не помешает */

    /* хелпер: чтобы tz и lock были сегментами */
    .tzSeg {
        width: 58px;                       /* компактно, но читаемо */
        justify-content: center;
        padding: 6px 8px;
    }

    .lockSeg {
        width: 38px;
        padding: 0;
        justify-content: center;
    }

    /* === MODAL (оставляем почти как было, но чуть компактнее в ритме) === */
    .overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 18px;
        background: var(--modal-overlay, rgba(0,0,0,0.45));
    }

    .modal {
        width: min(720px, 96vw);           /* чуть компактнее */
        max-height: min(82vh, 860px);
        overflow: auto;
        background: var(--modal-bg, var(--panel));
        border: 1px solid var(--modal-border, var(--panel-border));
        border-radius: 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.45);
        display: flex;
        flex-direction: column;
    }

    .modalTop {
        position: sticky;
        top: 0;
        background: var(--modal-bg, var(--panel));
        border-bottom: 1px solid var(--btn-border);
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        z-index: 1;
    }

    .modalTitle {
        font-size: 16px;
        font-weight: 900;
        opacity: 0.92;
    }

    .x {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        display: grid;
        place-items: center;
        cursor: pointer;
        line-height: 1;
        font-size: 20px;
        padding: 0;
    }

    .modalBody {
        padding: 12px;
        display: grid;
        gap: 12px;
    }

    .lbl,
    .lbl2 {
        font-size: 12px;
        font-weight: 900;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .field { display: grid; gap: 6px; min-width: 0; }

    .inp, .sel {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        font: inherit;
    }

    .inp:focus-visible, .sel:focus-visible {
        outline: 3px solid var(--ring);
        outline-offset: 2px;
    }

    .row2 {
        display: grid;
        grid-template-columns: 1.2fr 1.8fr;
        gap: 10px;
        align-items: end;
    }

    .row3 {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 10px;
        align-items: end;
    }

    .miniBtn {
        height: 42px;
        padding: 0 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
    }

    .tzBlock { display: grid; gap: 10px; padding-top: 4px; }

    .tzTop {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
    }

    .hint {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.75;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
    }

    .tzList { min-height: 170px; padding: 8px 10px; }

    .hint2 { opacity: 0.7; font-size: 13px; font-weight: 700; }

    .modalBottom {
        border-top: 1px solid var(--btn-border);
        padding: 12px 12px 14px 12px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        background: var(--modal-bg, var(--panel));
        flex-wrap: wrap;
    }

    .leftBtns, .rightBtns { display: inline-flex; gap: 10px; }

    .btn {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        font-weight: 900;
        cursor: pointer;
    }

    .btn.primary {
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }

    .btn:disabled { opacity: 0.5; cursor: default; }

    .btn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    /* === Mobile tightening, как в TimePicker === */
    @media (max-width: 520px) {
        .left { padding: 6px 8px; }
        .label { font-size: 14px; }
        .tz { font-size: 12px; }

        .tzSeg { width: 52px; padding: 6px 6px; }
        .lockBtn { width: 36px; min-width: 36px; }
    }

    @media (max-width: 720px) {
        .row2 { grid-template-columns: 1fr; }
        .row3 { grid-template-columns: 1fr; }
        .rightBtns, .leftBtns { width: 100%; justify-content: space-between; }
    }
</style>
