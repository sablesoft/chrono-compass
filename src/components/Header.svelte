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
    let mobileMenuOpen = false;
    $: hasPhoneNav = $phoneCarouselState.enabled && $phoneCarouselState.total > 1;

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

    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }
</script>

<header class="bar">
    <div class="row rowTop" class:rowTopNoNav={!hasPhoneNav}>
        <div class="logo">{@html logo}</div>
        <div class="title">Chrono Compass</div>
        <div class="slot time">
            <TimePicker />
        </div>
        <div class="phoneNavWrap">
            {#if hasPhoneNav}
                <nav class="phoneNav" aria-label="Wheel carousel controls">
                    <button type="button" class="phoneNavBtn" on:click={() => requestPhoneCarouselStep(-1)} aria-label="Previous slide">←</button>
                    <div class="phoneNavMeta">{$phoneCarouselState.index + 1} / {$phoneCarouselState.total}</div>
                    <button type="button" class="phoneNavBtn" on:click={() => requestPhoneCarouselStep(1)} aria-label="Next slide">→</button>
                </nav>
            {/if}
        </div>
        <div class="actions menuActions">
            <button
                    type="button"
                    class="navBtn burgerBtn"
                    aria-label={mobileMenuOpen ? 'Close mobile controls' : 'Open mobile controls'}
                    aria-expanded={mobileMenuOpen}
                    aria-controls="header-mobile-row-bottom"
                    on:click={toggleMobileMenu}
            >☰</button>
        </div>
    </div>
    <div id="header-mobile-row-bottom" class="row rowBottom" class:mobileCollapsed={!mobileMenuOpen}>
        <div class="slot profile">
            <ProfilePicker />
        </div>
        <div class="slot loc">
            <LocationPicker
                    value={null}
                    locked={false}
                    onChange={handleGlobalLocationChange}/>
        </div>
        <div class="actions themeActions">
            <ThemeSwitcher />
        </div>
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
    .row {
        display: contents;
        min-width: 0;
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
    .menuActions { display: none; }
    .themeActions { display: flex; }
    .burgerBtn { display: none; }
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
            display: flex;
            flex-direction: column;
            gap: var(--sp-4);
            padding: var(--sp-8);
        }
        .row {
            display: grid;
        }
        .rowTop {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto auto;
            grid-template-areas: "logo time phoneNav actions";
            align-items: center;
            gap: var(--sp-4);
            width: 100%;
        }
        .rowTop.rowTopNoNav {
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas: "logo time actions";
        }
        .rowBottom {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
            grid-template-areas: "profile loc actions";
            align-items: center;
            gap: var(--sp-4);
            width: 100%;
        }
        .rowBottom.mobileCollapsed {
            display: none;
        }

        .title {
            display: none;
            justify-self: start;
            margin: 0;
            font-size: var(--fs-20);
            font-weight: 750;
            letter-spacing: 0.01em;
            opacity: 0.85;
            white-space: nowrap;
        }

        .logo {
            align-self: center;
            grid-area: logo;
        }
        .profile {
            justify-self: start;
            grid-area: profile;
            min-width: 0;
            width: 100%;
            overflow: hidden;
        }
        .profile :global(.labelSeg) {
            min-width: 0;
            padding-left: var(--sp-8);
            padding-right: var(--sp-8);
        }
        .profile :global(.iconSeg) {
            width: 30px;
            min-width: 30px;
            max-width: 30px;
        }
        .profile :global(.ui-lock) {
            min-width: 30px;
            padding: 0 var(--sp-6) !important;
        }
        .phoneNavWrap {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            justify-self: start;
            grid-area: phoneNav;
            min-width: 0;
            overflow: visible;
        }
        .actions {
            display: flex;
            justify-self: end;
            align-self: center;
            grid-area: actions;
            gap: 0;
            min-width: 0;
        }
        .menuActions { display: flex; }
        .themeActions { display: flex; }
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
        .burgerBtn {
            display: inline-grid;
        }
        .time {
            justify-self: start;
            grid-area: time;
            width: 100%;
            /*max-width: clamp(170px, 46vw, 240px);*/
            min-width: 0;
        }
        .loc {
            justify-self: stretch;
            grid-area: loc;
            width: 100%;
            min-width: 0;
        }
        .phoneNav {
            gap: var(--sp-4);
        }
        .phoneNavMeta {
            font-size: var(--fs-10);
        }
    }
</style>
