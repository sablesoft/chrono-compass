<!-- src/components/LocationPicker.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    import {
        currentLocation,
        savedLocations,
        setCurrentLocation,
        saveCurrentLocation,
        deleteSavedLocation,
        trySetGeolocationAsCurrentOnce,
    } from '../lib/stores/location';

    let open = false;

    // drafts
    let selectedId = '';
    let labelDraft = '';
    let latDraft = '';
    let lonDraft = '';

    const COORD_DP = 3;

    function newLoc() {
        selectedId = '';
        // вариант A: начинать с текущей локации (удобнее)
        // syncDraftFromCurrent();

        // вариант B: прям пустая заготовка
        labelDraft = '';
        latDraft = '';
        lonDraft = '';
    }

    function roundCoord(v: number, dp = COORD_DP) {
        return Number(v.toFixed(dp));
    }

    function fmtCoord(v: number, dp = COORD_DP) {
        return roundCoord(v, dp).toFixed(dp);
    }

    function syncDraftFromCurrent() {
        const cur = $currentLocation;
        labelDraft = (cur?.label ?? 'New place').trim();
        latDraft = fmtCoord(cur?.lat ?? 0);
        lonDraft = fmtCoord(cur?.lon ?? 0);
    }

    $: if (!open) syncDraftFromCurrent();

    function parseDraft() {
        const lat = Number(String(latDraft).replace(',', '.'));
        const lon = Number(String(lonDraft).replace(',', '.'));
        const label = (labelDraft || 'New place').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const latN = Math.max(-90, Math.min(90, lat));
        const lonN = ((lon + 180) % 360 + 360) % 360 - 180; // [-180..180)

        return {
            lat: roundCoord(latN),
            lon: roundCoord(lonN),
            label
        };
    }

    function pick(id: string) {
        const p = $savedLocations.find(x => x.id === id);
        if (!p) return;

        selectedId = id;
        labelDraft = p.label;
        latDraft = fmtCoord(p.lat);
        lonDraft = fmtCoord(p.lon);

        setCurrentLocation({ lat: p.lat, lon: p.lon, label: p.label });
        open = false;
    }

    function applyDraftNow() {
        const loc = parseDraft();
        if (!loc) return;
        setCurrentLocation(loc);
    }

    function onPickChange(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLSelectElement)) return;
        pick(el.value);
    }

    function save() {
        const loc = parseDraft();
        if (!loc) return;
        setCurrentLocation(loc);
        saveCurrentLocation(loc);
    }

    function del() {
        if (!selectedId) return;
        deleteSavedLocation(selectedId);
        selectedId = '';
    }

    function toggle() {
        open = !open;
        if (open) {
            // если юзер ещё не выбирал сохранённый профиль — подхватим GPS как temporary current
            if (!selectedId) {
                trySetGeolocationAsCurrentOnce();
            }

            syncDraftFromCurrent();

            const cur = $currentLocation;
            const hit = $savedLocations.find(p =>
                Math.abs(p.lat - cur.lat) < 1e-9 &&
                Math.abs(p.lon - cur.lon) < 1e-9 &&
                p.label === cur.label
            );
            selectedId = hit?.id ?? '';
        }
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') open = false;
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => window.removeEventListener('keydown', onKeyDown));
</script>

<div class="wrap">
    <!-- unified block like TimePicker -->
    <button class="face" type="button" on:click={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span class="seg label" title={$currentLocation.label}>
            {$currentLocation.label}
        </span>

        <span class="seg coord" title="Latitude">
            {$currentLocation.lat.toFixed(COORD_DP)}
        </span>

        <span class="seg coord" title="Longitude">
            {$currentLocation.lon.toFixed(COORD_DP)}
        </span>
    </button>

    {#if open}
        <div class="pop" role="dialog" aria-label="Location picker">
            <div class="row">
                <label>Saved</label>
                <select bind:value={selectedId} on:change={onPickChange}>
                    <option value="" disabled selected={selectedId === ''}>
                        {$savedLocations.length ? 'Pick…' : 'No places yet'}
                    </option>
                    {#each $savedLocations as p}
                        <option value={p.id}>
                            {p.label} · {p.lat.toFixed(COORD_DP)}, {p.lon.toFixed(COORD_DP)}
                        </option>
                    {/each}
                </select>
            </div>

            <div class="grid">
                <div class="row">
                    <label>Name</label>
                    <input bind:value={labelDraft} placeholder="Your location..." on:blur={applyDraftNow} />
                </div>

                <div class="row">
                    <label>Latitude</label>
                    <input bind:value={latDraft} inputmode="decimal" on:blur={applyDraftNow} />
                </div>

                <div class="row">
                    <label>Longitude</label>
                    <input bind:value={lonDraft} inputmode="decimal" on:blur={applyDraftNow} />
                </div>
            </div>

            <div class="btns">
                <button type="button" on:click={() => (open = false)}>Close</button>

                <div class="spacer"></div>

                <button type="button" on:click={newLoc}>New</button>
                <button type="button" on:click={del} disabled={!selectedId}>Delete</button>
                <button type="button" class="primary" on:click={save}>Save</button>
            </div>
        </div>

        <button
                class="backdrop"
                type="button"
                aria-label="Close dialog"
                on:click={() => (open = false)}
        />
    {/if}
</div>

<style>
    .wrap { position: relative; min-width: 0; }

    /* SAME PATTERN AS TimePicker: outer radius, inner straight walls, dividers */
    .face{
        width: 100%;
        display: inline-flex;
        align-items: stretch;
        border-radius: 14px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        overflow: hidden;
        padding: 0;          /* важно: чтобы сегменты сами задавали высоту */
        min-width: 0;
        cursor: pointer;

        /* чтобы высота совпадала с TimePicker:
           (у тебя там 10px 14px) */
    }

    .seg{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        background: transparent;
        color: inherit;
        min-width: 0;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: .02em;
        font-variant-numeric: tabular-nums;
        user-select: none;
        white-space: nowrap;

        padding: 5px 20px;     /* было 10px 14px */
        line-height: 1;         /* важно */
        min-height: 44px;       /* чтобы совпало с TimePicker */

    }

    /* vertical dividers */
    .seg + .seg{
        border-left: 1px solid var(--btn-border);
    }

    /* fixed widths like TimePicker segments */
    .label{
        width: 260px;              /* как твой timeInput ~260 */
        justify-content: flex-start;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 850;
    }

    .coord{
        width: 150px;              /* фикс для lat/lon */
        font-weight: 900;
        opacity: 0.92;
    }

    /* POPUP (оставил крупным как ты просил) */
    .pop{
        position:absolute;
        top: calc(100% + 10px);
        left: 0;
        z-index: 50;
        width: min(654px, calc(100vw - 48px));
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        padding: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-size: 16px;
    }

    .row{ display:grid; gap: 10px; margin-bottom: 12px; }
    label{ font-size: 18px; font-weight: 700; }

    input, select{
        font-size: 16px;
        margin-top: 10px;
        margin-bottom: 25px;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid var(--panel-border);
        background: var(--btn-bg);
        color: inherit;
        outline: none;
        cursor: pointer;
    }

    input:focus, select:focus{
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 20%);
    }

    .grid{
        display:grid;
        grid-template-columns: 1.4fr 1fr 1fr;
        gap: 10px;
    }

    .btns{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top: 14px;
    }

    .spacer { flex: 1; }

    .btns button{
        font-size: 16px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
    }

    button.primary{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 14%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
    }

    .backdrop{
        position: fixed;
        inset: 0;
        z-index: 40;
        background: transparent;
        border: 0;
        padding: 0;
        cursor: default;
    }

    @media (max-width: 720px){
        .grid{ grid-template-columns: 1fr; }

        /* на узких можно чуть ужать сегменты */
        .label{ width: 220px; }
        .coord{ width: 130px; }
    }
</style>
