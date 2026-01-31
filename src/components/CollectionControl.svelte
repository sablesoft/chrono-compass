<!-- src/components/CollectionControl.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';

    import {
        collections,
        moments,
        currentCollectionId,
        setCurrentCollection,
        createCollection,
        updateCollection,
        deleteCollection,
    } from '../lib/stores/moment';

    let open = false;

    // snapshot values for rendering
    $: cols = $collections;
    $: ms = $moments;
    $: currentId = $currentCollectionId;

    // header label
    $: currentCol = cols.find(c => c.id === currentId) ?? cols[0];
    $: currentName = currentCol?.name ?? 'My Moments';

    // counts per collection
    $: counts = (() => {
        const map = new Map<string, number>();
        for (const m of ms) map.set(m.collectionId, (map.get(m.collectionId) ?? 0) + 1);
        return map;
    })();

    $: currentCount = currentCol ? (counts.get(currentCol.id) ?? 0) : 0;

    // inline rename state
    let editingId: string | null = null;
    let editValue = '';

    // new collection input
    let creating = false;
    let newName = '';

    let rootEl: HTMLDivElement | null = null;

    function toggle() {
        open = !open;
        if (!open) {
            cancelEdit();
            cancelCreate();
        }
    }

    function close() {
        open = false;
        cancelEdit();
        cancelCreate();
    }

    function startEdit(id: string, name: string) {
        editingId = id;
        editValue = name;
        creating = false;
    }

    function commitEdit() {
        if (!editingId) return;
        const name = editValue.trim() || 'Untitled';
        updateCollection(editingId, { name });
        editingId = null;
        editValue = '';
    }

    function cancelEdit() {
        editingId = null;
        editValue = '';
    }

    function startCreate() {
        creating = true;
        newName = '';
        editingId = null;
        editValue = '';
    }

    function commitCreate() {
        const name = newName.trim();
        if (!name) {
            cancelCreate();
            return;
        }
        createCollection(name);
        creating = false;
        newName = '';
    }

    function cancelCreate() {
        creating = false;
        newName = '';
    }

    function pick(id: string) {
        setCurrentCollection(id);
        close();
    }

    function del(id: string, name: string) {
        const colCount = cols.length;
        const momentCount = counts.get(id) ?? 0;

        const msg =
            momentCount > 0
                ? `Delete collection "${name}" and ALL ${momentCount} moments inside it?`
                : `Delete collection "${name}"?`;

        if (!confirm(msg)) return;

        deleteCollection(id);

        // If user deleted the last collection, recreate default one (and we're done).
        queueMicrotask(() => {
            const after = get(collections);
            if (!after.length) {
                createCollection('My Moments');
            }
        });

        // If we deleted the currently open/editing one — just clean UI.
        if (editingId === id) cancelEdit();
    }

    function onKeyDownRoot(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }

    function onDocPointerDown(e: PointerEvent) {
        if (!open) return;
        const t = e.target as Node | null;
        if (!t) return;
        if (rootEl && !rootEl.contains(t)) close();
    }

    onMount(() => {
        document.addEventListener('pointerdown', onDocPointerDown, { capture: true });
    });

    onDestroy(() => {
        document.removeEventListener('pointerdown', onDocPointerDown, { capture: true } as any);
    });
</script>

<div class="root" bind:this={rootEl} on:keydown={onKeyDownRoot}>
    <button class="btn" on:click={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span class="name">{currentName}</span>
        <span class="dot">·</span>
        <span class="count">{currentCount}</span>
    </button>

    {#if open}
        <div class="panel" role="dialog" aria-label="Collections">
            <div class="head">
                <div class="title">Collections</div>
                <button class="x" on:click={close} aria-label="Close">✕</button>
            </div>

            <div class="list">
                {#each cols as c (c.id)}
                    <div class="row">
                        <button
                                class="pick"
                                class:active={c.id === currentId}
                                on:click={() => pick(c.id)}
                                title="Use this collection"
                        >
                            <span class="badge" style={`background:${c.markerBg};`}></span>

                            {#if editingId === c.id}
                                <input
                                        class="edit"
                                        bind:value={editValue}
                                        autofocus
                                        on:keydown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  }}
                                        on:blur={commitEdit}
                                />
                            {:else}
                                <span class="label">{c.name}</span>
                            {/if}

                            <span class="cnt">{counts.get(c.id) ?? 0}</span>
                        </button>

                        <div class="actions">
                            {#if editingId !== c.id}
                                <button class="icon" on:click={() => startEdit(c.id, c.name)} aria-label="Rename">✎</button>
                                <button class="icon danger" on:click={() => del(c.id, c.name)} aria-label="Delete">🗑</button>
                            {:else}
                                <button class="icon" on:click={commitEdit} aria-label="Save">✓</button>
                                <button class="icon" on:click={cancelEdit} aria-label="Cancel">↩</button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>

            <div class="foot">
                {#if creating}
                    <div class="create">
                        <input
                                class="new"
                                placeholder="New collection"
                                bind:value={newName}
                                autofocus
                                on:keydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitCreate(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelCreate(); }
              }}
                                on:blur={commitCreate}
                        />
                        <button class="icon" on:click={commitCreate} aria-label="Create">✓</button>
                        <button class="icon" on:click={cancelCreate} aria-label="Cancel">↩</button>
                    </div>
                {:else}
                    <button class="add" on:click={startCreate}>+ New collection</button>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .root { position: relative; display: inline-block; }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 14px;
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
        color: inherit;
        cursor: pointer;
        user-select: none;
        min-height: 40px;
    }

    .name { font-weight: 650; opacity: 0.95; }
    .dot { opacity: 0.55; }
    .count { opacity: 0.8; font-variant-numeric: tabular-nums; }

    .panel {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        width: 360px;
        max-width: calc(100vw - 24px);
        border-radius: 16px;
        border: 1px solid rgba(231,231,234,0.14);
        background: rgba(18,18,20,0.92);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 45px rgba(0,0,0,0.35);
        overflow: hidden;
        z-index: 50;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 12px 10px;
        border-bottom: 1px solid rgba(231,231,234,0.10);
    }

    .title { font-weight: 700; opacity: 0.9; }
    .x {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(231,231,234,0.14);
        background: rgba(231,231,234,0.06);
        color: inherit;
        cursor: pointer;
    }

    .list { padding: 8px; display: grid; gap: 8px; }

    .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }

    .pick {
        display: grid;
        grid-template-columns: 14px 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 12px;
        border: 1px solid rgba(231,231,234,0.10);
        background: rgba(231,231,234,0.04);
        color: inherit;
        cursor: pointer;
        text-align: left;
        width: 100%;
    }

    .pick.active {
        border-color: rgba(231,231,234,0.20);
        background: rgba(231,231,234,0.07);
    }

    .badge { width: 12px; height: 12px; border-radius: 4px; opacity: 0.95; }
    .label { opacity: 0.92; }
    .cnt { opacity: 0.65; font-variant-numeric: tabular-nums; }

    .actions { display: inline-flex; gap: 6px; }

    .icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(231,231,234,0.12);
        background: rgba(231,231,234,0.04);
        color: inherit;
        cursor: pointer;
    }

    .icon.danger { opacity: 0.85; }

    .edit, .new {
        width: 100%;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(0,0,0,0.18);
        color: inherit;
        outline: none;
    }

    .foot {
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(231,231,234,0.10);
    }

    .add {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px dashed rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.03);
        color: inherit;
        cursor: pointer;
        opacity: 0.9;
    }

    .create {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
        align-items: center;
    }
</style>
