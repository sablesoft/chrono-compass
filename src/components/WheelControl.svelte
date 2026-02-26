<!-- src/components/WheelControl.svelte -->
<script lang="ts">
    import {onDestroy, onMount} from 'svelte';
    import type {ObjId, RoleName, WheelSpec, WheelType} from '../lib/catalog';
    import {objects, wheels} from '../lib/catalog';

    import {
        formatWheelSpec,
        hasRoleValue,
        isCompatible,
        isMultiTarget,
        normalizeRolesForType,
        optionsForRole,
        rolesUsedBySpec,
        shallowEqualRoles,
        type WheelRolesState
    } from '../lib/wheel/control';

    import {debug} from '../lib/debug';

    // profiles (saved wheels live here now)
    import {activeProfile, profilesApi} from '../lib/profile/store';
    import type {SavedWheel} from '../lib/profile/types';
    import {makeDedupKey} from '../lib/profile/dedup';

    // board
    import {boardApi} from '../lib/board/store';
    import type {WheelObserverState, WheelTimeState} from '../lib/wheel/types';

    const dbg = debug('control', '🧩');

    export let type: WheelType;
    // applied values
    export let roles: WheelRolesState = {};
    export let title: string = '';

    // base wheel context:
    // - baseId is the REAL identity on board (stable, unique per instance)
    // - baseObserver/baseTime participate in dedupKey for profile saves
    export let baseId: string;
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
    $: titleText = title?.trim()?.length ? title.trim() : formatWheelSpec(type, roles);

    let modalEl: HTMLDivElement | null = null;
    let open = false;

    let draftRoles: WheelRolesState = {};
    let draftTitle = '';

    let initialRoles: WheelRolesState = {};
    let initialTitle = '';

    let multiTarget = false;
    $: multiTarget = isMultiTarget(spec);
    let draftTargets: ObjId[] = [];

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
        const list = ($activeProfile?.data?.wheels ?? []).filter(w => w.type === type);

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt - a.updatedAt);
        });

        savedList = list;
    }

    // UI select state (for loading into draft)
    let pickedSavedKey = '';

    // current config dedupKey from draft (for "is saved?" + delete/fav on match)
    let currentCfgKey = '';
    $: currentCfgKey = makeDedupKey(type, effectiveDraftRoles, baseObserver, baseTime);

    let currentSaved: SavedWheel | null = null;
    $: currentSaved = savedList.find(w => w.dedupKey === currentCfgKey) ?? null;

    let isSaved = false;
    $: isSaved = currentSaved != null;

    let isFav = false;
    $: isFav = !!currentSaved?.favorite;

    // validity / dirty
    let draftCompatible = false;
    let hasAllRolesOk = false;
    let isDirty = false;

    $: draftCompatible = isCompatible(spec, effectiveDraftRoles);
    $: hasAllRolesOk = usedRoles.every(r => hasRoleValue(spec, r, effectiveDraftRoles[r]));
    $: isDirty = !shallowEqualRoles(roles, effectiveDraftRoles) || (title ?? '') !== (draftTitle ?? '');

    // Update: applies to THIS board wheel instance (baseId). Duplicates are allowed on board -> no "exists" checks.
    let canUpdate = false;
    $: canUpdate = hasAllRolesOk && draftCompatible && isDirty;

    // New: always allowed when config is valid (board can have duplicates)
    let canNew = false;
    $: canNew = hasAllRolesOk && draftCompatible;

    function openModal() {
        dbg.log('WheelPicker.open', { type });

        dbg.group('WheelControl.openModal.snapshot', () => {
            const rolesTarget = (roles as any)?.target;
            const savedKeys = savedList.map(w => w.dedupKey);

            dbg.log('props', {
                type,
                title,
                roles,
                rolesTarget,
                rolesTargetType: Array.isArray(rolesTarget) ? 'array' : typeof rolesTarget,
                baseId,
                baseObserver,
                baseTime,
                savedListLen: savedList.length
            });

            let computedFromProps = '';
            try {
                computedFromProps = makeDedupKey(type, roles, baseObserver, baseTime);
            } catch (e) {
                dbg.warn('makeDedupKey(props.roles) threw', { e });
            }

            dbg.log('dedup', {
                computedFromProps,
                savedHasComputedFromProps: savedKeys.includes(computedFromProps)
            });
        });

        initialRoles = { ...roles };
        initialTitle = title ?? '';

        draftTitle = title ?? '';
        if (multiTarget) {
            const t = roles.target;
            draftTargets = Array.isArray(t) ? (t as ObjId[]) : (t ? [t as ObjId] : []);
            draftRoles = { ...roles, target: draftTargets };
        } else {
            const t = roles.target;
            const one = Array.isArray(t) ? (t[0] ?? null) : (t ?? null);

            draftTargets = [];
            draftRoles = { ...roles, target: one };
        }

        const appliedKey = makeDedupKey(type, roles, baseObserver, baseTime);
        pickedSavedKey = savedList.some(w => w.dedupKey === appliedKey) ? appliedKey : '';

        dbg.group('WheelControl.openModal.afterDraftSet', () => {
            dbg.log('derived', {
                multiTarget,
                usedRoles,
                draftRoles,
                draftTargets,
                effectiveDraftRoles
            });

            let compat = false;
            let allOk = false;
            try { compat = isCompatible(spec, effectiveDraftRoles); } catch (e) { dbg.warn('isCompatible threw', { e }); }
            try { allOk = usedRoles.every(r => hasRoleValue(spec, r, (effectiveDraftRoles as any)[r])); } catch (e) { dbg.warn('hasRoleValue threw', { e }); }

            dbg.log('validity', { compat, allOk });

            const opts: Record<string, any> = {};
            for (const r of usedRoles) {
                try {
                    opts[r] = optionsForRole(spec, r, effectiveDraftRoles);
                } catch (e) {
                    opts[r] = { error: true };
                    dbg.warn('optionsForRole threw', { role: r, e });
                }
            }
            dbg.log('options', opts);

            let computedFromDraft = '';
            try { computedFromDraft = makeDedupKey(type, effectiveDraftRoles, baseObserver, baseTime); } catch {}
            dbg.log('draftDedupKey', { computedFromDraft });
        });

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
        pickedSavedKey = '';
    }

    function resetDraft() {
        dbg.log('WheelPicker.resetDraft', { type });

        draftTitle = initialTitle;
        if (multiTarget) {
            const t = initialRoles.target;
            draftTargets = Array.isArray(t) ? (t as ObjId[]) : (t ? [t as ObjId] : []);
            draftRoles = { ...initialRoles, target: draftTargets };
        } else {
            const t = initialRoles.target;
            const one = Array.isArray(t) ? (t[0] ?? null) : (t ?? null);

            draftTargets = [];
            draftRoles = { ...initialRoles, target: one };
        }

        const k = makeDedupKey(type, multiTarget ? { ...initialRoles, target: draftTargets } : initialRoles, baseObserver, baseTime);
        pickedSavedKey = savedList.some(w => w.dedupKey === k) ? k : '';
    }

    function setRole(role: RoleName, value: string) {
        const v = (value || '') as ObjId;
        if (role === 'target' && multiTarget) return;

        draftRoles = { ...draftRoles, [role]: (v ? v : null) };
        draftRoles = normalizeRolesForType(spec, draftRoles);

        if (multiTarget) {
            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: draftTargets });
            const t = normalized.target;
            draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
            draftRoles = { ...normalized, target: draftRoles.target };
        }

        pickedSavedKey = '';
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
            .filter(Boolean) as ObjId[];

        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
        draftRoles = { ...normalized, target: draftRoles.target };

        pickedSavedKey = '';
    }

    function updateExisting() {
        if (!canUpdate) return;

        const nextTitle = (draftTitle ?? '').trim();
        const nextRoles = effectiveDraftRoles;

        dbg.log('WheelPicker.update', { type, roles: nextRoles, title: nextTitle, baseId });

        // parent hook (UI title etc.)
        onApply({ roles: nextRoles, title: nextTitle });
        boardApi.updateWheelById(
            baseId,
            { wheelType: type, roles: nextRoles, title: nextTitle },
            'WheelPicker.update'
        );

        closeModal('update');
    }

    function createNew() {
        if (!canNew) return;

        const nextTitle = (draftTitle ?? '').trim() || formatWheelSpec(type, effectiveDraftRoles);
        const nextRoles = effectiveDraftRoles;

        dbg.log('WheelPicker.new', { type, roles: nextRoles, title: nextTitle });
        boardApi.addWheel(
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

    function bodyLabel(id: ObjId): string {
        const b = (objects as any)[id];
        return b?.name?.en ?? String(id);
    }

    let draftSpec = '';
    $: draftSpec = formatWheelSpec(type, effectiveDraftRoles);

    function handlePickSaved(e: Event) {
        const el = e.currentTarget as HTMLSelectElement | null;
        const k = el?.value ?? '';
        pickedSavedKey = k;

        if (!k) return;

        const w = savedList.find(x => x.dedupKey === k) ?? null;

        dbg.group('WheelPicker.pickSaved', () => {
            dbg.log('picked', { profileId: $activeProfile?.id, type, dedupKey: k, wheel: w?.title });
        });

        if (!w) return;

        draftTitle = w.title ?? '';
        const r = w.roles ?? {};

        draftRoles = { ...r };
        draftRoles = normalizeRolesForType(spec, draftRoles);

        if (multiTarget) {
            const t = (r as any).target;
            draftTargets = Array.isArray(t) ? (t as ObjId[]) : (t ? [t as ObjId] : []);

            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: draftTargets });
            const nt = normalized.target;
            draftTargets = Array.isArray(nt) ? (nt as ObjId[]) : [];
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

        const t = (draftTitle ?? '').trim() || formatWheelSpec(type, effectiveDraftRoles);

        const dedupKey = profilesApi.saveWheel({
            type,
            title: t,
            roles: effectiveDraftRoles,
            observer: baseObserver,
            time: baseTime
        });

        dbg.log('WheelPicker.saved', { dedupKey, title: t });
        pickedSavedKey = dedupKey || makeDedupKey(type, effectiveDraftRoles, baseObserver, baseTime);
    }

    function deleteCurrentConfig() {
        if (!currentSaved) return;

        profilesApi.deleteWheel(currentSaved.dedupKey);
        dbg.log('WheelPicker.deleted', { dedupKey: currentSaved.dedupKey });

        if (pickedSavedKey === currentSaved.dedupKey) pickedSavedKey = '';
    }

    function toggleFavCurrent() {
        if (!currentSaved) return;
        profilesApi.setWheelFavorite(currentSaved.dedupKey, !currentSaved.favorite);
        dbg.log('WheelPicker.favorite', { dedupKey: currentSaved.dedupKey, value: !currentSaved.favorite });
    }

    let __lastSig = '';
    $: if (open) {
        const sigObj = {
            type,
            multiTarget,
            roles,
            draftRoles,
            draftTargets,
            effectiveDraftRoles,
            usedRoles,
            draftCompatible,
            hasAllRolesOk,
            currentCfgKey,
            baseId,
            pickedSavedKey,
            savedMatch: savedList.some(w => w.dedupKey === currentCfgKey),
            canUpdate,
            canNew
        };
        const sig = JSON.stringify(sigObj);
        if (sig !== __lastSig) {
            __lastSig = sig;
            dbg.log('WheelControl.open.reactive', sigObj);
        }
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
                <div class="modalTitle">Wheel Control</div>
                <button class="x" type="button" aria-label="Close" on:click={() => closeModal('cancel')}>×</button>
            </header>

            <div class="modalBody">
                <div class="row">
                    <label class="lbl" for={idSaved}>Saved</label>

                    <div class="savedRow">
                        <select id={idSaved} class="sel" on:change={handlePickSaved} bind:value={pickedSavedKey}>
                            <option value="">—</option>
                            {#each savedList as w (w.dedupKey)}
                                <option value={w.dedupKey}>
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
                    <label class="lbl" for={idSpec}>Spec</label>
                    <div id={idSpec} class="specPreview">{draftSpec}</div>
                </div>

                <div class="row">
                    <label class="lbl" for={idName}>Name</label>
                    <input
                            id={idName}
                            class="inp"
                            type="text"
                            placeholder={formatWheelSpec(type, effectiveDraftRoles)}
                            bind:value={draftTitle}
                    />
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
        font-size: 16px;
        border-top: 1px solid var(--btn-border);
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

    .inp, .sel { width: 100%; box-sizing: border-box; }

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
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        opacity: 0.9;

        padding: 8px 0;
        min-height: 22px;

        color: color-mix(in oklab, var(--fg), transparent 15%);
    }

    .warn {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--accent-gold), transparent 55%);
        background: color-mix(in oklab, var(--accent-gold), transparent 88%);
        font-weight: 700;
        opacity: 0.9;
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

    .btn:disabled,
    .btn.primary:disabled,
    .btn.ghost:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
        filter: saturate(0.8);
    }
</style>
