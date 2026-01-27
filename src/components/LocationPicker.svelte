<!-- src/components/LocationPicker.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    import {
        currentLocation,
        savedLocations,
        setCurrentLocation,
        saveCurrentLocation,
        deleteSavedLocation,
        createEmptyIfNone,
    } from '../lib/stores/location';

    let open = false;

    // drafts (локальные, мутируемые)
    let selectedId = '';
    let labelDraft = '';
    let latDraft = '';
    let lonDraft = '';

    function syncDraftFromCurrent() {
        // если у тебя la/lo — замени тут и ниже
        labelDraft = ($currentLocation?.label ?? 'New place').trim();
        latDraft = String($currentLocation?.lat ?? 0);
        lonDraft = String($currentLocation?.lon ?? 0);
    }

    // когда попап закрыт — держим драфт синхронно
    $: if (!open) syncDraftFromCurrent();

    function parseDraft() {
        const lat = Number(String(latDraft).replace(',', '.'));
        const lon = Number(String(lonDraft).replace(',', '.'));
        const label = (labelDraft || 'New place').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const latN = Math.max(-90, Math.min(90, lat));
        const lonN = ((lon + 180) % 360 + 360) % 360 - 180; // [-180..180)
        return { lat: latN, lon: lonN, label };
    }

    function pick(id: string) {
        const p = $savedLocations.find(x => x.id === id);
        if (!p) return;

        selectedId = id;
        labelDraft = p.label;
        latDraft = String(p.lat);
        lonDraft = String(p.lon);

        setCurrentLocation({ lat: p.lat, lon: p.lon, label: p.label });
        open = false;
    }

    function applyDraftNow() {
        const loc = parseDraft();
        if (!loc) return;
        setCurrentLocation(loc);
    }

    function onPickChange(e: Event) {
        const select = e.currentTarget as HTMLSelectElement;
        pick(select.value);
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

        // если удалили выбранное — сбросим выбор (необязательно, но логично)
        selectedId = '';
    }

    function toggle() {
        open = !open;

        if (open) {
            createEmptyIfNone();
            syncDraftFromCurrent();

            // подсветить совпавшую запись (если есть)
            const hit = $savedLocations.find(p =>
                Math.abs(p.lat - $currentLocation.lat) < 1e-9 &&
                Math.abs(p.lon - $currentLocation.lon) < 1e-9 &&
                p.label === $currentLocation.label
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
    <button class="face" on:click={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span class="k">Location:</span>
        <span class="v">
      {$currentLocation.label} · {$currentLocation.lat.toFixed(5)}, {$currentLocation.lon.toFixed(5)}
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
                            {p.label} · {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                        </option>
                    {/each}
                </select>
            </div>

            <div class="grid">
                <div class="row">
                    <label>Name</label>
                    <input bind:value={labelDraft} placeholder="Paraty" on:blur={applyDraftNow} />
                </div>

                <div class="row">
                    <label>Lat</label>
                    <input bind:value={latDraft} inputmode="decimal" on:blur={applyDraftNow} />
                </div>

                <div class="row">
                    <label>Lon</label>
                    <input bind:value={lonDraft} inputmode="decimal" on:blur={applyDraftNow} />
                </div>
            </div>

            <div class="btns">
                <button on:click={() => (open = false)}>Close</button>
                <button on:click={del} disabled={!selectedId}>Delete</button>
                <button class="primary" on:click={save}>Save</button>
            </div>
        </div>

        <button
                class="backdrop"
                type="button"
                aria-label="Close dialog"
                on:click={() => (open = false)}
        ></button>
    {/if}
</div>

<style>
    .wrap { position: relative; min-width: 0; }

    .face{
        width: 100%;
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        min-width: 0;
    }

    .k{ opacity: .75; white-space: nowrap; }

    .v{
        opacity: .95;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        font-variant-numeric: tabular-nums;
    }

    .pop{
        position:absolute;
        top: calc(100% + 10px);
        left: 0;
        z-index: 50;
        width: min(560px, calc(100vw - 48px));
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        padding: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-size: 16px;

    }

    .btns button{
        font-size: 16px;
        padding: 10px 14px;
    }

    .face{
        font-size: 16px;     /* чтобы строка локации не была мелкой */
    }

    .row{ display:grid; gap: 8px; margin-bottom: 10px; }
    label{ font-size: 14px; font-weight: 650; }

    input, select{
        font-size: 16px;     /* ключевое */
        padding: 12px 12px;  /* чуть больше */
        border-radius: 12px;
        border: 1px solid var(--input-border);
        background: var(--input-bg);
        color: inherit;
        outline: none;
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
        margin-top: 12px;
    }

    button.primary{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 14%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
    }

    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        background: transparent;
        border: none;
        padding: 0;
        cursor: default;
    }

    @media (max-width: 720px){
        .grid{ grid-template-columns: 1fr; }
    }
</style>
