<!-- src/components/CollectionControl.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import Portal from 'svelte-portal';

    import {
        collections,
        moments,
        currentCollectionId,
        visibleCollectionIds,
        toggleVisible,
        createCollection,
        updateCollection,
        deleteCollection,
        setCurrentCollection,
    } from '../lib/stores/moment';

    export let buttonClass = '';

    let open = false;

    // snapshots
    $: cols = $collections;
    $: ms = $moments;
    $: currentId = $currentCollectionId;

    // counts per collection
    $: counts = (() => {
        const map = new Map<string, number>();
        for (const m of ms) map.set(m.collectionId, (map.get(m.collectionId) ?? 0) + 1);
        return map;
    })();

    $: currentCol = cols.find(c => c.id === currentId) ?? cols[0];
    $: currentName = currentCol?.name ?? 'My Moments';
    $: currentCount = currentCol ? (counts.get(currentCol.id) ?? 0) : 0;
    $: currentBadge = currentCol?.markerBg ?? 'var(--accent-live)';

    // inline editing
    let editingId: string | null = null;
    let editName = '';

    // create flow
    let creating = false;
    let newName = '';

    // keep local draft for advanced fields (color/emoji/orbit/enabled)
    type Draft = { markerBg: string; emoji: string; orbit: number; enabled: boolean };
    let drafts = new Map<string, Draft>();

    // emoji input constraints (same “simple” rule as your moment form)
    const EMOJI_MAX_LEN = 5;

    let openColId: string | null = null;

    function toggleCol(id: string) {
        openColId = openColId === id ? null : id;
    }

    function ensureDraft(id: string, c: any): Draft {
        const existing = drafts.get(id);
        if (existing) return existing;

        const d: Draft = {
            markerBg: c.markerBg ?? 'var(--accent-live)',
            emoji: c.emoji ?? '📍',
            orbit: typeof c.orbit === 'number' ? c.orbit : 0.75,
            enabled: typeof c.enabled === 'boolean' ? c.enabled : true,
        };
        drafts.set(id, d);
        return d;
    }

    function isVisible(id: string) {
        return $visibleCollectionIds.includes(id);
    }

    function syncDraftFromStore() {
        // keep drafts for existing ids; drop removed
        const ids = new Set(cols.map(c => c.id));
        for (const k of Array.from(drafts.keys())) if (!ids.has(k)) drafts.delete(k);
        for (const c of cols) ensureDraft(c.id, c);
    }

    $: syncDraftFromStore();

    function toggleOpen() {
        open = !open;
        if (!open) {
            cancelEdit();
            cancelCreate();
        } else {
            // focus handling is in modal tabindex
            // (nothing else needed)
        }
    }

    function close() {
        open = false;
        cancelEdit();
        cancelCreate();
    }

    function cancelEdit() {
        editingId = null;
        editName = '';
    }

    function startEdit(c: any) {
        editingId = c.id;
        editName = c.name ?? '';
        creating = false;
    }

    function commitEdit() {
        if (!editingId) return;
        const name = (editName || '').trim() || 'Untitled';
        updateCollection(editingId, { name } as any);
        cancelEdit();
    }

    function startCreate() {
        creating = true;
        newName = '';
        cancelEdit();
    }

    function cancelCreate() {
        creating = false;
        newName = '';
    }

    function commitCreate() {
        const name = newName.trim();
        if (!name) {
            cancelCreate();
            return;
        }
        const id = createCollection(name);

        // optional: seed defaults beyond store defaults, if your store supports it
        // (safe no-op if updateCollection ignores unknown keys)
        updateCollection(id, {
            markerBg: 'var(--accent-live)',
            orbit: 0.75,
            emoji: '📍',
            enabled: true,
        } as any);

        cancelCreate();
    }

    function pick(id: string) {
        setCurrentCollection(id);
    }

    function setMarkerBg(c: any, v: string) {
        const d = ensureDraft(c.id, c);
        d.markerBg = v;
        drafts.set(c.id, d);
        updateCollection(c.id, { markerBg: v } as any);
    }

    function setEmoji(c: any, raw: string) {
        const v = (raw ?? '').trim();
        if (!v) return;
        if (v.length > EMOJI_MAX_LEN) return;

        const d = ensureDraft(c.id, c);
        d.emoji = v;
        drafts.set(c.id, d);
        updateCollection(c.id, { emoji: v } as any);
    }

    function setOrbit(c: any, v: number) {
        const orbit = Math.max(0, Math.min(1, v));
        const d = ensureDraft(c.id, c);
        d.orbit = orbit;
        drafts.set(c.id, d);
        updateCollection(c.id, { orbit } as any);
    }

    function del(c: any) {
        const momentCount = counts.get(c.id) ?? 0;
        const msg =
            momentCount > 0
                ? `Delete collection "${c.name}" and ALL ${momentCount} moments inside it?`
                : `Delete collection "${c.name}"?`;

        if (!confirm(msg)) return;

        deleteCollection(c.id);

        // If last collection was deleted, recreate default (and user gets a sane state).
        queueMicrotask(() => {
            const after = get(collections);
            if (!after.length) createCollection('My Moments');
        });

        if (editingId === c.id) cancelEdit();
    }

    // close on outside click
    let modalEl: HTMLDivElement | null = null;

    function onDocPointerDown(ev: PointerEvent) {
        if (!open) return;
        const t = ev.target as Node;
        if (modalEl && !modalEl.contains(t)) close();
    }

    function onColorInput(c: any, e: Event) {
        setMarkerBg(c, (e.currentTarget as HTMLInputElement).value);
    }

    function onEmojiInput(c: any, e: Event) {
        setEmoji(c, (e.currentTarget as HTMLInputElement).value);
    }

    function onOrbitInput(c: any, e: Event) {
        setOrbit(c, parseFloat((e.currentTarget as HTMLInputElement).value));
    }

    function onKeydown(ev: KeyboardEvent) {
        if (ev.key === 'Escape') {
            ev.preventDefault();
            close();
        }
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
            // commit edit/create quickly
            ev.preventDefault();
            if (editingId) commitEdit();
            else if (creating) commitCreate();
        }
    }

    $: {
        if (open) {
            document.addEventListener('pointerdown', onDocPointerDown, true);
            document.addEventListener('keydown', onKeydown, true);
        } else {
            document.removeEventListener('pointerdown', onDocPointerDown, true);
            document.removeEventListener('keydown', onKeydown, true);
        }
    }

    onDestroy(() => {
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        document.removeEventListener('keydown', onKeydown, true);
    });
</script>

<button
        class={`cc-btn ${buttonClass}`}
        on:click={toggleOpen}
        aria-label="Collections"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Collections"
>
    <span class="badge" style={`background:${currentBadge};`}></span>
    <span class="name">{currentName}</span>
    <span class="dot">·</span>
    <span class="count">{currentCount}</span>
</button>

{#if open}
    <Portal target="body">
        <div class="mc-backdrop"></div>

        <div class="cc-modal" bind:this={modalEl} role="dialog" aria-modal="true" tabindex="0">
            <header class="mc-head">
                <div class="mc-title">Collections</div>
                <button class="mc-x" on:click={close} aria-label="Close">✕</button>
            </header>

            <div class="mc-body">
                <div class="list">
                    {#each cols as c (c.id)}
                        {@const vis = isVisible(c.id)}
                        {@const d = ensureDraft(c.id, c)}
                        <div class="rowCard">
                            <!-- Collection Name and Control -->
                            <div class="rowTop">
                                <div class="colTop"
                                    role="button"
                                    tabindex="0"
                                    aria-expanded={openColId === c.id}
                                    on:click={() => toggleCol(c.id)}
                                    on:keydown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          toggleCol(c.id);
                                        }
                                    }}>
                                    <button class="pick" class:active={c.id === currentId} on:click={() => pick(c.id)} title="Use as current">
                                        <span class="badge big" style={`background:${d.markerBg};`}></span>

                                        {#if editingId === c.id}
                                            <input class="nameEdit"
                                                    bind:value={editName}
                                                    autofocus
                                                    on:keydown={(e) => {
                                                       if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                                                       if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                                                    }}
                                                    on:blur={commitEdit}/>
                                        {:else}
                                            <span class="label">{c.name}</span>
                                        {/if}

                                        <span class="cnt">{counts.get(c.id) ?? 0}</span>
                                    </button>
                                </div>

                                <div class="rowActions">
                                    <button class="icon"
                                            class:active={vis}
                                            on:click|stopPropagation={() => toggleVisible(c.id)}
                                            aria-label={vis ? 'Hide moments' : 'Show moments'}
                                            title={vis ? 'Visible' : 'Hidden'}>
                                        {vis ? '👁' : '🚫'}
                                    </button>

                                    {#if editingId !== c.id}
                                        <button class="icon" on:click={() => startEdit(c)} aria-label="Rename" title="Rename">✎</button>
                                        <button class="icon danger" on:click|stopPropagation={() => del(c)} aria-label="Delete" title="Delete">🗑</button>
                                    {:else}
                                        <button class="icon" on:click={commitEdit} aria-label="Save name" title="Save">✓</button>
                                        <button class="icon" on:click={cancelEdit} aria-label="Cancel rename" title="Cancel">↩</button>
                                    {/if}
                                </div>
                            </div>

                            <!-- Settings -->
                            {#if openColId === c.id}
                                <div class="colAccordion" role="group" aria-label={`Collection settings: ${c.name}`}>
                                    <div class="rowLine">
                                        <div class="segGroup">
                                            <div class="segLabel">Color</div>
                                            <div class="segControl">
                                                <input
                                                        class="color"
                                                        type="color"
                                                        value={d.markerBg?.startsWith('#') ? d.markerBg : '#7c7cff'}
                                                        on:input={(e) => onColorInput(c, e)}
                                                        title="Marker color"
                                                />
                                                <input
                                                        class="colorText"
                                                        value={d.markerBg}
                                                        on:input={(e) => onColorInput(c, e)}
                                                        placeholder="var(--accent-live) or #RRGGBB"
                                                />
                                            </div>
                                        </div>

                                        <div class="segGroup">
                                            <div class="segLabel">Emoji</div>
                                            <div class="segControl">
                                                <div class="emojiPreview" title="Default emoji">{d.emoji || '📍'}</div>
                                                <input
                                                        class="emojiInput"
                                                        value={d.emoji || '📍'}
                                                        maxlength={EMOJI_MAX_LEN}
                                                        placeholder="📍"
                                                        on:input={(e) => onEmojiInput(c, e)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div class="segGroup full">
                                        <div class="segLabel">Orbit</div>
                                        <div class="orbitBox">
                                            <input
                                                    class="orbit"
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={d.orbit}
                                                    on:input={(e) => onOrbitInput(c, e)}
                                            />
                                            <div class="orbitVal">{(d.orbit * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>

                <div class="footRow">
                    {#if creating}
                        <div class="createRow">
                            <input
                                    class="newName"
                                    placeholder="New collection name…"
                                    bind:value={newName}
                                    autofocus
                                    on:keydown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitCreate(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelCreate(); }
                }}
                                    on:blur={commitCreate}
                            />
                            <button class="icon" on:click={commitCreate} aria-label="Create" title="Create">✓</button>
                            <button class="icon" on:click={cancelCreate} aria-label="Cancel" title="Cancel">↩</button>
                        </div>
                    {:else}
                        <button class="add" on:click={startCreate}>+ New collection</button>
                    {/if}
                </div>
            </div>

            <footer class="mc-foot">
                <div class="spacer"></div>
                <button on:click={close}>Close</button>
            </footer>

            <div class="mc-hint">
                Tip: Esc to close · Ctrl/Cmd+Enter to confirm rename/create
            </div>
        </div>
    </Portal>
{/if}

<style>
    /* button in header */
    .cc-btn{
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: color-mix(in oklab, var(--panel), transparent 12%);
        color: inherit;
        cursor: pointer;
        user-select: none;
        min-height: 40px;
    }
    .badge{
        width: 12px;
        height: 12px;
        border-radius: 4px;
        opacity: .95;
    }
    .badge.big{
        width: 14px;
        height: 14px;
        border-radius: 5px;
    }
    .name{ font-weight: 700; opacity: .95; }
    .dot{ opacity: .55; }
    .count{ opacity: .75; font-variant-numeric: tabular-nums; }

    /* modal shell: reuse the same vibe as moments form */
    .mc-backdrop{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.45);
        z-index: 1000;
    }

    .cc-modal{
        position: fixed;
        left: 50%;
        top: 10%;
        transform: translateX(-50%);

        width: min(820px, calc(100vw - 32px));
        max-width: calc(100vw - 32px);

        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        z-index: 1001;
        overflow: hidden;
        outline: none;
        box-sizing: border-box;
    }

    .mc-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 12px;
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
        display: grid;
        place-items: center;
        line-height: 1;
        padding: 0;
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
        min-width: 0;
    }

    .list{
        display: grid;
        gap: 12px;
    }

    .rowCard{
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        background: color-mix(in oklab, var(--bg), transparent 10%);
        padding: 10px;
        display: grid;
        gap: 10px;
        min-width: 0;
    }

    .rowTop{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
        min-width: 0;
    }

    .pick{
        display: grid;
        grid-template-columns: 16px 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
        min-width: 0;
    }
    .pick:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }
    .pick.active{
        background: color-mix(in oklab, var(--panel), var(--accent-live) 8%);
        border-color: color-mix(in oklab, var(--panel-border), var(--accent-live) 20%);
    }

    .label{
        opacity: .92;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cnt{
        opacity: .65;
        font-variant-numeric: tabular-nums;
    }

    .rowActions{
        display: inline-flex;
        gap: 8px;
        align-items: center;
    }

    .icon{
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
        display: grid;
        place-items: center;
        opacity: .95;
        padding: 0;
        line-height: 1;
        font-size: 16px;
        vertical-align: middle;
    }
    .icon:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }
    .icon.danger{ opacity: .9; }
    .icon.active{
        border-color: color-mix(in oklab, var(--panel-border), var(--accent-live) 28%);
        background: color-mix(in oklab, var(--panel), var(--accent-live) 8%);
    }

    .nameEdit{
        width: 100%;
        min-width: 0;
        background: transparent;
        border: 0;
        outline: none;
        color: inherit;
        font-size: 14px;
        padding: 0;
    }

    /* segmented rows (copied vibe from moments form) */
    .rowLine{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        align-items: stretch;
        min-width: 0;
    }
    @media (max-width: 720px){
        .rowLine{ grid-template-columns: 1fr; }
    }

    .segGroup{
        display: grid;
        grid-template-columns: 92px 1fr;
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        overflow: hidden;
        background: color-mix(in oklab, var(--bg), transparent 10%);
        min-width: 0;
    }
    .segGroup.full{
        grid-template-columns: 92px 1fr;
    }

    .segLabel{
        display: flex;
        align-items: center;
        padding: 10px 12px;
        font-size: 13px;
        opacity: .75;
        border-right: 1px solid var(--panel-border);
        background: color-mix(in oklab, var(--panel), transparent 12%);
        white-space: nowrap;
    }

    .segControl{
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        min-width: 0;
    }

    .color{
        width: 42px;
        height: 34px;
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: transparent;
        cursor: pointer;
    }

    .colorText{
        flex: 1;
        min-width: 0;
        background: transparent;
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 8px 10px;
        color: inherit;
        font-size: 13px;
    }

    .emojiPreview{
        width: 38px;
        height: 34px;
        display: grid;
        place-items: center;
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        background: color-mix(in oklab, var(--panel), transparent 12%);
        font-size: 18px;
        line-height: 1;
    }

    .emojiInput{
        flex: 1;
        min-width: 0;
        background: transparent;
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 8px 10px;
        color: inherit;
        font-size: 13px;
    }

    .orbitBox{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        padding: 8px 10px;
        align-items: center;
        min-width: 0;
    }

    .orbit{
        width: 100%;
    }

    .orbitVal{
        width: 56px;
        text-align: right;
        opacity: .75;
        font-variant-numeric: tabular-nums;
        font-size: 13px;
    }

    .footRow{
        padding-top: 2px;
    }

    .add{
        width: 100%;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px dashed var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: .9;
    }
    .add:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }

    .createRow{
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: center;
    }

    .newName{
        background: color-mix(in oklab, var(--bg), transparent 10%);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 10px 12px;
        color: inherit;
        font-size: 14px;
        min-width: 0;
    }

    .mc-foot{
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 14px 16px;
        border-top: 1px solid var(--panel-border);
    }
    .spacer{ margin-left: auto; }

    .mc-hint{
        padding: 10px 16px 14px;
        font-size: 12px;
        opacity: .65;
    }

    .colTop{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;

        border: 1px solid var(--panel-border);
        border-radius: 14px;
        padding: 10px 12px;
        background: color-mix(in oklab, var(--bg), transparent 10%);
        cursor: pointer;
    }

    .colTop:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }

    .colAccordion{
        margin-top: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        background: var(--panel);
        padding: 12px;
        display: grid;
        gap: 10px;
    }
</style>
