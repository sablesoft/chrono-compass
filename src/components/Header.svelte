<!-- src/component/Header.svelte -->
<script lang="ts">
    import logo from '../assets/logo-transparent-512.svg?raw';

    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
    import { upsertSavedLocation, currentLocationId } from "../lib/location/store";
    import type { Location } from '../lib/location/types';

    function handleGlobalLocationChange(
        loc: Location
    ) {
        const id = upsertSavedLocation({
                lat: loc.lat,
                lon: loc.lon,
                tz: loc.tz,
                label: loc.label
            },
            { setCurrent: true }
        );
        currentLocationId.set(id);
    }
</script>

<header class="bar">
    <div class="logo">{@html logo}</div>
    <div class="title">Chrono Compass</div>
    <div class="slot time">
        <TimePicker />
    </div>
    <div class="slot loc">
        <LocationPicker
                value={null}
                locked={false}
                onChange={handleGlobalLocationChange}/>
    </div>
    <div class="actions">
        <ThemeSwitcher />
    </div>
</header>

<style>
    header {
        position: sticky;
        top: 0;
        z-index: 100; /* выше колес */

        /* чтобы не было "прозрачного наложения" */
        background: var(--bg);

        /* визуальное отделение */
        border-bottom: 1px solid var(--panel-border);

        /* небольшой padding, если нужно */
        padding-top: 6px;
        padding-bottom: 6px;
        backdrop-filter: blur(6px);
        background: color-mix(in oklab, var(--bg), transparent 10%);
    }
    .logo {
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 5px;
    }

    .logo :global(svg) {
        width: 100%;
        height: 100%;
        fill: currentColor;
    }
    .bar {
        display:flex;
        align-items:center;
        gap:14px;
        padding:15px 10px;
        border:1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 16px;
        margin-bottom: 14px;
    }

    .title {
        margin: 0 10px 5px 0;
        font-size: 34px;
        font-weight: 850;
        opacity: .95;
    }

    .actions{ margin-left:auto; display:flex; gap:10px; align-items:center; }
</style>
