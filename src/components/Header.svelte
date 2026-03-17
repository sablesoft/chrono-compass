<!-- src/component/Header.svelte -->
<script lang="ts">
    import logo from '../assets/logo-transparent-512.svg?raw';

    import LocationPicker from './LocationPicker.svelte';
    import ProfilePicker from './ProfilePicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
    import { upsertSavedLocation, currentLocationId } from "../lib/location/store";
    import { phoneCarouselState, requestPhoneCarouselStep } from '../lib/app/phoneCarousel';
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
    <div class="phoneNavWrap">
        {#if $phoneCarouselState.enabled && $phoneCarouselState.total > 1}
            <nav class="phoneNav" aria-label="Wheel carousel controls">
                <button type="button" class="phoneNavBtn" on:click={() => requestPhoneCarouselStep(-1)} aria-label="Previous slide">←</button>
                <div class="phoneNavMeta">{$phoneCarouselState.index + 1} / {$phoneCarouselState.total}</div>
                <button type="button" class="phoneNavBtn" on:click={() => requestPhoneCarouselStep(1)} aria-label="Next slide">→</button>
            </nav>
        {/if}
    </div>
    <div class="title">Chrono Compass</div>
    <div class="slot profile">
        <ProfilePicker />
    </div>
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
        z-index: 100;

        background: var(--bg);

        border-bottom: 1px solid var(--panel-border);

        padding-top: var(--sp-4);
        padding-bottom: var(--sp-4);
        backdrop-filter: blur(6px);
        background: color-mix(in oklab, var(--bg), transparent 10%);
    }
    .logo {
        grid-area: logo;
        width: var(--header-logo-size, 50px);
        height: var(--header-logo-size, 50px);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        pointer-events: none;
    }

    .logo :global(svg) {
        width: 100%;
        height: 100%;
        fill: currentColor;
        display: block;
        overflow: hidden;
        pointer-events: none;
    }

    .logo :global(*) {
        pointer-events: none;
    }
    .bar {
        display: grid;
        grid-template-columns: auto auto minmax(220px, 1fr) minmax(260px, 1.2fr) minmax(260px, 1.2fr) auto;
        grid-template-areas: "logo title profile time loc actions";
        align-items: center;
        gap: var(--sp-10);
        padding: var(--sp-8) var(--sp-6);
        border:1px solid var(--panel-border);
        background: var(--panel);
        border-radius: var(--radius-16);
        margin-bottom: 4px;
    }

    .slot {
        min-width: 0;
    }
    .phoneNavWrap { display: none; grid-area: phoneNav; min-width: 0; }
    .profile { grid-area: profile; }
    .time { grid-area: time; }
    .loc { grid-area: loc; }

    .title {
        grid-area: title;
        margin: 0 10px 5px 0;
        font-size: var(--fs-26);
        font-weight: 800;
        opacity: .95;
    }

    .actions {
        grid-area: actions;
        display: flex;
        gap: var(--sp-10);
        align-items: center;
        justify-self: end;
    }
    .phoneNav {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: var(--sp-8);
        min-width: 0;
    }
    .phoneNavBtn {
        min-width: var(--wheel-header-btn-size, 32px);
        height: var(--wheel-header-btn-size, 32px);
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: var(--fg);
        border-radius: var(--radius-10);
        font-size: var(--fs-16);
        font-weight: 700;
        padding: 0;
        line-height: 1;
    }
    .phoneNavMeta {
        text-align: center;
        font-size: var(--fs-11);
        font-weight: 700;
        opacity: 0.82;
        white-space: nowrap;
    }

    @media (max-width: 640px) {
        .bar {
            grid-template-columns: auto auto minmax(0, 1fr) auto;
            grid-template-areas: none;
            gap: var(--sp-5);
            padding: var(--sp-8);
        }

        .title {
            display: none;
        }

        .logo {
            align-self: center;
            grid-column: 1;
            grid-row: 1;
        }
        .profile {
            justify-self: start;
            grid-column: 2;
            grid-row: 1;
        }
        .phoneNavWrap {
            display: block;
            justify-self: stretch;
            grid-column: 3;
            grid-row: 1;
        }
        .actions {
            display: flex;
            justify-self: end;
            grid-column: 4;
            grid-row: 1;
            gap: 0;
        }
        .actions :global(button.icon) {
            width: var(--wheel-header-btn-size, 22px);
            height: var(--wheel-header-btn-size, 22px);
            min-width: var(--wheel-header-btn-size, 22px);
            padding: 0;
            border-radius: var(--radius-8);
            display: grid;
            place-items: center;
            line-height: 1;
            font-size: var(--fs-13);
        }
        .time { justify-self: stretch; grid-column: 1 / span 2; grid-row: 2; }
        .loc { justify-self: stretch; grid-column: 3 / span 2; grid-row: 2; }
    }
</style>
