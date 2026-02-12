<!-- src/components/Profile.svelte -->
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get } from 'svelte/store';

    import { debug } from '../lib/debug';
    import { activeProfile } from '../lib/profile/store';
    import { saveBoardFromWheels } from '../lib/profile/board';

    import type { WheelType } from '../lib/catalog';
    import type { WheelRolesState } from '../lib/wheel/control';

    const dbg = debug('PROFILE', '👤');

    export let currentWheels: Array<{
        type: WheelType;
        roles: WheelRolesState;
        title: string;
    }> = [];

    let open = false;
    let modalEl: HTMLDivElement | null = null;

    $: profileTitle = get(activeProfile)?.title ?? 'Default';

    function openModal() {
        dbg.log('Profile.open');
        open = true;
        queueMicrotask(() => modalEl?.focus());
    }

    function closeModal() {
        open = false;
    }

    function saveBoard() {
        dbg.group('Profile.saveBoard', () => {
            dbg.log('currentWheels', { count: currentWheels.length, first: currentWheels[0] });
            saveBoardFromWheels(currentWheels);
        });
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => window.removeEventListener('keydown', onKeyDown));
</script>

<button type="button" class="profileBtn" on:click={openModal} title="Profile">
    <span class="lbl">Profile:</span>
    <span class="name">{profileTitle}</span>
    <span class="caret">{open ? '▴' : '▾'}</span>
</button>

{#if open}
    <div class="overlay" role="presentation" on:click={closeModal}>
        <div
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-label="Profile"
                tabindex="-1"
                bind:this={modalEl}
                on:click|stopPropagation
        >
            <header class="top">
                <div class="title">Profile</div>
                <button class="x" type="button" aria-label="Close" on:click={closeModal}>×</button>
            </header>

            <div class="body">
                <button class="btn primary" type="button" on:click={saveBoard}>
                    Save board
                </button>

                <div class="hint">
                    Сохранит набор видимых колёс и их порядок в активный профиль.
                </div>

                <div class="legacy">
                    <slot />
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .profileBtn{
        display:flex;
        align-items:center;
        gap:10px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        opacity: .92;
    }
    .profileBtn:hover{
        opacity: 1;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
    }
    .lbl { opacity: .7; font-weight: 800; }
    .name { opacity: .95; }
    .caret { opacity: .65; font-size: 12px; margin-left: 2px; }

    .overlay{
        position: fixed;
        inset: 0;
        background: color-mix(in oklab, black, transparent 55%);
        display: grid;
        place-items: center;
        z-index: 9999;
        padding: 18px;
    }
    .modal{
        width: min(620px, 96vw);
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0,0,0,0.45);
    }
    .top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 14px 14px 10px 14px;
        border-bottom: 1px solid var(--btn-border);
    }
    .title{ font-size: 18px; font-weight: 900; opacity: .92; }
    .x{
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
    }
    .x:hover{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
    }

    .body{
        padding: 14px;
        display: grid;
        gap: 12px;
    }
    .hint{
        font-size: 13px;
        opacity: .7;
        line-height: 1.35;
    }
    .legacy{
        margin-top: 6px;
        padding-top: 12px;
        border-top: 1px solid var(--btn-border);
    }

    .btn{
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-weight: 900;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
    }
    .btn:hover:not(:disabled){
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .btn:active:not(:disabled){ transform: translateY(0px); }
    .btn.primary{
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }
</style>