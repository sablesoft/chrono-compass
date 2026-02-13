<!-- src/components/WheelPicker.svelte -->
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import type { BodyId, WheelType, WheelSpec, RoleName } from '../lib/catalog';
    import { bodies, wheels } from '../lib/catalog';

    import {
        hasRoleValue,
        isMultiTarget,
        type WheelRolesState,
        rolesUsedBySpec,
        optionsForRole,
        normalizeRolesForType,
        isCompatible,
        formatWheelSpec,
        defaultTitle,
        shallowEqualRoles
    } from '../lib/wheel/control';

    import { debug } from '../lib/debug';

    // profiles (saved wheels live here now)
    import { activeProfile, profilesApi } from '../lib/profile/store';
    import type { SavedWheel } from '../lib/profile/types';

    // board
    import { boardApi } from '../lib/board/store';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import { makeWheelId } from '../lib/wheel/id';

    const dbg = debug('profile', '🧩');

    export let type: WheelType;
    // applied values
    export let roles: WheelRolesState = {};
    export let title: string = '';

    // base wheel context (needed for New + board key check)
    export let baseWheelId: string;
    export let baseObserver: WheelObserverState;
    export let baseTime: WheelTimeState;

    // kept for compatibility; we will call it on Update (so parent can still do extra stuff if needed)
    export let onApply: (payload: { roles: WheelRolesState; title: string }) => void = () => {};
    export let onCancel: () => void = () => {};

    let spec: WheelSpec;
    $: spec = wheels[type];

    let usedRoles: RoleName[] = [];
    $: usedRoles = rolesUsedBySpec(spec);

    // header (applied state)
    let specText = '';
    let titleText = '';
    $: specText = formatWheelSpec(type, roles);
    $: titleText = title?.trim()?.length ? title.trim() : defaultTitle(type, roles);

    let modalEl: HTMLDivElement | null = null;
    let open = false;

    let draftRoles: WheelRolesState = {};
    let draftTitle = '';

    let initialRoles: WheelRolesState = {};
    let initialTitle = '';

    let multiTarget = false;
    $: multiTarget = isMultiTarget(spec);
    let draftTargets: BodyId[] = [];

    let effectiveDraftRoles: WheelRolesState = {};
    $: effectiveDraftRoles = multiTarget ? { ...draftRoles, target: draftTargets } : draftRoles;

    const uid = `wp_${Math.random().toString(36).slice(2)}`;
    const idName = `${uid}_name`;
    const idSpec = `${uid}_spec`;
    const idSaved = `${uid}_saved`;
    const roleId = (r: string) => `${uid}_role_${r}`;

    // -----------------------------------------
    // saved wheels list (reactive from profile)
    // -----------------------------------------
    let savedList: SavedWheel[] = [];
    $: {
        const p = $activeProfile;
        const list = (p?.data?.wheels ?? []).filter(w => w.type === type);

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt - a.updatedAt);
        });

        savedList = list;
    }

    // UI select state (for loading into draft)
    let pickedSavedId = '';

    // current config id from draft (for "is saved?" + delete/fav on match)
    let currentCfgId = '';
    $: currentCfgId = makeWheelId(type, effectiveDraftRoles, baseObserver, baseTime);

    let currentSaved: SavedWheel | null = null;
    $: currentSaved = savedList.find(w => w.id === currentCfgId) ?? null;

    let isSaved = false;
    $: isSaved = currentSaved != null;

    let isFav = false;
    $: isFav = !!currentSaved?.favorite;

    // board existence check for this exact wheelId
    let existsOnBoard = false;
    $: existsOnBoard = !!currentCfgId && boardApi.hasWheelId(currentCfgId);

    // validity / dirty
    let draftCompatible = false;
    let hasAllRolesOk = false;
    let isDirty = false;

    $: draftCompatible = isCompatible(spec, effectiveDraftRoles);
    $: hasAllRolesOk = usedRoles.every(r => hasRoleValue(spec, r, effectiveDraftRoles[r]));
    $: isDirty = !shallowEqualRoles(roles, effectiveDraftRoles) || (title ?? '') !== (draftTitle ?? '');

    // Update is only meaningful if dirty + valid + AND not conflicting with other wheel on board.
    // If config matches some existing wheelId on board, Update would collide unless it's the same wheel.
    let canUpdate = false;
    $: canUpdate =
        hasAllRolesOk &&
        draftCompatible &&
        isDirty &&
        (!existsOnBoard || currentCfgId === baseWheelId);

    // New: valid config + must not already exist on board
    let canNew = false;
    $: canNew = hasAllRolesOk && draftCompatible && !existsOnBoard;

    function openModal() {
        dbg.log('WheelPicker.open', { type });

        initialRoles = { ...roles };
        initialTitle = title ?? '';

        draftRoles = { ...roles };
        draftTitle = title ?? '';

        if (multiTarget) {
            const t = roles.target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : (t ? [t as BodyId] : []);
        } else {
            draftTargets = [];
        }

        const appliedId = makeWheelId(type, roles, baseObserver, baseTime);
        pickedSavedId = savedList.some(w => w.id === appliedId) ? appliedId : '';

        open = true;
        queueMicrotask(() => modalEl?.focus());
    }

    function closeModal(reason: 'cancel' | 'update' | 'new' = 'cancel') {
        dbg.log('WheelPicker.close', { type, reason });
        open = false;
        if (reason === 'cancel') onCancel();
    }

    function clearDraft() {
        dbg.log('WheelPicker.clearDraft', { type });

        for (const r of usedRoles) {
            if (r === 'target' && multiTarget) continue;
            draftRoles[r] = null;
        }
        draftRoles = { ...draftRoles };
        if (multiTarget) draftTargets = [];
        draftTitle = '';
        pickedSavedId = '';
    }

    function resetDraft() {
        dbg.log('WheelPicker.resetDraft', { type });

        draftRoles = { ...initialRoles };
        draftTitle = initialTitle;

        if (multiTarget) {
            const t = initialRoles.target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : (t ? [t as BodyId] : []);
        } else {
            draftTargets = [];
        }

        const id = makeWheelId(type, multiTarget ? { ...initialRoles, target: draftTargets } : initialRoles, baseObserver, baseTime);
        pickedSavedId = savedList.some(w => w.id === id) ? id : '';
    }

    function setRole(role: RoleName, value: string) {
        const v = (value || '') as BodyId;
        if (role === 'target' && multiTarget) return;

        draftRoles = { ...draftRoles, [role]: (v ? v : null) };
        draftRoles = normalizeRolesForType(spec, draftRoles);

        if (multiTarget) {
            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: draftTargets });
            const t = normalized.target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : [];
            draftRoles = { ...normalized, target: draftRoles.target };
        }

        pickedSavedId = '';
    }

    function handleRoleChange(role: RoleName, e: Event) {
        const el = e.currentTarget as HTMLSelectElement | null;
        setRole(role, el?.value ?? '');
    }

    function handleTargetsChange(e: Event) {
        if (!multiTarget) return;
        const el = e.currentTarget as HTMLSelectElement | null;
        if (!el) return;

        const picked = Array.from(el.selectedOptions)
            .map(o => o.value)
            .filter(Boolean) as BodyId[];

        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as BodyId[]) : [];
        draftRoles = { ...normalized, target: draftRoles.target };

        pickedSavedId = '';
    }

    function updateExisting() {
        if (!canUpdate) return;

        const nextTitle = (draftTitle ?? '').trim();
        const nextRoles = effectiveDraftRoles;

        dbg.log('WheelPicker.update', { type, roles: nextRoles, title: nextTitle, baseWheelId });

        // keep old hook (parent might update UI title etc.)
        onApply({ roles: nextRoles, title: nextTitle });

        // ensure board updated (safe even if parent also does it; upsertWheel will compute id)
        boardApi.upsertWheel(
            { mode: 'updateById', wheelId: baseWheelId },
            { wheelType: type, roles: nextRoles, title: nextTitle },
            'WheelPicker.update'
        );

        closeModal('update');
    }

    function createNew() {
        if (!canNew) return;

        const nextTitle = (draftTitle ?? '').trim() || defaultTitle(type, effectiveDraftRoles);
        const nextRoles = effectiveDraftRoles;

        dbg.log('WheelPicker.new', { type, roles: nextRoles, title: nextTitle });

        boardApi.upsertWheel(
            { mode: 'upsertByKey' },
            { wheelType: type, roles: nextRoles, title: nextTitle, observer: baseObserver, time: baseTime },
            'WheelPicker.new'
        );

        closeModal('new');
    }

    function onKeyDown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal('cancel');
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => window.removeEventListener('keydown', onKeyDown));

    function bodyLabel(id: BodyId): string {
        const b = (bodies as any)[id];
        return b?.name?.en ?? String(id);
    }

    let draftSpec = '';
    $: draftSpec = formatWheelSpec(type, effectiveDraftRoles);

    function handlePickSaved(e: Event) {
        const el = e.currentTarget as HTMLSelectElement | null;
        const id = el?.value ?? '';
        pickedSavedId = id;

        if (!id) return;

        const w = savedList.find(x => x.id === id) ?? null;

        dbg.group('WheelPicker.pickSaved', () => {
            dbg.log('picked', { profileId: $activeProfile?.id, type, id, wheel: w?.title });
        });

        if (!w) return;

        draftTitle = w.title ?? '';
        const r = w.roles ?? {};

        draftRoles = { ...r };
        draftRoles = normalizeRolesForType(spec, draftRoles);

        if (multiTarget) {
            const t = (r as any).target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : (t ? [t as BodyId] : []);

            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: draftTargets });
            const nt = normalized.target;
            draftTargets = Array.isArray(nt) ? (nt as BodyId[]) : [];
            draftRoles = { ...normalized, target: draftRoles.target };
        } else {
            draftTargets = [];
        }
    }

    function saveCurrentConfig() {
        if (!hasAllRolesOk || !draftCompatible) {
            dbg.warn('WheelPicker.save blocked', { profileId: $activeProfile?.id, type, hasAllRolesOk, draftCompatible });
            return;
        }

        const t = (draftTitle ?? '').trim() || defaultTitle(type, effectiveDraftRoles);
        const savedId = profilesApi.saveWheel({ type, title: t, roles: effectiveDraftRoles, observer: baseObserver, time: baseTime});

        dbg.log('WheelPicker.saved', { id: savedId, title: t });
        pickedSavedId = savedId || makeWheelId(type, effectiveDraftRoles, baseObserver, baseTime);
    }

    function deleteCurrentConfig() {
        if (!currentSaved) return;

        profilesApi.deleteWheel(currentSaved.id);
        dbg.log('WheelPicker.deleted', { id: currentSaved.id });

        if (pickedSavedId === currentSaved.id) pickedSavedId = '';
    }

    function toggleFavCurrent() {
        if (!currentSaved) return;
        profilesApi.setWheelFavorite(currentSaved.id, !currentSaved.favorite);
        dbg.log('WheelPicker.favorite', { id: currentSaved.id, value: !currentSaved.favorite });
    }
</script>

<div class="left">
    <div class="title">{titleText}</div>

    <button type="button" class="wheelCodeBtn" on:click={openModal} title="Wheel picker">
        {specText}
    </button>
</div>

{#if open}
    <div class="overlay" role="presentation" on:click={() => closeModal('cancel')}>
        <div
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-label="Wheel picker"
                tabindex="-1"
                bind:this={modalEl}
                on:click|stopPropagation
        >
            <header class="modalTop">
                <div class="modalTitle">Wheel Picker</div>
                <button class="x" type="button" aria-label="Close" on:click={() => closeModal('cancel')}>×</button>
            </header>

            <div class="modalBody">
                <div class="row">
                    <label class="lbl" for={idSaved}>Saved</label>

                    <div class="savedRow">
                        <select id={idSaved} class="sel" on:change={handlePickSaved} bind:value={pickedSavedId}>
                            <option value="">—</option>
                            {#each savedList as w (w.id)}
                                <option value={w.id}>
                                    {w.favorite ? '★ ' : ''}{w.title || '(untitled)'}
                                </option>
                            {/each}
                        </select>

                        <button
                                type="button"
                                class="iconBtn"
                                title={isSaved ? 'Save (overwrite)' : 'Save'}
                                on:click={saveCurrentConfig}
                                disabled={!hasAllRolesOk || !draftCompatible}
                        ><span class="ico">💾</span></button>

                        <button
                                type="button"
                                class="iconBtn"
                                title={isFav ? 'Unfavorite' : 'Favorite'}
                                on:click={toggleFavCurrent}
                                disabled={!isSaved}
                        ><span class="ico">{isFav ? '★' : '☆'}</span></button>

                        <button
                                type="button"
                                class="iconBtn danger"
                                title="Delete"
                                on:click={deleteCurrentConfig}
                                disabled={!isSaved}
                        ><span class="ico">🗑</span></button>
                    </div>
                </div>

                <div class="row">
                    <label class="lbl" for={idName}>Name</label>
                    <input
                            id={idName}
                            class="inp"
                            type="text"
                            placeholder={defaultTitle(type, effectiveDraftRoles)}
                            bind:value={draftTitle}
                    />
                </div>

                <div class="row">
                    <label class="lbl" for={idSpec}>Spec</label>
                    <div id={idSpec} class="specPreview">{draftSpec}</div>
                </div>

                {#each usedRoles as r (r)}
                    <div class="row">
                        <label class="lbl" for={roleId(r)}>{r}</label>

                        {#if r === 'target' && multiTarget}
                            <select
                                    id={roleId(r)}
                                    class="sel selMulti"
                                    multiple
                                    on:input={handleTargetsChange}
                                    on:change={handleTargetsChange}
                            >
                                {#each optionsForRole(spec, r, effectiveDraftRoles) as id (id)}
                                    <option value={id} selected={draftTargets.includes(id)}>
                                        {bodyLabel(id)}
                                    </option>
                                {/each}
                            </select>
                        {:else}
                            <select id={roleId(r)} class="sel" on:change={(e) => handleRoleChange(r, e)}>
                                <option value="" selected={(effectiveDraftRoles[r] ?? '') === ''}>—</option>
                                {#each optionsForRole(spec, r, effectiveDraftRoles) as id (id)}
                                    <option value={id} selected={effectiveDraftRoles[r] === id}>
                                        {bodyLabel(id)}
                                    </option>
                                {/each}
                            </select>
                        {/if}
                    </div>
                {/each}

                {#if !draftCompatible && hasAllRolesOk}
                    <div class="warn">⚠ This configuration is unavailable (catalog changed). Edit roles.</div>
                {/if}

                {#if existsOnBoard && currentCfgId !== baseWheelId}
                    <div class="existsNote">⚠ This wheel already exists on board.</div>
                {/if}
            </div>

            <footer class="modalBottom">
                <div class="leftBtns">
                    <button type="button" class="btn ghost" on:click={clearDraft}>Clear</button>
                    <button type="button" class="btn ghost" on:click={resetDraft} disabled={!isDirty}>Reset</button>
                </div>

                <div class="rightBtns">
                    <button type="button" class="btn ghost" on:click={() => closeModal('cancel')}>Cancel</button>
                    <button type="button" class="btn primary" on:click={updateExisting} disabled={!canUpdate}>Update</button>
                    <button type="button" class="btn primary" on:click={createNew} disabled={!canNew}>New</button>
                </div>
            </footer>
        </div>
    </div>
{/if}

<style>
    .left { display: grid; gap: 6px; }

    .title {
        font-size: 24px;
        font-weight: 650;
        opacity: 0.95;
    }

    .wheelCodeBtn {
        margin-top: 7px;
        border-top: 1px solid var(--btn-border);
        border-radius: 0;
        background: transparent;
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
        padding: 0;
        text-align: left;
        font: inherit;
        color: inherit;
        cursor: pointer;
        opacity: 0.9;
        transition: opacity 120ms ease, transform 120ms ease;
    }
    .wheelCodeBtn:hover {
        opacity: 1;
        color: var(--accent-gold);
        transform: translateY(-1px);
    }
    .wheelCodeBtn:active { transform: translateY(0px); }
    .wheelCodeBtn:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 3px;
        border-radius: 8px;
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
        padding: 14px 14px 10px 14px;
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
    .x:hover {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
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
    .row > * { min-width: 0; }

    .lbl {
        font-size: 13px;
        font-weight: 800;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inp, .sel, .specPreview { width: 100%; box-sizing: border-box; }

    .inp, .sel {
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
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
    }
    .ico { display: inline-block; line-height: 1; transform: translateY(-0.5px); }

    .iconBtn:hover:not(:disabled) {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .iconBtn:active:not(:disabled) { transform: translateY(0px); }
    .iconBtn:disabled { opacity: 0.45; cursor: default; transform: none; }

    .iconBtn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    .selMulti {
        min-height: 120px;
        padding: 8px 10px;
    }

    .inp:focus-visible, .sel:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 2px;
    }

    .specPreview {
        font-variant-numeric: tabular-nums;
        opacity: 0.9;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 14%);
        min-height: 44px;
        display: flex;
        align-items: center;
    }

    .warn {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--accent-gold), transparent 55%);
        background: color-mix(in oklab, var(--accent-gold), transparent 88%);
        font-weight: 700;
        opacity: 0.9;
    }

    .existsNote {
        font-size: 12px;
        font-weight: 750;
        opacity: 0.8;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--accent-gold), transparent 60%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 14%);
    }

    .modalBottom {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px 14px 14px;
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
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
    }

    .btn:hover:not(:disabled) {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }

    .btn:active:not(:disabled) { transform: translateY(0px); }
    .btn:disabled { opacity: 0.45; cursor: default; transform: none; }

    .btn.primary {
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }

    .btn.ghost { opacity: 0.92; }

    /* make disabled look consistently disabled even when the base styles are "active" */
    .btn:disabled,
    .btn.primary:disabled,
    .btn.ghost:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
        filter: saturate(0.8);
    }
</style>
