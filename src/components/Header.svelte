<script lang="ts">
    import logo from '../assets/logo-transparent-512.svg?raw';

    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
    import DropdownButton from './DropdownButton.svelte';
    import { cycles, setCycles } from '../lib/stores/cycle';
    import {getCycleOptions} from "../lib/cycles/meta";
    import type {CycleKind} from "../lib/cycles/types";
    import CollectionControl from "./CollectionControl.svelte";

    $: cycleItems = getCycleOptions().map(o => ({
        value: o.kind,
        label: o.label,
        title: o.title,
        disabled: o.disabled
    }));

    function handleCyclesChange(next: string[]) {
        setCycles(next as CycleKind[]);
    }
</script>

<header class="bar">
    <div class="logo">{@html logo}</div>
    <div class="title">Chrono Compass</div>
    <div class="slot time">
        <TimePicker />
    </div>
    <div class="slot loc">
        <LocationPicker />
    </div>
    <div class="slot">
        <CollectionControl />
    </div>
    <div class="slot cycles">
        <DropdownButton
                label="Cycles:"
                items={cycleItems}
                value={$cycles}
                onChange={handleCyclesChange}
                buttonClass="seg cyclesBtn"
        />
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

    .logo svg {
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
    .slot.cycles { display:flex; align-items:center; }
    .slot.cycles { display:flex; align-items:stretch; }

    .actions{ margin-left:auto; display:flex; gap:10px; align-items:center; }
</style>
