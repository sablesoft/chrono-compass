<!-- src/components/WheelControl.svelte -->
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

    export let type: WheelType;

    // applied values
    export let roles: WheelRolesState = {};
    export let title: string = '';

    // Svelte 5: callback props
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

    // modal focus
    let modalEl: HTMLDivElement | null = null;

    // modal state
    let open = false;

    let draftRoles: WheelRolesState = {};
    let draftTitle = '';

    let initialRoles: WheelRolesState = {};
    let initialTitle = '';

    // multi-target (compass)
    let multiTarget = false;
    $: multiTarget = isMultiTarget(spec);
    let draftTargets: BodyId[] = [];

    // derived “effective” draft roles (single source of truth)
    let effectiveDraftRoles: WheelRolesState = {};
    $: effectiveDraftRoles = multiTarget ?
        { ...draftRoles, target: draftTargets }
        : draftRoles;

    const uid = `wc_${Math.random().toString(36).slice(2)}`;
    const idName = `${uid}_name`;
    const idSpec = `${uid}_spec`;
    const roleId = (r: string) => `${uid}_role_${r}`;

    function openModal() {
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

        open = true;
        queueMicrotask(() => modalEl?.focus());
    }

    function closeModal(reason: 'cancel' | 'apply' = 'cancel') {
        open = false;
        if (reason === 'cancel') onCancel();
    }

    function clearDraft() {
        for (const r of usedRoles) {
            if (r === 'target' && multiTarget) continue;
            draftRoles[r] = null;
        }
        draftRoles = { ...draftRoles };
        if (multiTarget) draftTargets = [];
    }

    function resetDraft() {
        draftRoles = { ...initialRoles };
        draftTitle = initialTitle;

        if (multiTarget) {
            const t = initialRoles.target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : (t ? [t as BodyId] : []);
        } else {
            draftTargets = [];
        }
    }

    function setRole(role: RoleName, value: string) {
        const v = (value || '') as BodyId;

        // target в multi-режиме меняется ТОЛЬКО через draftTargets
        if (role === 'target' && multiTarget) return;

        draftRoles = { ...draftRoles, [role]: (v ? v : null) };
        draftRoles = normalizeRolesForType(spec, draftRoles);

        // после изменения looker/focus могли измениться допуски для target — подчистим draftTargets
        if (multiTarget) {
            const normalized = normalizeRolesForType(spec, { ...draftRoles, target: draftTargets });
            const t = normalized.target;
            draftTargets = Array.isArray(t) ? (t as BodyId[]) : [];
            // draftRoles оставляем без target — он придёт через effectiveDraftRoles
            draftRoles = { ...normalized, target: draftRoles.target };
        }
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

        // нормализуем (выкидываем недопустимое) и синкаем обратно в draftTargets
        const normalized = normalizeRolesForType(spec, { ...draftRoles, target: picked });
        const t = normalized.target;
        draftTargets = Array.isArray(t) ? (t as BodyId[]) : [];

        // draftRoles сохраняем (без попытки держать target тут “истиной”)
        draftRoles = { ...normalized, target: draftRoles.target };
    }

    // validity / apply
    let draftCompatible = false;
    let hasAllRolesOk = false;
    let isDirty = false;
    let canApply = false;

    $: draftCompatible = isCompatible(spec, effectiveDraftRoles);
    $: hasAllRolesOk = usedRoles.every(r => hasRoleValue(spec, r, effectiveDraftRoles[r]));
    $: isDirty = !shallowEqualRoles(roles, effectiveDraftRoles) || (title ?? '') !== (draftTitle ?? '');
    $: canApply = hasAllRolesOk && draftCompatible && isDirty;

    function apply() {
        if (!canApply) return;
        onApply({ roles: effectiveDraftRoles, title: (draftTitle ?? '').trim() });
        open = false;
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
</script>

<div class="left">
    <div class="title">{titleText}</div>

    <button type="button" class="wheelCodeBtn" on:click={openModal} title="Wheel control">
        {specText}
    </button>
</div>

{#if open}
    <div class="overlay" role="presentation" on:click={() => closeModal('cancel')}>
        <div
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-label="Wheel control"
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
                            <select
                                    id={roleId(r)}
                                    class="sel"
                                    on:change={(e) => handleRoleChange(r, e)}
                            >
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
                    <button type="button" class="btn primary" on:click={apply} disabled={!canApply}>Apply</button>
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
        width: min(560px, 96vw);
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

    /* ключ: правой колонке разрешаем реально ужиматься */
    .row > * { min-width: 0; }

    .lbl {
        font-size: 13px;
        font-weight: 800;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inp, .sel, .specPreview {
        width: 100%;
        box-sizing: border-box;
    }

    .inp, .sel {
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        padding: 10px 12px;
        font: inherit;
        outline: none;
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
</style>
