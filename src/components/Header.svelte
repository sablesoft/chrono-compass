<script lang="ts">
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<header class="bar">
    <div class="brand">
        <div class="title">Time Wheels</div>
    </div>

    <div class="slot loc">
        <LocationPicker />
    </div>

    <div class="slot time">
        <TimePicker />
    </div>

    <div class="actions">
        <ThemeSwitcher />
    </div>
</header>

<style>
    .bar{
        display:flex;
        align-items:center;
        gap:14px;
        padding:14px 18px;
        border:1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 16px;
        margin-bottom: 14px;
    }

    .title{ font-size: 20px; font-weight: 750; opacity: .95; }

    .slot{ min-width: 0; }
    .loc{ flex: 1 1 520px; }
    .time{ flex: 1 1 520px; display:flex; justify-content:flex-start; }

    .actions{ margin-left:auto; display:flex; gap:10px; align-items:center; }
</style>
