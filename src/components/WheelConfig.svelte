<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { wheels } from '../lib/catalog';
    import type { ObjId, RoleName, WheelSpec, WheelType } from '../lib/catalog';
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
    import { boardApi } from '../lib/board/store';
    import type { BoardWheelView } from '../lib/board/types';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import RoleChecklist from './RoleChecklist.svelte';
    import { buildConstellationTargetGroups, type ConstellationTargetGroup } from '../lib/catalog/constellationGroups';

    export let type: WheelType;
    export let roles: WheelRolesState = {};
    export let title = '';

    export let baseId: string;
    export let baseObserver: WheelObserverState;
    export let baseTime: WheelTimeState;
    export let baseView: BoardWheelView | undefined = undefined;
    export let locked = false;

    export let onApply: (payload: { roles: WheelRolesState; title: string }) => void = () => {};
    export let onCancel: () => void = () => {};
    export let compact = false;

    let spec: WheelSpec;
    $: spec = wheels[type];

    let usedRoles: RoleName[] = [];
    $: usedRoles = rolesUsedBySpec(spec);

    let specText = '';
    let titleText = '';
    let titleButtonText = '';
    $: specText = formatWheelSpec(type, roles);
    $: titleText = title?.trim()?.length ? title.trim() : '';
    $: titleButtonText = (titleText && titleText !== '-' && titleText !== '—') ? titleText : specText;

    let modalEl: HTMLDivElement | null = null;
    let open = false;

    let draftRoles: WheelRolesState = {};
    let initialRoles: WheelRolesState = {};

    let multiTarget = false;
    $: multiTarget = isMultiTarget(spec);
    let draftTargets: ObjId[] = [];
    let targetAllChecked = false;
    let targetAllStarsChecked = false;
    let targetConstellationGroups: ConstellationTargetGroup[] = [];
    let roleOptionsMap: Partial<Record<RoleName, ObjId[]>> = {};
    let selectedValuesMap: Partial<Record<RoleName, ObjId[]>> = {};

    let effectiveDraftRoles: WheelRolesState = {};
    $: effectiveDraftRoles = multiTarget ? { ...draftRoles, target: draftTargets } : draftRoles;
    $: roleOptionsMap = {
        looker: optionsForRole(spec, 'looker', effectiveDraftRoles),
        focus: optionsForRole(spec, 'focus', effectiveDraftRoles),
        target: optionsForRole(spec, 'target', effectiveDraftRoles)
    };

    const uid = `wcfg_${Math.random().toString(36).slice(2)}`;
    const idSpec = `${uid}_spec`;
    const roleId = (r: string) => `${uid}_role_${r}`;
    const roleSearchId = (r: string) => `${uid}_role_search_${r}`;

    let draftCompatible = false;
    let hasAllRolesOk = false;
    let isDirty = false;
    let lookerSearch = '';
    let focusSearch = '';
    let targetSearch = '';

    $: draftCompatible = isCompatible(spec, effectiveDraftRoles);
    $: hasAllRolesOk = usedRoles.every((r) => hasRoleValue(spec, r, effectiveDraftRoles[r]));
    $: isDirty = !shallowEqualRoles(roles, effectiveDraftRoles);

    $: canUpdate = !locked && hasAllRolesOk && draftCompatible && isDirty;
    $: canNew = !locked && hasAllRolesOk && draftCompatible;

    function toSingleSelected(value: WheelRolesState[RoleName]): ObjId[] {
        return (typeof value === 'string' && value) ? [value] : [];
    }

    $: selectedValuesMap = {
        looker: toSingleSelected(effectiveDraftRoles.looker),
        focus: toSingleSelected(effectiveDraftRoles.focus),
        target: multiTarget ? draftTargets : toSingleSelected(effectiveDraftRoles.target)
    };

    function openModal() {
        initialRoles = { ...roles };
        lookerSearch = '';
        focusSearch = '';
        targetSearch = '';

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

        open = true;
        queueMicrotask(() => modalEl?.focus());
    }

    function closeModal(reason: 'cancel' | 'update' | 'new' = 'cancel') {
        open = false;
        lookerSearch = '';
        focusSearch = '';
        targetSearch = '';
        if (reason === 'cancel') onCancel();
    }

    function clearDraft() {
        if (locked) return;
        for (const r of usedRoles) {
            if (r === 'target' && multiTarget) continue;
            draftRoles[r] = null;
        }
        draftRoles = { ...draftRoles };
        if (multiTarget) draftTargets = [];
    }

    function resetDraft() {
        if (locked) return;
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
    }

    function setRole(role: RoleName, value: string) {
        if (locked) return;
        const v = (value || '') as ObjId;
        if (role === 'target' && multiTarget) return;

        const picked = (v ? v : null) as ObjId | null;
        const base = { ...draftRoles, [role]: picked };

        if (multiTarget) {
            let normalized = normalizeRolesForType(spec, { ...base, target: draftTargets });
            let t = normalized.target;
            let nextTargets = Array.isArray(t) ? (t as ObjId[]) : [];

            if (picked && normalized[role] !== picked) {
                normalized = normalizeRolesForType(spec, { ...base, target: [] });
                t = normalized.target;
                nextTargets = Array.isArray(t) ? (t as ObjId[]) : [];
            }

            draftTargets = nextTargets;
            draftRoles = { ...normalized, target: draftRoles.target };
        } else {
            draftRoles = normalizeRolesForType(spec, base);
        }
    }

    function toggleRoleOption(role: RoleName, id: ObjId) {
        if (locked) return;
        if (role === 'target') {
            toggleDraftTarget(id);
            return;
        }
        const cur = effectiveDraftRoles[role] as ObjId | null | undefined;
        setRole(role, cur === id ? '' : id);
    }

    function toggleDraftTarget(id: ObjId) {
        if (locked) return;
        if (multiTarget) {
            const has = draftTargets.includes(id);
            const picked = has ? draftTargets.filter((x) => x !== id) : [...draftTargets, id];

            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
            const t = normalized.target;
            draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
            draftRoles = { ...normalized, target: draftRoles.target };
            return;
        }

        const cur = draftRoles.target;
        const picked = cur === id ? null : id;
        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const one = Array.isArray(normalized.target) ? (normalized.target[0] ?? null) : (normalized.target ?? null);
        draftTargets = [];
        draftRoles = { ...normalized, target: one };
    }

    function toggleAllDraftTargets() {
        if (locked || !multiTarget) return;
        const all = roleOptionsMap.target ?? [];
        if (all.length === 0) return;
        const picked = targetAllChecked ? [] : all;
        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
        draftRoles = { ...normalized, target: draftRoles.target };
    }

    function toggleDraftTargetConstellationGroup(groupId: string) {
        if (locked || !multiTarget) return;
        const group = targetConstellationGroups.find((item) => item.id === groupId);
        if (!group || group.itemIds.length === 0) return;

        const allChecked = group.itemIds.every((id) => draftTargets.includes(id));
        const picked = allChecked
            ? draftTargets.filter((id) => !group.itemIds.includes(id))
            : Array.from(new Set([...draftTargets, ...group.itemIds]));

        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
        draftRoles = { ...normalized, target: draftRoles.target };
    }

    function toggleAllDraftTargetStars() {
        if (locked || !multiTarget) return;
        const starIds = Array.from(new Set(targetConstellationGroups.flatMap((group) => group.itemIds)));
        if (starIds.length === 0) return;

        const picked = targetAllStarsChecked
            ? draftTargets.filter((id) => !starIds.includes(id))
            : Array.from(new Set([...draftTargets, ...starIds]));

        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as ObjId[]) : [];
        draftRoles = { ...normalized, target: draftRoles.target };
    }

    function updateExisting() {
        if (locked) return;
        if (!canUpdate) return;

        onApply({ roles: effectiveDraftRoles, title: title ?? '' });
        boardApi.updateWheelById(
            baseId,
            { wheelType: type, roles: effectiveDraftRoles },
            'WheelConfig.update'
        );

        closeModal('update');
    }

    function createNew() {
        if (locked) return;
        if (!canNew) return;

        const nextTitle = formatWheelSpec(type, effectiveDraftRoles);
        boardApi.addWheel(
            { wheelType: type, roles: effectiveDraftRoles, title: nextTitle, observer: baseObserver, time: baseTime, view: baseView },
            'WheelConfig.new'
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
            closeModal('cancel');
        }
    }

    onMount(() => window.addEventListener('keydown', onKeyDown));
    onDestroy(() => window.removeEventListener('keydown', onKeyDown));

    $: targetAllChecked = (() => {
        if (!multiTarget) return false;
        const all = roleOptionsMap.target ?? [];
        if (all.length === 0) return false;
        if (draftTargets.length !== all.length) return false;
        return all.every((id) => draftTargets.includes(id));
    })();
    $: targetConstellationGroups = multiTarget
        ? buildConstellationTargetGroups(roleOptionsMap.target ?? [])
        : [];
    $: targetAllStarsChecked = (() => {
        if (!multiTarget) return false;
        const starIds = Array.from(new Set(targetConstellationGroups.flatMap((group) => group.itemIds)));
        if (starIds.length === 0) return false;
        return starIds.every((id) => draftTargets.includes(id));
    })();

    let draftSpec = '';
    $: draftSpec = formatWheelSpec(type, effectiveDraftRoles);
</script>

{#if compact}
    <button type="button" class="navBtn wheelConfigBtn" on:click={openModal} title={specText} aria-label="Wheel config">
        <span aria-hidden="true">◌</span>
    </button>
{:else}
    <div class="left">
        <button type="button" class="wheelTitleBtn" on:click={openModal} title="Wheel config">
            {titleButtonText}
        </button>
    </div>
{/if}

{#if open}
    <div
        class="overlay"
        role="button"
        tabindex="0"
        aria-label="Close wheel config"
        on:click={(e) => { if (e.target === e.currentTarget) closeModal('cancel'); }}
        on:keydown={onOverlayKeyDown}
    >
        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Wheel config"
            tabindex="-1"
            bind:this={modalEl}
        >
            <header class="modalTop">
                <div class="modalTitle">Wheel Config</div>
                <button class="x" type="button" aria-label="Close" on:click={() => closeModal('cancel')}>×</button>
            </header>

            <div class="modalBody">
                <div class="row">
                    <label class="lbl" for={idSpec}>Spec</label>
                    <div id={idSpec} class="specPreview">{draftSpec}</div>
                </div>

                {#each usedRoles as r (r)}
                    <div class="row" class:multiRow={r === 'target'}>
                        <div class="lbl" id={`${roleId(r)}_label`}>{r}</div>
                        {#if r === 'looker'}
                            <RoleChecklist
                                roleLabel={r}
                                groupLabelId={`${roleId(r)}_label`}
                                searchId={roleSearchId(r)}
                                searchPlaceholder={`Search ${r}`}
                                items={roleOptionsMap.looker ?? []}
                                selectedValues={selectedValuesMap.looker ?? []}
                                locked={locked}
                                maxHeight="120px"
                                bind:search={lookerSearch}
                                onToggleItem={(id) => toggleRoleOption(r, id)}
                            />
                        {:else if r === 'focus'}
                            <RoleChecklist
                                roleLabel={r}
                                groupLabelId={`${roleId(r)}_label`}
                                searchId={roleSearchId(r)}
                                searchPlaceholder={`Search ${r}`}
                                items={roleOptionsMap.focus ?? []}
                                selectedValues={selectedValuesMap.focus ?? []}
                                locked={locked}
                                maxHeight="120px"
                                bind:search={focusSearch}
                                onToggleItem={(id) => toggleRoleOption(r, id)}
                            />
                        {:else}
                            <RoleChecklist
                                roleLabel={r}
                                groupLabelId={`${roleId(r)}_label`}
                                searchId={roleSearchId(r)}
                                searchPlaceholder={`Search ${r}`}
                                items={roleOptionsMap.target ?? []}
                                selectedValues={selectedValuesMap.target ?? []}
                                locked={locked}
                                showAllOption={multiTarget}
                                allChecked={targetAllChecked}
                                showAllStarsOption={multiTarget}
                                allStarsChecked={targetAllStarsChecked}
                                groupOptions={targetConstellationGroups}
                                maxHeight="120px"
                                bind:search={targetSearch}
                                onToggleItem={(id) => toggleRoleOption(r, id)}
                                onToggleAll={toggleAllDraftTargets}
                                onToggleAllStars={toggleAllDraftTargetStars}
                                onToggleGroup={toggleDraftTargetConstellationGroup}
                            />
                        {/if}
                    </div>
                {/each}

                {#if !draftCompatible && hasAllRolesOk}
                    <div class="warn">⚠ This configuration is unavailable (catalog changed). Edit roles.</div>
                {/if}
            </div>

            <footer class="modalBottom">
                <div class="leftBtns">
                    <button type="button" class="btn ghost" on:click={clearDraft} disabled={locked}>Clear</button>
                    <button type="button" class="btn ghost" on:click={resetDraft} disabled={locked || !isDirty}>Reset</button>
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
    .wheelConfigBtn {
        display: inline-grid;
        place-items: center;
    }

    .left { display: grid; gap: 0; min-width: 0; }

    .wheelTitleBtn {
        display: inline-block;
        border: 0;
        background: transparent;
        padding: 0;
        text-align: left;
        font: inherit;
        color: inherit;
        cursor: pointer;
        opacity: 0.95;
        transition: opacity 120ms ease;
        font-size: var(--fs-20);
        font-weight: 650;
        line-height: 1.15;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .wheelTitleBtn:hover {
        opacity: 1;
    }

    .wheelTitleBtn:active { opacity: 1; }

    .wheelTitleBtn:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 3px;
        border-radius: var(--radius-8);
    }

    .overlay {
        position: fixed;
        inset: 0;
        background: color-mix(in oklab, black, transparent 55%);
        display: grid;
        place-items: center;
        z-index: 9999;
        padding: var(--sp-18);
    }

    .modal {
        width: min(620px, 96vw);
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: var(--radius-18);
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0,0,0,0.45);
    }

    .modalTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-14) var(--sp-14) var(--sp-10) var(--sp-14);
        border-bottom: 1px solid var(--btn-border);
    }

    .modalTitle {
        font-size: var(--fs-18);
        font-weight: 800;
        opacity: 0.92;
    }

    .x {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: var(--radius-10);
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-size: var(--fs-20);
        line-height: 1;
    }

    .modalBody {
        padding: var(--sp-14);
        display: grid;
        gap: var(--sp-10);
    }

    .row {
        display: grid;
        grid-template-columns: 90px 1fr;
        align-items: center;
        gap: var(--sp-10);
    }

    .row.multiRow {
        align-items: start;
    }

    .lbl {
        font-size: var(--fs-13);
        font-weight: 800;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .specPreview {
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        opacity: 0.9;
        padding: var(--sp-8) 0;
        min-height: 22px;
        color: color-mix(in oklab, var(--fg), transparent 15%);
    }

    .warn {
        padding: var(--sp-10) var(--sp-12);
        border-radius: var(--radius-12);
        border: 1px solid color-mix(in oklab, var(--accent-gold), transparent 55%);
        background: color-mix(in oklab, var(--accent-gold), transparent 88%);
        font-weight: 700;
        opacity: 0.9;
    }

    .modalBottom {
        display: flex;
        justify-content: space-between;
        gap: var(--sp-10);
        padding: var(--sp-12) var(--sp-14) var(--sp-14) var(--sp-14);
        border-top: 1px solid var(--btn-border);
    }

    .leftBtns, .rightBtns { display: flex; gap: var(--sp-10); }

    .btn {
        padding: var(--sp-8) var(--sp-12);
        border-radius: var(--radius-12);
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-weight: 800;
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
    }
</style>
