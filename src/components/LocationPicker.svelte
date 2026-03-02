<!-- src/components/LocationPicker.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Portal from 'svelte-portal';
    import { debug } from '../lib/debug';

    import {
        currentLocation,
        savedLocations,
        currentLocationId,
        upsertSavedLocation,
        deleteSavedLocation,
        tryGetGeolocationOnce,
        getSystemTimeZone,
        getGreenwichLocation
    } from '../lib/location/store';

    import { IANA_TIMEZONES } from '../lib/location/iana';
    import type { Location } from '../lib/location/types';

    const dbg = debug('Location', '📍');

    export let value: Location | null = null;
    export let locked = false;

    export let onToggleLock: ((next: boolean) => void) | null = null;

    export let onChange: ((loc: Location) => void) | null = null;

    let faceLoc: Location;
    $: faceLoc = value ?? $currentLocation;

    function emitToggleLock(next: boolean) {
        if (onToggleLock) onToggleLock(next);
        else locked = next;
    }

    let open = false;
    let modalEl: HTMLDivElement | null = null;

    let selectedId = '';

    let labelDraft = '';
    let latDraft = '';
    let lonDraft = '';
    let tzDraft = '';
    let tzSearch = '';
    let filteredTz: string[] = [];
    const formId = `loc-${Math.random().toString(36).slice(2, 8)}`;

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

    function parseDraftBasic(): { lat: number; lon: number; tz: string; label: string } | null {
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
            tz,
            label: label || 'New place'
        };
    }

    function findMatchId(d: { lat: number; lon: number; tz: string }) {
        // после фикса стора saved уже тоже хранится в 3 dp,
        // так что match по 1e-9 снова становится корректным
        const hit = $savedLocations.find((p) =>
            Math.abs(p.lat - d.lat) < 1e-9 &&
            Math.abs(p.lon - d.lon) < 1e-9 &&
            p.tz === d.tz
        );
        return hit?.id ?? '';
    }

    $: {
        if (open) {
            const d = parseDraftBasic();
            if (d) {
                const hitId = findMatchId({ lat: d.lat, lon: d.lon, tz: d.tz });
                if (hitId) selectedId = hitId;
            }
        }
    }

    function newLoc() {
        syncDraftFromLocation(faceLoc ?? getGreenwichLocation());
        selectedId = findMatchId({ lat: faceLoc.lat, lon: faceLoc.lon, tz: faceLoc.tz }) || '';
    }

    function pickSaved(id: string) {
        const p = $savedLocations.find((x) => x.id === id);
        if (!p) return;

        selectedId = id;
        syncDraftFromLocation(p);
    }

    function onPickChange(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLSelectElement)) return;
        pickSaved(el.value);
    }

    function del() {
        if (!selectedId) return;
        deleteSavedLocation(selectedId);
        selectedId = '';
    }

    async function gpsFill() {
        const gps = await tryGetGeolocationOnce();
        if (!gps) return;

        labelDraft = (gps.label || 'Current (GPS)').trim();
        latDraft = fmtCoord(gps.lat);
        lonDraft = fmtCoord(gps.lon);
        tzDraft = gps.tz || getSystemTimeZone() || 'UTC';
    }

    function apply() {
        const d = parseDraftBasic();
        const fallback = faceLoc ?? getGreenwichLocation();

        const lat = d?.lat ?? fallback.lat;
        const lon = d?.lon ?? fallback.lon;
        const tz = d?.tz ?? fallback.tz;
        const label = d?.label ?? fallback.label;

        const savedId = upsertSavedLocation({ lat, lon, tz, label }, { setCurrent: value === null });

        const loc: Location = { id: savedId, lat, lon, tz, label };

        if (onChange) {
            onChange(loc);
        } else {
            currentLocationId.set(savedId);
        }

        selectedId = savedId;
        close('apply');
    }

    function openModal() {
        open = true;

        syncDraftFromLocation(faceLoc ?? getGreenwichLocation());

        const d = parseDraftBasic();
        selectedId = d ? findMatchId({ lat: d.lat, lon: d.lon, tz: d.tz }) : '';

        document.body.style.overflow = 'hidden';
        queueMicrotask(() => modalEl?.focus());
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

    function onOverlayKeyDown(e: KeyboardEvent) {
        if (e.currentTarget !== e.target) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            close('overlay');
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
            }}>
        <span class="left seg">
            <span class="label" title={faceLoc.label}>{faceLoc.label}</span>
        </span>

        <span class="right">
            <span class="tz seg tzSeg" title={faceLoc.tz}>
                {getOffsetLabel(faceLoc.tz)}
            </span>

            <button
                    class="navBtn ui-lock"
                    class:locked={locked}
                    type="button"
                    aria-label={locked ? 'Unlock location' : 'Lock location'}
                    title={locked ? 'Location locked' : 'Location follows global'}
                    on:click|stopPropagation={toggleLock}>
                <span class="lockIco" aria-hidden="true">{locked ? '🔒' : '🔓'}</span>
            </button>
        </span>
    </div>
</div>

{#if open}
    <Portal target="body">
        <div
                class="overlay"
                role="button"
                tabindex="0"
                aria-label="Close location picker"
                on:click={(e) => { if (e.target === e.currentTarget) close('overlay'); }}
                on:keydown={onOverlayKeyDown}
        >
            <div class="modal"
                    bind:this={modalEl}
                    tabindex="-1"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Location picker">
                <header class="modalTop">
                    <div class="modalTitle">Location</div>
                    <button class="x" type="button" aria-label="Close" on:click={() => close('x')}>×</button>
                </header>

                <div class="modalBody">
                    <div class="row2">
                        <div class="field">
                            <label class="lbl" for={`${formId}-saved`}>Saved</label>
                            <select id={`${formId}-saved`} class="sel" bind:value={selectedId} on:change={onPickChange}>
                                <option value="" disabled>{$savedLocations.length ? 'Pick…' : 'No saved locations'}</option>
                                {#each $savedLocations as p}
                                    <option value={p.id}>{p.label} · {getOffsetLabel(p.tz)}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="field">
                            <label class="lbl" for={`${formId}-name`}>Name</label>
                            <input id={`${formId}-name`} class="inp" bind:value={labelDraft} />
                        </div>
                    </div>

                    <div class="row3">
                        <div class="field">
                            <label class="lbl" for={`${formId}-lat`}>Lat</label>
                            <input id={`${formId}-lat`} class="inp" bind:value={latDraft} inputmode="decimal" />
                        </div>
                        <div class="field">
                            <label class="lbl" for={`${formId}-lon`}>Lon</label>
                            <input id={`${formId}-lon`} class="inp" bind:value={lonDraft} inputmode="decimal" />
                        </div>
                        <div class="field">
                            <label class="lbl" for={`${formId}-tz-system`}>TZ</label>
                            <button
                                    id={`${formId}-tz-system`}
                                    class="miniBtn"
                                    type="button"
                                    title="Use system time zone"
                                    on:click={() => { tzDraft = getSystemTimeZone() || 'UTC'; }}>
                                System
                            </button>
                        </div>
                    </div>

                    <div class="tzBlock">
                        <div class="tzTop">
                            <div class="lbl2">Timezone</div>
                            <div class="hint">{tzDraft} · {getOffsetLabel(tzDraft || 'UTC')}</div>
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
                        <button class="btn ghost" type="button" on:click={newLoc}>Reset</button>
                        <button class="btn" type="button" on:click={gpsFill} title="Fill from GPS">GPS</button>
                        <button class="btn danger" type="button" on:click={del} disabled={!selectedId}>Delete</button>
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
    .wrap { position: relative; min-width: 0; }

    .face {
        width: 100%;
        display: inline-flex;
        align-items: stretch;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--fg), transparent 93%);
        overflow: hidden;
        min-width: 0;
        cursor: pointer;
    }

    .left, .right {
        display: inline-flex;
        align-items: center;
        min-width: 0;
    }

    .left {
        padding: 6px 9px;
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;
    }

    .right { margin-left: auto; flex: 0 0 auto; }

    .seg {
        border-radius: 0;
        background: transparent;
        outline: none;
        box-shadow: none;
        padding: 6px 8px;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        height: auto;
    }

    .seg:hover {
        outline: none;
        box-shadow: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 850;
        font-size: 13px;
        letter-spacing: 0.01em;
        opacity: 0.95;
    }

    .tz {
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
        font-weight: 850;
        white-space: nowrap;
        font-size: 11px;
        letter-spacing: 0.04em;
    }

    .tzSeg { width: 52px; justify-content: center; padding: 6px 6px; }

    .ui-lock {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        min-width: 34px;
        margin: 0 !important;
        padding: 0 8px !important;
        border: 0 !important;
        border-left: 1px solid var(--btn-border) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
    }
    .ui-lock:hover:not(:disabled) {
        transform: none !important;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%) !important;
    }

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
        width: min(720px, 96vw);
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

    .modalTitle { font-size: 16px; font-weight: 900; opacity: 0.92; }

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

    .modalBody { padding: 12px; display: grid; gap: 12px; }

    .lbl, .lbl2 {
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

    .row2 { display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 10px; align-items: end; }
    .row3 { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }

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

    .tzTop { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; min-width: 0; }

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

    .btn.primary { border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%); }

    .btn:disabled { opacity: 0.5; cursor: default; }

    .btn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    @media (max-width: 520px) {
        .left { padding: 6px 8px; }
        .label { font-size: 14px; }
        .tz { font-size: 12px; }
        .tzSeg { width: 52px; padding: 6px 6px; }
    }

    @media (max-width: 720px) {
        .row2 { grid-template-columns: 1fr; }
        .row3 { grid-template-columns: 1fr; }
        .rightBtns, .leftBtns { width: 100%; justify-content: space-between; }
    }
</style>
