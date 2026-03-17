<!-- src/components/DropdownButton.svelte -->
<script lang="ts">
    import { onDestroy, tick } from 'svelte';
    import Portal from 'svelte-portal';
    import type { DropdownItem } from '../lib/types';

    // what to render
    export let label = 'Dropdown';
    export let items: DropdownItem[] = [];

    // selection (controlled)
    export let value: string[] = [];
    export let onChange: (next: string[]) => void = () => {};
    export let minSelected = 0;

    // button styling from outside (header/inline/etc.)
    export let buttonClass = '';

    // small UX flags
    export let showSummary = true;
    export let summaryMode: 'count' | 'labels' = 'count';
    export let closeOnSelect = false;

    let open = false;
    let btnEl: HTMLButtonElement | null = null;
    let menuEl: HTMLDivElement | null = null;

    // menu positioning (Portal => fixed)
    let menuLeft = 0;
    let menuTop = 0;
    let menuWidth = 260;

    let summary = '';
    $: {
        const v = value ?? [];

        if (!showSummary) {
            summary = '';
        } else if (!v.length) {
            summary = '';
        } else {
            const enabled = items.filter(i => i.disabled !== true).map(i => i.value);
            const enabledSelectedCount = v.filter(x => enabled.includes(x)).length;
            const allEnabledSelected = enabled.length > 0 && enabledSelectedCount === enabled.length;

            if (allEnabledSelected) {
                summary = 'All';
            } else if (summaryMode === 'count') {
                summary = String(v.length);
            } else {
                const map = new Map(items.map(i => [i.value, i.label]));
                const labels = v.map(x => map.get(x) ?? x);
                summary = labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;
            }
        }
    }

    function recomputeMenuPos() {
        if (!btnEl) return;
        const r = btnEl.getBoundingClientRect();

        const desiredLeft = r.left;
        const maxLeft = Math.max(10, window.innerWidth - 10 - menuWidth);

        // width: prefer menuWidth but allow a bit adaptive
        menuWidth = Math.max(220, Math.min(360, Math.round(Math.max(r.width, menuWidth))));

        menuLeft = Math.max(10, Math.min(desiredLeft, maxLeft));
        menuTop = r.bottom + 10;
    }

    async function toggleOpen() {
        open = !open;

        if (open) {
            await tick();
            recomputeMenuPos();
            window.addEventListener('resize', recomputeMenuPos, { passive: true });
            window.addEventListener('scroll', recomputeMenuPos, { passive: true });
            document.addEventListener('pointerdown', onDocPointerDown, true);
            document.addEventListener('keydown', onDocKeyDown, true);
        } else {
            cleanupListeners();
        }
    }

    function close() {
        if (!open) return;
        open = false;
        cleanupListeners();
    }

    function cleanupListeners() {
        window.removeEventListener('resize', recomputeMenuPos);
        window.removeEventListener('scroll', recomputeMenuPos);
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        document.removeEventListener('keydown', onDocKeyDown, true);
    }

    function onDocPointerDown(ev: PointerEvent) {
        if (!open) return;
        const t = ev.target as Node;
        if (btnEl && btnEl.contains(t)) return;
        if (menuEl && menuEl.contains(t)) return;
        close();
    }

    function onDocKeyDown(ev: KeyboardEvent) {
        if (!open) return;
        if (ev.key === 'Escape') {
            ev.preventDefault();
            close();
        }
    }

    onDestroy(cleanupListeners);

    function isChecked(v: string) {
        return (value ?? []).includes(v);
    }

    function toggleValue(v: string, disabled?: boolean) {
        if (disabled === true) return;

        const set = new Set(value ?? []);

        if (set.has(v)) {
            if (set.size <= minSelected) return;
            set.delete(v);
        } else {
            set.add(v);
        }

        onChange(Array.from(set));
        if (closeOnSelect) close();
    }
</script>

<button
        bind:this={btnEl}
        type="button"
        class={buttonClass}
        aria-haspopup="dialog"
        aria-expanded={open}
        on:click={toggleOpen}>
    <span class="db-label">{label}</span>
    {#if showSummary}
        <span class="db-summary">{summary}</span>
    {/if}
    <span class="db-caret">{open ? '▴' : '▾'}</span>
</button>

{#if open}
    <Portal target="body">
        <div
                class="db-menu"
                bind:this={menuEl}
                role="dialog"
                aria-label={label}
                style={`left:${menuLeft}px; top:${menuTop}px; width:${menuWidth}px;`}
        >
            <div class="db-head">
                <div class="db-title">{label}</div>
                <button class="db-x" type="button" on:click={close} aria-label="Close">✕</button>
            </div>

            <div class="db-list">
                {#each items as it (it.value)}
                    <label class="db-item" class:disabled={it.disabled === true}>
                        <input
                                type="checkbox"
                                checked={isChecked(it.value)}
                                disabled={it.disabled === true}
                                on:change={() => toggleValue(it.value, it.disabled === true)}
                        />
                        <span class="db-itemLabel" title={it.title ?? it.label}>{it.label}</span>
                    </label>
                {/each}
            </div>

            <div class="db-foot">
                <span class="db-hint">Esc to close</span>
            </div>
        </div>
    </Portal>
{/if}

<style>
    /* button internals (buttonClass controls the outer look) */
    .db-label { opacity: .92; }
    .db-summary { opacity: .7; font-weight: 650; margin-left: 8px; }
    .db-caret {
        opacity: .65;
        margin-left: 10px;
        font-size: var(--fs-28);
    }

    /* dropdown itself — always component-owned */
    .db-menu{
        position: fixed;
        z-index: 5000;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: var(--radius-14);
        box-shadow: 0 18px 60px rgba(0,0,0,.22);
        overflow: hidden;
    }

    .db-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: var(--sp-10);
        padding: var(--sp-10) var(--sp-12);
        border-bottom: 1px solid var(--panel-border);
    }

    .db-title{
        font-weight: 800;
        opacity: .95;
    }

    .db-x{
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: var(--radius-10);
        border: 1px solid var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .db-x:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }

    .db-list{
        max-height: min(46vh, 360px);
        overflow: auto;
        padding: var(--sp-8);
        display: grid;
        gap: var(--sp-6);
    }

    .db-item{
        display:flex;
        align-items:center;
        gap: var(--sp-10);
        padding: var(--sp-8) var(--sp-10);
        border-radius: var(--radius-10);
        cursor: pointer;
        user-select: none;
    }
    .db-item:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }
    .db-item.disabled{
        opacity: .45;
        cursor: not-allowed;
    }
    .db-item input{ cursor: pointer; }

    .db-itemLabel{
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .db-foot{
        padding: var(--sp-8) var(--sp-12);
        border-top: 1px solid var(--panel-border);
        font-size: var(--fs-12);
        opacity: .65;
    }
</style>