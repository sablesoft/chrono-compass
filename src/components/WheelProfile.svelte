<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import type { WheelType } from '../lib/catalog';
    import { activeProfile, profilesApi } from '../lib/profile/store';
    import type { SavedWheel } from '../lib/profile/types';
    import { makeDedupKey } from '../lib/profile/dedup';
    import type { WheelRolesState } from '../lib/wheel/control';
    import { formatWheelSpec } from '../lib/wheel/control';
    import { boardApi } from '../lib/board/store';
    import type { BoardWheelView } from '../lib/board/types';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';

    export let type: WheelType;
    export let roles: WheelRolesState = {};
    export let title = '';

    export let baseId: string;
    export let baseObserver: WheelObserverState;
    export let baseTime: WheelTimeState;
    export let baseView: BoardWheelView | undefined = undefined;

    export let onCancel: () => void = () => {};

    let open = false;
    let modalEl: HTMLDivElement | null = null;

    const uid = `wprofile_${Math.random().toString(36).slice(2)}`;
    const idProfile = `${uid}_profile`;
    const idSaved = `${uid}_saved`;
    const idName = `${uid}_name`;

    $: activeProfileTitle = ($activeProfile?.title ?? '').trim() || 'Default';

    let savedList: SavedWheel[] = [];
    $: {
        const list = ($activeProfile?.data?.wheels ?? []).filter((w) => w.type === type);
        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return b.updatedAt - a.updatedAt;
        });
        savedList = list;
    }

    let pickedSavedKey = '';
    let draftTitle = '';

    $: currentCfgKey = makeDedupKey(type, roles, baseObserver, baseTime);
    $: currentSaved = savedList.find((w) => w.dedupKey === currentCfgKey) ?? null;
    $: pickedSaved = pickedSavedKey ? (savedList.find((w) => w.dedupKey === pickedSavedKey) ?? null) : null;
    $: targetSaved = pickedSaved ?? currentSaved;

    $: isSaved = currentSaved != null;
    $: isFav = !!currentSaved?.favorite;

    function openModal() {
        draftTitle = title ?? '';
        pickedSavedKey = currentSaved?.dedupKey ?? '';
        open = true;
        queueMicrotask(() => modalEl?.focus());
    }

    function closeModal() {
        open = false;
        onCancel();
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    }

    function isTypingTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        return target.isContentEditable;
    }

    function onOverlayKeyDown(e: KeyboardEvent) {
        if (isTypingTarget(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => window.removeEventListener('keydown', onKeyDown));

    function readSelectValue(e: Event): string {
        const el = e.currentTarget;
        if (el instanceof HTMLSelectElement) return el.value;
        return '';
    }

    function handlePickSaved(e: Event) {
        const k = readSelectValue(e);
        pickedSavedKey = k;
        const w = k ? (savedList.find((x) => x.dedupKey === k) ?? null) : null;
        if (w) draftTitle = w.title ?? draftTitle;
    }

    function applyChanges() {
        const nextTitle = (draftTitle ?? '').trim() || formatWheelSpec(type, roles);
        if (pickedSaved) {
            boardApi.updateWheelById(
                baseId,
                {
                    title: nextTitle,
                    roles: pickedSaved.roles,
                    observer: pickedSaved.observer,
                    time: pickedSaved.time,
                    view: pickedSaved.view
                },
                'WheelProfile.applySaved'
            );
            closeModal();
            return;
        }
        boardApi.updateWheelById(baseId, { title: nextTitle }, 'WheelProfile.rename');
        closeModal();
    }

    function saveCurrentConfig() {
        const nextTitle = (draftTitle ?? '').trim() || formatWheelSpec(type, roles);
        const dedupKey = profilesApi.saveWheel({
            type,
            title: nextTitle,
            roles,
            observer: baseObserver,
            time: baseTime,
            view: baseView
        });
        pickedSavedKey = dedupKey;
    }

    function toggleFav() {
        const target = targetSaved;
        if (!target) return;
        profilesApi.setWheelFavorite(target.dedupKey, !target.favorite);
    }

    function removeSaved() {
        const target = targetSaved;
        if (!target) return;
        profilesApi.deleteWheel(target.dedupKey);
        if (pickedSavedKey === target.dedupKey) pickedSavedKey = '';
    }
</script>

<button type="button" class="navBtn wheelProfileBtn" title="Wheel profile" aria-label="Wheel profile" on:click={openModal}>
    <svg class="profileIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M12 12.75a4.75 4.75 0 1 0 0-9.5 4.75 4.75 0 0 0 0 9.5Zm0 1.5c-4.38 0-7.75 2.58-7.75 5.5 0 .41.34.75.75.75h14a.75.75 0 0 0 .75-.75c0-2.92-3.37-5.5-7.75-5.5Z"
        />
    </svg>
</button>

{#if open}
    <div
        class="overlay"
        role="button"
        tabindex="0"
        aria-label="Close wheel profile"
        on:click={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        on:keydown={onOverlayKeyDown}
    >
        <div class="modal" role="dialog" aria-modal="true" aria-label="Wheel profile" tabindex="-1" bind:this={modalEl}>
            <header class="modalTop">
                <div class="modalTitle">Wheel Profile</div>
                <button class="x" type="button" aria-label="Close" on:click={closeModal}>×</button>
            </header>

            <div class="modalBody">
                <div class="row">
                    <label class="lbl" for={idProfile}>Profile</label>
                    <select id={idProfile} class="sel" disabled>
                        <option value="active">{activeProfileTitle}</option>
                    </select>
                </div>

                <div class="row">
                    <label class="lbl" for={idSaved}>Saved</label>
                    <div class="savedRow">
                        <select id={idSaved} class="sel" on:change={handlePickSaved} bind:value={pickedSavedKey}>
                            <option value="">—</option>
                            {#each savedList as w (w.dedupKey)}
                                <option value={w.dedupKey}>{w.favorite ? '★ ' : ''}{w.title || '(untitled)'}</option>
                            {/each}
                        </select>

                        <button type="button" class="iconBtn" title={isSaved ? 'Save (overwrite current config)' : 'Save current config'} on:click={saveCurrentConfig}>
                            <span class="ico">💾</span>
                        </button>
                        <button type="button" class="iconBtn" title={targetSaved?.favorite ? 'Unfavorite' : 'Favorite'} on:click={toggleFav} disabled={!targetSaved}>
                            <span class="ico">{targetSaved?.favorite ? '★' : '☆'}</span>
                        </button>
                        <button type="button" class="iconBtn danger" title="Delete" on:click={removeSaved} disabled={!targetSaved}>
                            <span class="ico">🗑</span>
                        </button>
                    </div>
                </div>

                <div class="row">
                    <label class="lbl" for={idName}>Name</label>
                    <input id={idName} class="inp" type="text" bind:value={draftTitle} placeholder={formatWheelSpec(type, roles)} />
                </div>
            </div>

            <footer class="modalBottom">
                <div class="leftBtns"></div>
                <div class="rightBtns">
                    <button type="button" class="btn ghost" on:click={closeModal}>Close</button>
                    <button type="button" class="btn primary" on:click={applyChanges}>Apply</button>
                </div>
            </footer>
        </div>
    </div>
{/if}

<style>
    .wheelProfileBtn {
        display: inline-grid;
        place-items: center;
    }

    .profileIcon {
        width: 14px;
        height: 14px;
        display: block;
        fill: currentColor;
    }

    .overlay {
        position: fixed;
        inset: 0;
        background: color-mix(in oklab, black, transparent 55%);
        display: grid;
        place-items: center;
        z-index: 9999;
        padding: 18px;
    }

    .modal {
        width: min(620px, 96vw);
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0,0,0,0.45);
    }

    .modalTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 14px 10px;
        border-bottom: 1px solid var(--btn-border);
    }

    .modalTitle {
        font-size: 18px;
        font-weight: 800;
        opacity: 0.92;
    }

    .x {
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

    .modalBody {
        padding: 14px;
        display: grid;
        gap: 10px;
    }

    .row {
        display: grid;
        grid-template-columns: 90px 1fr;
        align-items: center;
        gap: 10px;
    }

    .lbl {
        font-size: 13px;
        font-weight: 800;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inp, .sel {
        width: 100%;
        box-sizing: border-box;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        padding: 10px 12px;
        font: inherit;
        outline: none;
    }

    .savedRow {
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 8px;
        align-items: center;
    }

    .iconBtn {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        padding: 0;
    }

    .iconBtn:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .modalBottom {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px 14px;
        border-top: 1px solid var(--btn-border);
    }

    .leftBtns, .rightBtns { display: flex; gap: 10px; }

    .btn {
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-weight: 800;
    }
</style>
