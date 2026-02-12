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
        getSystemTimeZone
    } from '../lib/location/store';

    import { IANA_TIMEZONES } from '../lib/location/iana';
    import type { SavedLocation } from '../lib/location/types';

    const dbg = debug('location', '📍');

    let open = false;
    let modalEl: HTMLDivElement | null = null;

    let selectedId = '';
    let labelDraft = '';
    let latDraft = '';
    let lonDraft = '';
    let tzDraft = '';
    let tzSearch = '';

    const COORD_DP = 3;

    function getOffsetLabel(tz: string) {
        try {
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset'
            }).formatToParts(now);

            const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
            return offset.replace('GMT', 'UTC');
        } catch {
            return '';
        }
    }

    function fmtCoord(v: number) {
        return v.toFixed(COORD_DP);
    }

    function syncDraftFromCurrent() {
        const cur = $currentLocation;

        labelDraft = cur.label;
        latDraft = fmtCoord(cur.lat);
        lonDraft = fmtCoord(cur.lon);
        tzDraft = cur.tz || getSystemTimeZone() || 'UTC';

        dbg.log('syncDraftFromCurrent', cur);
    }

    function parseDraft() {
        const lat = Number(latDraft.replace(',', '.'));
        const lon = Number(lonDraft.replace(',', '.'));

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            dbg.warn('invalid coords');
            return null;
        }

        return {
            lat,
            lon,
            label: (labelDraft || 'New place').trim(),
            tz: tzDraft || getSystemTimeZone() || 'UTC'
        };
    }

    function newLoc() {
        dbg.log('newLoc');
        selectedId = '';
        syncDraftFromCurrent();
    }

    function pick(id: string) {
        const p = $savedLocations.find((x: SavedLocation) => x.id === id);
        if (!p) return;

        dbg.log('pick', id);

        selectedId = id;
        labelDraft = p.label;
        latDraft = fmtCoord(p.lat);
        lonDraft = fmtCoord(p.lon);
        tzDraft = p.tz;

        setLocation(p);
    }

    function save() {
        const loc = parseDraft();
        if (!loc) return;

        setLocation(loc);
        const id = saveLocation(loc);

        if (id) {
            selectedId = id;
            dbg.log('saved', id);
        }

        close('save');
    }

    function del() {
        if (!selectedId) return;
        dbg.warn('delete', selectedId);
        deleteSavedLocation(selectedId);
        selectedId = '';
    }

    function openModal() {
        // dbg.log('openModal');
        open = true;

        // Сначала синхронизация
        syncDraftFromCurrent();

        const cur = $currentLocation;
        const hit = $savedLocations.find((p: SavedLocation) =>
            Math.abs(p.lat - cur.lat) < 1e-9 &&
            Math.abs(p.lon - cur.lon) < 1e-9 &&
            p.label === cur.label
        );
        selectedId = hit?.id ?? '';

        document.body.style.overflow = 'hidden';

        queueMicrotask(() => {
            // dbg.log('microtask.afterOpen', {
            //     open,
            //     hasModalEl: !!modalEl,
            //     hasOverlayEl: !!overlayEl
            // });

            modalEl?.focus();

            // GPS после открытия
            if (!selectedId) {
                trySetGeolocationAsCurrentOnce();
            }
        });
    }

    function close(reason = 'close') {
        // dbg.warn('closeModal', { reason });
        open = false;
        document.body.style.overflow = '';
    }

    function toggle() {
        // dbg.log('toggle', { open });
        open ? close('toggle') : openModal();
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            close('esc');
        }
    }

    function onPickChange(e: Event) {
        const el = e.currentTarget as HTMLSelectElement;
        pick(el.value);
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => {
        window.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = '';
    });

    $: filteredTz = IANA_TIMEZONES.filter(t =>
        t.toLowerCase().includes(tzSearch.toLowerCase())
    );
</script>

<div class="wrap">
    <button
            class="face"
            type="button"
            on:mousedown|stopPropagation={() => dbg.log('face.mousedown')}
            on:click|stopPropagation={() => {
            dbg.log('face.click');
            toggle();
        }}
    >
        <span class="label">{$currentLocation.label}</span>
        <span class="tz">
            {getOffsetLabel($currentLocation.tz)}
        </span>
    </button>
</div>

{#if open}
    <Portal target="body">
        <div class="overlay"
                on:click={(e) => {
                    if (e.target === e.currentTarget) close('overlay');
                }}>
            <div
                    class="modal"
                    bind:this={modalEl}
                    tabindex="-1"
                    on:click|stopPropagation
            >
                <header class="modalTop">
                    <div class="modalTitle">Location</div>
                    <button class="x" type="button" on:click={() => close('x')}>×</button>
                </header>

                <div class="modalBody">
                    <div class="section">
                        <label>Saved</label>
                        <select class="sel" bind:value={selectedId} on:change={onPickChange}>
                            <option value="" disabled>
                                {$savedLocations.length ? 'Pick…' : 'No saved locations'}
                            </option>

                            {#each $savedLocations as p}
                                <option value={p.id}>
                                    {p.label} ({getOffsetLabel(p.tz)})
                                </option>
                            {/each}
                        </select>
                    </div>

                    <div class="section">
                        <label>Name</label>
                        <input class="inp" bind:value={labelDraft} />
                    </div>

                    <div class="coordsRow">
                        <div>
                            <label>Latitude</label>
                            <input class="inp" bind:value={latDraft} />
                        </div>
                        <div>
                            <label>Longitude</label>
                            <input class="inp" bind:value={lonDraft} />
                        </div>
                    </div>

                    <div class="section">
                        <label>Timezone</label>

                        <div class="systemHint">
                            System detected: {getSystemTimeZone()} ({getOffsetLabel(getSystemTimeZone() || 'UTC')})
                        </div>

                        <input
                                class="inp"
                                placeholder="Search timezone..."
                                bind:value={tzSearch}
                        />

                        <select class="sel" size="6" bind:value={tzDraft}>
                            {#each filteredTz as tz}
                                <option value={tz}>
                                    {tz} ({getOffsetLabel(tz)})
                                </option>
                            {/each}
                        </select>
                    </div>
                </div>

                <footer class="modalBottom">
                    <button class="btn ghost" type="button" on:click={newLoc}>New</button>
                    <button class="btn ghost" type="button" on:click={del} disabled={!selectedId}>Delete</button>
                    <button class="btn ghost" type="button" on:click={() => close('button-close')}>Close</button>
                    <button class="btn primary" type="button" on:click={save}>Save</button>
                </footer>
            </div>
        </div>
    </Portal>
{/if}

<style>
    .wrap { position: relative; min-width: 0; }

    .face{
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        padding: 0 12px;
        min-height: 44px;
        cursor: pointer;
        min-width: 0;
    }

    .label{
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 700;
    }

    .tz{
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
        font-weight: 700;
        white-space: nowrap;
    }

    /* Главное: фиксируем поверх всего */
    .overlay{
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 18px;
        background: var(--modal-overlay, rgba(0,0,0,0.45));
    }

    .modal{
        width: min(760px, 96vw);
        max-height: min(80vh, 820px);
        overflow: auto;
        background: var(--modal-bg, var(--panel));
        border: 1px solid var(--modal-border, var(--panel-border));
        border-radius: var(--modal-radius, 18px);
        box-shadow: var(--modal-shadow, 0 18px 60px rgba(0,0,0,0.45));
        display: flex;
        flex-direction: column;
    }

    .modalTop{
        position: sticky;
        top: 0;
        background: var(--modal-bg, var(--panel));
        border-bottom: var(--modal-header-border, 1px solid var(--btn-border));
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        z-index: 1;
    }

    .modalTitle{
        font-size: 18px;
        font-weight: 800;
    }

    .x{
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

    .modalBody{
        padding: 16px;
        display: grid;
        gap: 14px;
    }

    .section{
        display: grid;
        gap: 8px;
    }

    label{
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
    }

    .inp, .sel{
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        font: inherit;
    }

    .inp:focus-visible, .sel:focus-visible{
        outline: 3px solid var(--ring);
        outline-offset: 2px;
    }

    .coordsRow{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .systemHint{
        color: var(--muted);
        font-size: 13px;
    }

    .modalBottom{
        border-top: var(--modal-footer-border, 1px solid var(--btn-border));
        padding: 12px 16px;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
        background: var(--modal-bg, var(--panel));
    }

    .btn{
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        font-weight: 800;
        cursor: pointer;
    }

    .btn.primary{
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }

    .btn:disabled{
        opacity: 0.5;
        cursor: default;
    }

    @media (max-width: 720px){
        .coordsRow{ grid-template-columns: 1fr; }
    }
</style>
