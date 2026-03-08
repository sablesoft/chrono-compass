<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get } from 'svelte/store';
    import Portal from 'svelte-portal';

    import { formatWheelSpec } from '../lib/wheel/control';
    import { activeProfile, isActiveProfileLocked, profilesApi, profilesState } from '../lib/profile/store';
    import { currentLocationId, locationState } from '../lib/location/store';
    import { DEFAULT_LOCATION_ID } from '../lib/location/types';
    import type { Profile, SavedWheel } from '../lib/profile/types';
    import type { BoardWheel } from '../lib/board/types';
    import type { WheelObserverState } from '../lib/wheel/types';

    let open = false;
    let modalEl: HTMLDivElement | null = null;
    let uploadInputEl: HTMLInputElement | null = null;

    const formId = `profile-${Math.random().toString(36).slice(2, 8)}`;

    let selectedId = '';
    let nameDraft = '';

    let draftBoard: BoardWheel[] = [];
    let draftWheels: SavedWheel[] = [];
    let pendingDelete = false;

    let resetSignature = '';

    $: profiles = $profilesState.profiles;
    $: faceProfile = $activeProfile;

    $: selectedProfile = selectedId
        ? (profiles.find((p) => p.id === selectedId) ?? null)
        : null;
    $: selectedProfileLocked = !!selectedProfile?.locked;
    $: hideDeleteActions = selectedProfileLocked || $isActiveProfileLocked || !!selectedProfile?.system;

    $: wheelsList = draftWheels
        .slice()
        .sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        });

    $: boardList = draftBoard
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    $: canDelete = !!selectedProfile && selectedProfile.id !== 'default' && !pendingDelete && !hideDeleteActions;
    $: canApply = (nameDraft || '').trim().length > 0;
    $: isDirty = open && resetSignature !== makeDraftSignature();

    function uid(prefix: string) {
        return `${prefix}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    }

    function cloneSavedWheel(w: SavedWheel): SavedWheel {
        return {
            dedupKey: w.dedupKey,
            type: w.type,
            title: w.title,
            roles: { ...(w.roles ?? {}) },
            observer: { ...(w.observer ?? {}) },
            time: { ...(w.time ?? {}) },
            view: w.view ? { ...w.view } : undefined,
            favorite: !!w.favorite,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt
        };
    }

    function cloneBoardWheel(w: BoardWheel, order: number): BoardWheel {
        return {
            id: String(w.id),
            wheelType: w.wheelType,
            title: String(w.title ?? ''),
            roles: { ...(w.roles ?? {}) },
            observer: { ...(w.observer ?? {}) },
            time: { ...(w.time ?? {}) },
            order,
            size: Number.isFinite(w.size) ? Number(w.size) : undefined,
            layout: w.layout ? { ...w.layout } : undefined,
            view: w.view ? { ...w.view } : undefined
        };
    }

    function normalizeObserverForExport(observer: WheelObserverState | undefined): WheelObserverState {
        const locked = !!observer?.locked;
        if (!locked) {
            return { locationId: DEFAULT_LOCATION_ID, locked: false };
        }
        const locationId = (observer?.locationId ?? '').trim() || DEFAULT_LOCATION_ID;
        return { locationId, locked: true };
    }

    function profileBoard(profile: Profile | null): BoardWheel[] {
        return (profile?.data?.wheelsOnScreen ?? [])
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((w, idx) => cloneBoardWheel(w, idx));
    }

    function profileWheels(profile: Profile | null): SavedWheel[] {
        return (profile?.data?.wheels ?? [])
            .slice()
            .map((w) => cloneSavedWheel(w));
    }

    function wheelSpec(type: string, roles: any): string {
        return formatWheelSpec(type, roles ?? {});
    }

    function userTitle(v: string | null | undefined): string {
        const out = (v ?? '').trim();
        return out || '-';
    }

    function syncDraftFromProfile(profile: Profile | null) {
        selectedId = profile?.id ?? '';
        nameDraft = (profile?.title ?? '').trim();
        draftBoard = profileBoard(profile);
        draftWheels = profileWheels(profile);
        pendingDelete = false;
    }

    function makeDraftSignature(): string {
        const board = boardList.map((w, idx) => ({
            wheelType: w.wheelType,
            title: w.title ?? '',
            roles: w.roles ?? {},
            observer: w.observer ?? {},
            time: w.time ?? {},
            size: Number.isFinite(w.size) ? Number(w.size) : null,
            layout: w.layout ?? null,
            view: w.view ?? null,
            order: idx
        }));

        const wheels = wheelsList.map((w) => ({
            dedupKey: w.dedupKey,
            type: w.type,
            title: w.title ?? '',
            roles: w.roles ?? {},
            observer: w.observer ?? {},
            time: w.time ?? {},
            view: w.view ?? null,
            favorite: !!w.favorite
        }));

        return JSON.stringify({
            selectedId,
            nameDraft: (nameDraft ?? '').trim(),
            pendingDelete,
            board,
            wheels
        });
    }

    function openModal() {
        syncDraftFromProfile(faceProfile ?? null);
        resetSignature = makeDraftSignature();

        open = true;
        document.body.style.overflow = 'hidden';
        queueMicrotask(() => modalEl?.focus());
    }

    function close() {
        open = false;
        resetSignature = '';
        document.body.style.overflow = '';
    }

    function cancel() {
        close();
    }

    function onPickChange(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLSelectElement)) return;

        const id = el.value;
        const profile = id ? (profiles.find((p) => p.id === id) ?? null) : null;
        syncDraftFromProfile(profile);
    }

    function resetForm() {
        syncDraftFromProfile(null);
    }

    function copyDraftToNewProfile() {
        const baseName = (nameDraft || selectedProfile?.title || faceProfile?.title || 'Profile').trim() || 'Profile';
        selectedId = '';
        nameDraft = `${baseName} Copy`;
        pendingDelete = false;
    }

    function markDeleteProfile() {
        if (!selectedProfile || selectedProfile.id === 'default' || selectedProfileLocked) return;
        pendingDelete = true;
    }

    function removeBoardById(id: string) {
        draftBoard = boardList
            .filter((w) => w.id !== id)
            .map((w, idx) => ({ ...cloneBoardWheel(w, idx), order: idx }));
    }

    function removeSavedWheelByKey(dedupKey: string) {
        draftWheels = wheelsList.filter((w) => w.dedupKey !== dedupKey).map((w) => cloneSavedWheel(w));
    }

    function toggleSavedWheelFavorite(dedupKey: string) {
        draftWheels = wheelsList.map((w) => {
            if (w.dedupKey !== dedupKey) return cloneSavedWheel(w);
            return cloneSavedWheel({ ...w, favorite: !w.favorite, updatedAt: Date.now() });
        });
    }

    function addSavedWheelToBoard(dedupKey: string) {
        const src = wheelsList.find((w) => w.dedupKey === dedupKey) ?? null;
        if (!src) return;

        const nextOrder = boardList.length;
        const item: BoardWheel = {
            id: uid('boardCard'),
            wheelType: src.type,
            title: src.title ?? '',
            roles: { ...(src.roles ?? {}) },
            observer: { ...(src.observer ?? {}) },
            time: { ...(src.time ?? {}) },
            order: nextOrder,
            size: undefined,
            layout: undefined,
            view: src.view ? { ...src.view } : undefined
        };

        draftBoard = [...boardList.map((w, idx) => ({ ...cloneBoardWheel(w, idx), order: idx })), item];
    }

    function handleDownloadPlaceholder() {
        if (!selectedProfile) return;

        const normalizedBoard = boardList.map((w, idx) => {
            const copy = cloneBoardWheel(w, idx);
            return { ...copy, observer: normalizeObserverForExport(copy.observer) };
        });
        const normalizedWheels = wheelsList.map((w) => {
            const copy = cloneSavedWheel(w);
            return { ...copy, observer: normalizeObserverForExport(copy.observer) };
        });
        const favorites = normalizedWheels.filter((w) => !!w.favorite).map((w) => w.dedupKey);
        const globalLocState = get(locationState);
        const lockedLocationIds = new Set<string>();

        for (const w of normalizedBoard) {
            const obs = w.observer;
            if (obs?.locked && typeof obs.locationId === 'string' && obs.locationId.trim()) {
                lockedLocationIds.add(obs.locationId.trim());
            }
        }
        for (const w of normalizedWheels) {
            const obs = w.observer;
            if (obs?.locked && typeof obs.locationId === 'string' && obs.locationId.trim()) {
                lockedLocationIds.add(obs.locationId.trim());
            }
        }

        const exportedLocations = (globalLocState.saved ?? []).filter((loc) => lockedLocationIds.has(loc.id));
        const currentFromSet = get(currentLocationId);
        const exportedCurrentId = exportedLocations.some((x) => x.id === currentFromSet) ? currentFromSet : '';

        const payload = {
            schema: 'chrono-compass.profile-export.v1',
            exportedAt: new Date().toISOString(),
            profile: {
                id: selectedProfile.id,
                title: (nameDraft || selectedProfile.title || '').trim() || selectedProfile.title,
                system: !!selectedProfile.system,
                locked: selectedProfile.locked ?? false,
                createdAt: selectedProfile.createdAt,
                updatedAt: Date.now(),
                data: {
                    wheels: normalizedWheels,
                    favorites,
                    bodies: selectedProfile.data?.bodies ?? {},
                    locations: {
                        currentId: exportedCurrentId,
                        saved: exportedLocations
                    },
                    wheelsOnScreen: normalizedBoard
                }
            }
        };

        const pretty = JSON.stringify(payload, null, 2);
        const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const safeTitle = ((nameDraft || selectedProfile.title || 'profile').trim() || 'profile')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64) || 'profile';

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `chrono-profile-${safeTitle}-${stamp}.json`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    function handleUploadPlaceholder() {
        uploadInputEl?.click();
    }

    async function onUploadFileChange(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLInputElement)) return;
        const file = el.files?.[0] ?? null;
        el.value = '';
        if (!file) return;

        let raw = '';
        try {
            raw = await file.text();
        } catch {
            return;
        }

        let parsed: any = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        const importedId = profilesApi.upsertProfileFromImport(parsed);
        if (!importedId) return;

        profilesApi.setActive(importedId);
        close();
    }

    function apply() {
        const nextName = (nameDraft || '').trim();
        if (!nextName) return;

        if (selectedProfile && selectedProfileLocked) {
            profilesApi.setActive(selectedProfile.id);
            close();
            return;
        }

        if (pendingDelete && selectedProfile && selectedProfile.id !== 'default') {
            profilesApi.deleteProfile(selectedProfile.id);
            close();
            return;
        }

        const targetId = profilesApi.saveProfileDraft({
            id: selectedProfile?.id ?? null,
            title: nextName,
            wheels: wheelsList,
            board: boardList
        });

        if (targetId === faceProfile.id) {
            profilesApi.loadBoardFromActiveProfile();
            close();
            return;
        }

        profilesApi.setActive(targetId);
        close();
    }

    function toggle() {
        open ? close() : openModal();
    }

    function toggleLock(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (faceProfile?.system) return;
        if (!faceProfile?.id) return;
        profilesApi.setProfileLocked(faceProfile.id, !$isActiveProfileLocked);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    }

    function onFaceKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    }

    function onOverlayKeyDown(e: KeyboardEvent) {
        if (e.currentTarget !== e.target) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));

    onDestroy(() => {
        window.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = '';
    });
</script>

<div class="wrap">
    <div
        class="face"
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        aria-expanded={open}
        on:click|stopPropagation={toggle}
        on:keydown|stopPropagation={onFaceKeyDown}
    >
        <span class="left">
            <span class="seg iconSeg" title="Profile picker">
                <svg class="profileIcon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M12 12.75a4.75 4.75 0 1 0 0-9.5 4.75 4.75 0 0 0 0 9.5Zm0 1.5c-4.38 0-7.75 2.58-7.75 5.5 0 .41.34.75.75.75h14a.75.75 0 0 0 .75-.75c0-2.92-3.37-5.5-7.75-5.5Z"
                    />
                </svg>
            </span>

            <span class="seg labelSeg">
                <span class="label" title={faceProfile.title}>{faceProfile.title}</span>
            </span>
        </span>

        <span class="right">
            <button
                class="navBtn ui-lock"
                class:locked={$isActiveProfileLocked}
                type="button"
                aria-label={$isActiveProfileLocked ? 'Unlock profile' : 'Lock profile'}
                title={faceProfile?.system ? 'System profile lock is permanent' : ($isActiveProfileLocked ? 'Profile locked' : 'Profile unlocked')}
                disabled={!!faceProfile?.system}
                on:click|stopPropagation={toggleLock}
            >
                <span class="lockIco" aria-hidden="true">{$isActiveProfileLocked ? '🔒' : '🔓'}</span>
            </button>
        </span>
    </div>
</div>

{#if open}
    <Portal target="body">
        <div
            class="overlay"
            role="button"
            tabindex="0"
            aria-label="Close profile picker"
            on:click={(e) => { if (e.target === e.currentTarget) cancel(); }}
            on:keydown={onOverlayKeyDown}
        >
            <div
                class="modal"
                bind:this={modalEl}
                tabindex="-1"
                role="dialog"
                aria-modal="true"
                aria-label="Profile picker"
            >
                <input
                    bind:this={uploadInputEl}
                    class="hiddenUpload"
                    type="file"
                    accept="application/json,.json"
                    on:change={onUploadFileChange}
                />
                <header class="modalTop">
                    <div class="modalTitle">Profile</div>
                    <div class="modalActions">
                        <div class="headRail" role="group" aria-label="Profile tools">
                            <button
                                class="headBtn"
                                type="button"
                                title="Backup profile"
                                aria-label="Backup profile"
                                on:click={handleDownloadPlaceholder}
                                disabled={!selectedProfile}
                            >
                                ⬇
                            </button>
                            <button
                                class="headBtn"
                                type="button"
                                title="Restore profile"
                                aria-label="Restore profile"
                                on:click={handleUploadPlaceholder}
                            >
                                ⬆
                            </button>
                            <button class="headBtn" type="button" aria-label="Close" title="Close" on:click={cancel}>×</button>
                        </div>
                    </div>
                </header>

                <div class="modalBody">
                    <div class="row2">
                        <div class="field">
                            <label class="lbl" for={`${formId}-saved`}>Saved</label>
                            <select id={`${formId}-saved`} class="sel" bind:value={selectedId} on:change={onPickChange}>
                                <option value="">New profile...</option>
                                {#each profiles as p (p.id)}
                                    <option value={p.id}>{p.title}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="field">
                            <label class="lbl" for={`${formId}-name`}>Name</label>
                            <input id={`${formId}-name`} class="inp" bind:value={nameDraft} placeholder="Profile name" disabled={selectedProfileLocked} />
                        </div>
                    </div>

                    {#if pendingDelete}
                        <div class="pendingDelete">Profile will be deleted on Apply.</div>
                    {/if}

                    <section class="block">
                        <div class="blockTop">
                            <div class="blockTitle">Board</div>
                            <div class="blockMeta">{boardList.length}</div>
                        </div>

                        {#if boardList.length === 0}
                            <div class="empty">No wheels on board</div>
                        {:else}
                            <div class="rows">
                                {#each boardList as w (w.id)}
                                    <div class="rowItem">
                                        <div class="title" title={userTitle(w.title)}>{userTitle(w.title)}</div>
                                        <div class="spec">{wheelSpec(w.wheelType, w.roles)}</div>
                                        <div class="rowActions">
                                            {#if !hideDeleteActions}
                                                <button class="mini danger" type="button" on:click={() => removeBoardById(w.id)} disabled={pendingDelete}>Delete</button>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </section>

                    {#if !$isActiveProfileLocked}
                        <section class="block">
                            <div class="blockTop">
                                <div class="blockTitle">Wheels</div>
                                <div class="blockMeta">{wheelsList.length}</div>
                            </div>

                            {#if wheelsList.length === 0}
                                <div class="empty">No saved wheels</div>
                            {:else}
                                <div class="rows">
                                    {#each wheelsList as w (w.dedupKey)}
                                        <div class="rowItem">
                                            <div class="title" title={userTitle(w.title)}>{userTitle(w.title)}</div>
                                            <div class="spec">{wheelSpec(w.type, w.roles)}</div>
                                            <div class="rowActions">
                                                <button class="mini" type="button" title={w.favorite ? 'Unfavorite' : 'Favorite'} on:click={() => toggleSavedWheelFavorite(w.dedupKey)} disabled={pendingDelete || selectedProfileLocked}>
                                                    {w.favorite ? '★' : '☆'}
                                                </button>
                                                <button class="mini" type="button" on:click={() => addSavedWheelToBoard(w.dedupKey)} disabled={pendingDelete || selectedProfileLocked}>+ Board</button>
                                                {#if !hideDeleteActions}
                                                    <button class="mini danger" type="button" on:click={() => removeSavedWheelByKey(w.dedupKey)} disabled={pendingDelete}>Delete</button>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </section>
                    {/if}
                </div>

                <footer class="modalBottom">
                    <div class="leftBtns">
                        {#if !hideDeleteActions}
                            <button class="btn danger" type="button" on:click={markDeleteProfile} disabled={!canDelete}>Delete</button>
                        {/if}
                    </div>

                    <div class="rightBtns">
                        <button class="btn ghost" type="button" on:click={cancel} disabled={!isDirty}>Cancel</button>
                        <button class="btn" type="button" on:click={resetForm} disabled={pendingDelete}>Reset</button>
                        <button class="btn" type="button" on:click={copyDraftToNewProfile}>Copy</button>
                        <button class="btn primary" type="button" on:click={apply} disabled={!canApply}>Apply</button>
                    </div>
                </footer>
            </div>
        </div>
    </Portal>
{/if}

<style>
    .wrap { position: relative; min-width: 0; }

    .face {
        width: 100%;
        display: inline-flex;
        align-items: stretch;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--fg), transparent 93%);
        overflow: hidden;
        min-width: 0;
        cursor: pointer;
    }

    .left, .right {
        display: inline-flex;
        align-items: center;
        min-width: 0;
    }

    .left {
        padding: 0;
        min-width: 0;
        flex: 1 1 auto;
    }

    .right {
        margin-left: auto;
        flex: 0 0 auto;
    }

    .seg {
        border-radius: 0;
        background: transparent;
        outline: none;
        box-shadow: none;
        padding: 6px 12px;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        height: auto;
    }

    .seg:hover {
        outline: none;
        box-shadow: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
        font-weight: 850;
        font-size: 13px;
        letter-spacing: 0.01em;
        opacity: 0.95;
    }

    .iconSeg {
        width: 34px;
        min-width: 34px;
        max-width: 34px;
        padding: 0 !important;
        justify-content: center;
        border-right: 1px solid var(--btn-border);
        opacity: 0.9;
    }

    .labelSeg {
        flex: 1 1 auto;
        min-width: 140px;
        justify-content: center;
        padding: 6px 12px;
    }

    .ui-lock {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        min-width: 34px;
        margin: 0 !important;
        padding: 0 8px !important;
        border: 0 !important;
        border-left: 1px solid var(--btn-border) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
    }

    .ui-lock:hover:not(:disabled) {
        transform: none !important;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%) !important;
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
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 18px;
        background: var(--modal-overlay, rgba(0,0,0,0.45));
    }

    .modal {
        width: min(980px, 96vw);
        max-height: min(86vh, 940px);
        overflow: auto;
        background: var(--modal-bg, var(--panel));
        border: 1px solid var(--modal-border, var(--panel-border));
        border-radius: 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.45);
        display: flex;
        flex-direction: column;
    }

    .hiddenUpload {
        display: none;
    }

    .modalTop {
        position: sticky;
        top: 0;
        background: var(--modal-bg, var(--panel));
        border-bottom: 1px solid var(--btn-border);
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        z-index: 1;
    }

    .modalTitle {
        font-size: 16px;
        font-weight: 900;
        opacity: 0.92;
    }

    .modalActions {
        display: inline-flex;
        align-items: center;
    }

    .headRail {
        --seg-size: 34px;
        flex: 0 0 auto;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: var(--seg-size);
        border: 1px solid var(--btn-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--btn-bg);
    }

    .headBtn {
        width: 100%;
        height: var(--seg-size);
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-right: 1px solid var(--btn-border);
        border-radius: 0;
        background: transparent;
        color: inherit;
        display: inline-grid;
        place-items: center;
        cursor: pointer;
        line-height: 1;
        font-size: 16px;
    }

    .headBtn:hover:not(:disabled) {
        transform: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
    }

    .headBtn:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .headBtn:last-child {
        border-right: 0;
    }

    .modalBody {
        padding: 12px;
        display: grid;
        gap: 12px;
    }

    .row2 {
        display: grid;
        grid-template-columns: 1.2fr 1.8fr;
        gap: 10px;
        align-items: end;
    }

    .field {
        display: grid;
        gap: 6px;
        min-width: 0;
    }

    .lbl {
        font-size: 12px;
        font-weight: 900;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inp, .sel {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        font: inherit;
    }

    .inp:focus-visible, .sel:focus-visible {
        outline: 3px solid var(--ring);
        outline-offset: 2px;
    }

    .pendingDelete {
        border: 1px solid color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 88%);
        border-radius: 12px;
        padding: 10px 12px;
        font-weight: 800;
        opacity: 0.9;
    }

    .block {
        border: 1px solid var(--btn-border);
        border-radius: 14px;
        padding: 10px;
        display: grid;
        gap: 8px;
        background: color-mix(in oklab, var(--panel), transparent 10%);
    }

    .blockTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .blockTitle {
        font-size: 12px;
        font-weight: 900;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .blockMeta {
        font-variant-numeric: tabular-nums;
        font-weight: 800;
        opacity: 0.75;
    }

    .rows {
        display: grid;
        gap: 6px;
        max-height: min(34vh, 320px);
        overflow-y: auto;
        padding-right: 2px;
    }

    .rowItem {
        display: grid;
        grid-template-columns: minmax(180px, 1.4fr) minmax(120px, 1fr) auto;
        gap: 8px;
        align-items: center;
        border: 1px solid color-mix(in oklab, var(--btn-border), transparent 35%);
        border-radius: 10px;
        padding: 8px;
    }

    .spec {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 650;
        opacity: 0.82;
    }

    .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.95;
        font-weight: 850;
    }

    .rowActions {
        display: inline-flex;
        gap: 6px;
    }

    .mini {
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        font-weight: 800;
        cursor: pointer;
        min-width: 34px;
    }

    .mini:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .mini.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    .empty {
        border: 1px dashed color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        border-radius: 10px;
        padding: 10px 12px;
        font-weight: 700;
        opacity: 0.7;
    }

    .modalBottom {
        border-top: 1px solid var(--btn-border);
        padding: 12px 12px 14px 12px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        background: var(--modal-bg, var(--panel));
        flex-wrap: wrap;
    }

    .leftBtns, .rightBtns {
        display: inline-flex;
        gap: 10px;
    }

    .btn {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        font-weight: 900;
        cursor: pointer;
    }

    .btn.primary {
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .btn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    @media (max-width: 840px) {
        .row2 {
            grid-template-columns: 1fr;
        }

        .rowItem {
            grid-template-columns: 1fr;
        }

        .rowActions {
            justify-content: flex-start;
            flex-wrap: wrap;
        }

        .rightBtns,
        .leftBtns {
            width: 100%;
            justify-content: space-between;
        }
    }
</style>
