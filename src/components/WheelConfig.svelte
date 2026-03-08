<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import type { ObjId, RoleName, WheelSpec, WheelType } from '../lib/catalog';
    import { objects, wheels } from '../lib/catalog';
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

    let effectiveDraftRoles: WheelRolesState = {};
    $: effectiveDraftRoles = multiTarget ? { ...draftRoles, target: draftTargets } : draftRoles;

    const uid = `wcfg_${Math.random().toString(36).slice(2)}`;
    const idSpec = `${uid}_spec`;
    const roleId = (r: string) => `${uid}_role_${r}`;

    let draftCompatible = false;
    let hasAllRolesOk = false;
    let isDirty = false;

    $: draftCompatible = isCompatible(spec, effectiveDraftRoles);
    $: hasAllRolesOk = usedRoles.every((r) => hasRoleValue(spec, r, effectiveDraftRoles[r]));
    $: isDirty = !shallowEqualRoles(roles, effectiveDraftRoles);

    $: canUpdate = !locked && hasAllRolesOk && draftCompatible && isDirty;
    $: canNew = !locked && hasAllRolesOk && draftCompatible;

    function openModal() {
        initialRoles = { ...roles };

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

    function bodyLabel(id: ObjId): string {
        const b = (objects as any)[id];
        return b?.name?.en ?? String(id);
    }

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
                        <div class="checks" role="group" aria-labelledby={`${roleId(r)}_label`}>
                            {#each optionsForRole(spec, r, effectiveDraftRoles) as id (id)}
                                {@const checked = r === 'target'
                                    ? (multiTarget ? draftTargets.includes(id) : effectiveDraftRoles.target === id)
                                    : effectiveDraftRoles[r] === id}
                                <label class="checkItem" class:checked={checked} class:readonly={locked}>
                                    <input
                                        class="checkInput"
                                        type="checkbox"
                                        checked={checked}
                                        disabled={locked}
                                        on:change={() => toggleRoleOption(r, id)}
                                    />
                                    <span class="checkBox" aria-hidden="true"></span>
                                    <span class="checkText">{bodyLabel(id)}</span>
                                </label>
                            {/each}
                        </div>
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
        font-size: 20px;
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

    .row.multiRow {
        align-items: start;
    }

    .lbl {
        font-size: 13px;
        font-weight: 800;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .checks {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        padding: 10px;
    }

    .checkItem {
        position: relative;
        display: grid;
        grid-template-columns: 16px 1fr;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--btn-border), transparent 25%);
        background: color-mix(in oklab, var(--btn-bg), transparent 18%);
        cursor: pointer;
    }

    .checkItem.readonly {
        cursor: default;
    }

    .checkItem.checked {
        border-color: color-mix(in oklab, var(--accent-live), transparent 35%);
        background: color-mix(in oklab, var(--accent-live), transparent 88%);
    }

    .checkInput {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .checkBox {
        width: 16px;
        height: 16px;
        border-radius: 5px;
        border: 1px solid color-mix(in oklab, var(--btn-border), var(--fg) 15%);
        background: color-mix(in oklab, var(--bg), white 6%);
        box-sizing: border-box;
        display: inline-block;
        position: relative;
    }

    .checkItem.checked .checkBox {
        border-color: color-mix(in oklab, var(--accent-live), transparent 20%);
        background: color-mix(in oklab, var(--accent-live), transparent 35%);
    }

    .checkItem.checked .checkBox::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 5px;
        height: 9px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(40deg);
    }

    .checkText {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
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
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
    }
</style>
