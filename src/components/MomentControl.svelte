<script lang="ts">
    import {
        momentsState,
        normalizeTsMinute,
        upsertMoment,
        deleteMoment,
        setCurrentCollection,
        findMomentInCollectionByTs
    } from '../lib/stores/moment';
    import Portal from "svelte-portal";

    type Mode = 'save' | 'edit';

    export let buttonClass = '';

    export let ts: number; // IMPORTANT: number, not store

    export let onUserActivity: () => void = () => {};
    export let onChanged: () => void = () => {};

    let open = false;
    let mode: Mode = 'save';
    let editingId: string | null = null;

    let collectionId = '';
    let title = '';
    let description = '';
    let emoji = '📍';

    $: state = $momentsState;
    $: tsN = normalizeTsMinute(ts);

    $: currentColId = state.currentCollectionId ?? state.collections[0]?.id ?? null;
    $: existing = currentColId ? findMomentInCollectionByTs(currentColId, tsN) : null;

    $: buttonMode = existing ? 'edit' : 'save';

    function openDialog() {
        onUserActivity();

        if (existing) {
            mode = 'edit';
            editingId = existing.id;
            collectionId = existing.collectionId;
            title = existing.title;
            description = existing.description ?? '';
            emoji = existing.emoji || '📍';
        } else {
            mode = 'save';
            editingId = null;
            collectionId = currentColId ?? state.collections[0]?.id ?? '';
            title = '';
            description = '';
            emoji = '📍';
        }

        open = true;
    }

    function close() {
        open = false;
    }

    function save() {
        if (!collectionId) return;

        upsertMoment({
            id: editingId ?? undefined,
            ts: tsN,
            collectionId,
            title,
            description,
            emoji: (emoji || '📍').slice(0, 4)
        });

        setCurrentCollection(collectionId);

        open = false;
        onChanged();
    }

    function remove() {
        if (!editingId) return;

        deleteMoment(editingId);

        open = false;
        onChanged();
    }

    function onKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }
</script>

<button
        class={`mc-btn ${buttonClass}`}
        on:click={openDialog}
        aria-label={buttonMode === 'edit' ? 'Edit moment' : 'Save moment'}
        title={buttonMode === 'edit' ? 'Edit moment' : 'Save moment'}
>
    {#if buttonMode === 'edit'}
        ✏️
    {:else}
        💾
    {/if}
</button>

{#if open}
    <Portal target="body">
    <div class="mc-backdrop" on:click={close}></div>

    <div class="mc-modal" role="dialog" aria-modal="true" on:keydown={onKeydown} tabindex="0">
        <header class="mc-head">
            <div class="mc-title">{mode === 'edit' ? 'Edit moment' : 'Save moment'}</div>
            <button class="mc-x" on:click={close} aria-label="Close">✕</button>
        </header>

        <div class="mc-body">
            <div class="row">
                <label>Collection</label>
                <select bind:value={collectionId}>
                    {#each state.collections as c (c.id)}
                        <option value={c.id}>{c.name}</option>
                    {/each}
                </select>
            </div>

            <div class="row two">
                <div>
                    <label>Emoji</label>
                    <input bind:value={emoji} placeholder="📍" />
                </div>

                <div>
                    <label>When</label>
                    <input value={new Date(tsN).toLocaleString()} disabled />
                </div>
            </div>

            <div class="row">
                <label>Title</label>
                <input bind:value={title} placeholder="E.g. 'John HB'" />
            </div>

            <div class="row">
                <label>Description</label>
                <textarea bind:value={description} rows="4" placeholder="Notes…"></textarea>
            </div>
        </div>

        <footer class="mc-foot">
            {#if mode === 'edit'}
                <button class="danger" on:click={remove}>Delete</button>
            {/if}
            <div class="spacer"></div>
            <button on:click={close}>Cancel</button>
            <button class="primary" on:click={save}>{mode === 'edit' ? 'Update' : 'Save'}</button>
        </footer>

        <div class="mc-hint">
            Tip: Ctrl/Cmd+Enter to save · Esc to close
        </div>
    </div>
    </Portal>
{/if}

<style>
    .mc-backdrop{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.45);
        z-index: 1000;
    }
    .mc-modal{
        position: fixed;
        left: 50%;
        top: 12%;
        transform: translateX(-50%);
        width: min(620px, calc(100vw - 22px));
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        z-index: 1001;
        overflow: hidden;
        outline: none;
    }

    .mc-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--panel-border);
    }
    .mc-title{
        font-size: 18px;
        font-weight: 750;
        opacity: .95;
    }
    .mc-x{
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .mc-body{
        padding: 14px 16px;
        display: grid;
        gap: 12px;
    }
    .row{ display: grid; gap: 6px; }
    .row.two{ grid-template-columns: 1fr 1fr; gap: 10px; }

    label{
        font-size: 13px;
        opacity: .75;
    }

    input, select, textarea{
        background: color-mix(in oklab, var(--bg), transparent 10%);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 10px 12px;
        color: inherit;
        font-size: 14px;
    }
    textarea{ resize: vertical; }

    .mc-foot{
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 14px 16px;
        border-top: 1px solid var(--panel-border);
    }
    .spacer{ margin-left: auto; }

    .primary{
        border: 1px solid rgba(231,231,234,0.22);
        background: rgba(231,231,234,0.10);
    }
    .danger{
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
        opacity: .9;
    }

    .mc-hint{
        padding: 10px 16px 14px;
        font-size: 12px;
        opacity: .65;
    }

    @media (max-width: 520px){
        .row.two{ grid-template-columns: 1fr; }
    }
</style>