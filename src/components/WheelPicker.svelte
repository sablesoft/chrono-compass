<!-- src/components/WheelPicker.svelte -->
<script lang="ts">
    import {
        objectLabel,
        type ObjId,
        requiredRoles,
        type RoleName,
        type RoleSelects,
        type RoleValues,
        type WheelSpec,
        type WheelType
    } from '../lib/catalog';
    import { filteredRoles, wheels } from '../lib/catalog';
    import { useDocs } from '../lib/docs';
    import { currentLocationId, resolveLocationById, currentLocation } from '../lib/location/store';

    import { boardApi } from '../lib/board/store';
    import { makeDedupKey } from '../lib/profile/dedup';
    import { formatWheelSpec, typeLabel } from '../lib/wheel/control';
    import { debug } from '../lib/debug';

    // profiles (saved wheels)
    import { activeProfile } from '../lib/profile/store';
    import type { SavedWheel } from '../lib/profile/types';

    import { DEFAULT_LOCATION_ID, type Location } from '../lib/location/types';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import { DEFAULT_TIME } from '../lib/time/types';

    import LocationPicker from './LocationPicker.svelte';
    import DocsModal from "./DocsModal.svelte";

    const dbg = debug('wheel', '?');

    const ALL_TYPES = (Object.keys(wheels) as WheelType[])
        .filter((t) => wheels[t].ready === true);

    export let onUserActivity: () => void = () => {};

    // docs (per wheel type)
    const docs = useDocs(
        () => `concept/wheel.md`,
        {
            getTitle: () => 'Wheel',
            dbg,
            tag: () => 'concept'
        }
    );
    const docsState = docs.state;

    let open = false;
    const formId = `wheel-picker-${Math.random().toString(36).slice(2, 8)}`;

    let required: readonly RoleName[] = [];

    // type изначально пустой
    let type: WheelType | null = null;
    let spec: WheelSpec | null = null;

    // values
    let values: RoleValues = { looker: null, focus: null, target: [] };

    // selects
    let selects: RoleSelects = { looker: [], focus: [], target: [] };

    let multiTarget = false;

    // title
    let draftTitle = '';

    // time (no UI for now, but saved wheels may carry time)
    let timeDraft: WheelTimeState = { ...DEFAULT_TIME };

    // -------------------------
    // Saved wheels (from profile)
    // -------------------------
    let savedList: SavedWheel[] = [];
    $: {
        const list = ($activeProfile?.data?.wheels ?? []).slice();

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt - a.updatedAt);
        });

        savedList = list;
    }

    // UI select state (Saved)
    let pickedSavedId = ''; // this is SavedWheel.dedupKey

    function savedLabel(w: SavedWheel): string {
        const t = (w.type ?? '') as string;
        const title = (w.title ?? '').trim();
        const specText = (() => {
            try { return formatWheelSpec(w.type as any, w.roles as any); }
            catch { return t ? typeLabel(t) : '(unknown)'; }
        })();

        const head = w.favorite ? '★ ' : '';
        return head + (title.length ? title : specText);
    }

    function selectValue(e: Event): string {
        const t = e.currentTarget;
        return t instanceof HTMLSelectElement ? t.value : '';
    }

    function openForm() {
        onUserActivity();
        open = true;
        // ничего не выбираем за пользователя: может выбрать Saved сразу
    }

    function closeForm() {
        onUserActivity();
        open = false;
        resetAll();
    }

    function resetAll() {
        pickedSavedId = '';
        type = null;
        spec = null;
        values = { looker: null, focus: null, target: [] };
        selects = { looker: [], focus: [], target: [] };
        required = [];
        multiTarget = false;
        draftTitle = '';
        observerDraft = { locationId: DEFAULT_LOCATION_ID, locked: false };
        timeDraft = { ...DEFAULT_TIME };
        lastGlobalLocId = '';
    }

    function isWheelType(x: string): x is WheelType {
        return x in wheels;
    }

    function rebuild() {
        if (!spec) return;
        const out = filteredRoles(spec, values);
        dbg.log('rebuild', { out, spec, values });
        selects = out.selects;
        values = out.values;
    }

    function initForType(nextTypeRaw: string) {
        onUserActivity();

        const nextType = nextTypeRaw.trim();
        if (!nextType) return;
        if (!isWheelType(nextType)) return;

        // manual type change clears "picked saved"
        pickedSavedId = '';

        type = nextType;
        resetObserverDraftForType(type);
        timeDraft = { ...DEFAULT_TIME };

        spec = wheels[type];

        values = { looker: null, focus: null, target: [] };
        selects = { looker: [], focus: [], target: [] };
        draftTitle = '';

        required = requiredRoles(spec);
        multiTarget = (spec as any).multiTarget === true;

        rebuild();
    }

    function clearTypeSelection() {
        onUserActivity();
        pickedSavedId = '';
        type = null;
        spec = null;
        values = { looker: null, focus: null, target: [] };
        selects = { looker: [], focus: [], target: [] };
        required = [];
        multiTarget = false;
        draftTitle = '';
        resetObserverDraftForType(null);
        timeDraft = { ...DEFAULT_TIME };
    }

    function toggleTypeOption(nextType: WheelType) {
        if (type === nextType) {
            clearTypeSelection();
            return;
        }
        initForType(nextType);
    }

    function applySavedWheel(w: SavedWheel) {
        onUserActivity();

        const t = String(w.type ?? '');
        if (!t || !isWheelType(t)) {
            dbg.warn('WheelPicker.saved: unknown type', { t, w });
            return;
        }

        // set type/spec first
        type = t;
        spec = wheels[type];

        required = requiredRoles(spec);
        multiTarget = (spec as any).multiTarget === true;

        // observer/time come from saved wheel (so it's really “that preset”)
        observerDraft = w.observer ?? { locationId: DEFAULT_LOCATION_ID, locked: false };
        timeDraft = w.time ?? { ...DEFAULT_TIME };

        // title
        draftTitle = (w.title ?? '').trim() || '-';

        // roles -> RoleValues
        const r: any = w.roles ?? {};
        const looker = (r.looker ?? null) as ObjId | null;
        const focus = (r.focus ?? null) as ObjId | null;

        let targetArr: ObjId[] = [];
        const rt = r.target;

        if (multiTarget) {
            targetArr = Array.isArray(rt) ? (rt as ObjId[]).filter(Boolean) : (rt ? [rt as ObjId] : []);
        } else {
            // single target wheels: allow both array and scalar in saved data
            const one = Array.isArray(rt) ? (rt[0] ?? null) : (rt ?? null);
            targetArr = one ? [one as ObjId] : [];
        }

        values = { looker, focus, target: targetArr };
        selects = { looker: [], focus: [], target: [] };

        rebuild();
    }

    function handlePickSaved(e: Event) {
        const el = e.currentTarget as HTMLSelectElement | null;
        const dedupKey = el?.value ?? '';
        pickedSavedId = dedupKey;

        if (!dedupKey) return;

        const w = savedList.find(x => x.dedupKey === dedupKey) ?? null;
        dbg.group('WheelPicker.pickSaved', () => {
            dbg.log('picked', { profileId: $activeProfile?.id, dedupKey, type: w?.type, title: w?.title });
        });

        if (!w) return;
        applySavedWheel(w);
    }

    function resetRolesOnly() {
        onUserActivity();
        if (!spec || !type) return;

        values = { looker: null, focus: null, target: [] };
        draftTitle = '';
        pickedSavedId = '';

        // keep observer/time as-is (type-specific defaults already applied)
        selects = { looker: [], focus: [], target: [] };
        rebuild();
    }

    function setSingle(role: 'looker' | 'focus', vRaw: string) {
        onUserActivity();

        pickedSavedId = '';

        const v = vRaw || '';
        values = { ...values, [role]: v ? (v as any) : null };
        rebuild();
    }

    function toggleSingleRole(role: 'looker' | 'focus', id: ObjId) {
        const cur = values[role];
        setSingle(role, cur === id ? '' : id);
    }

    function setTargets(list: string[]) {
        onUserActivity();

        pickedSavedId = '';

        const next = list.filter(Boolean) as any;
        values = { ...values, target: next };
        rebuild();
    }

    function toggleTarget(id: ObjId) {
        const has = values.target.includes(id);
        const next = multiTarget
            ? (has ? values.target.filter((x) => x !== id) : [...values.target, id])
            : (has ? [] : [id]);
        setTargets(next);
    }

    function addWheel() {
        if (!spec || !type) return;
        if (!canAddNow) return;

        onUserActivity();

        // If there's a matching saved wheel (auto or picked) — use it as the source of truth
        const src = savedToApplyOnAdd;

        const finalType: WheelType = (src?.type ?? type) as WheelType;
        const finalRoles: any = (src?.roles ?? values) as any;

        const finalObserver: WheelObserverState = (src?.observer ?? observerDraft) as any;
        const finalTime: WheelTimeState = (src?.time ?? timeDraft) as any;

        // Title rules:
        // - If saved wheel matched: use its title (fallback '-')
        // - Else use draftTitle (fallback '-')
        const finalTitle =
            (src ? (src.title ?? '') : (draftTitle ?? '')).trim() || '-';

        dbg.log('WheelPicker.add', {
            finalType,
            finalRoles,
            finalTitle,
            fromSaved: !!src,
            savedKey: src?.dedupKey ?? null
        });

        boardApi.addWheel(
            {
                wheelType: finalType as any,
                roles: finalRoles,
                title: finalTitle,
                observer: finalObserver,
                time: finalTime
            },
            'WheelPicker.add'
        );

        open = false;
        resetAll();
    }

    function isTypingInControl(e: KeyboardEvent): boolean {
        const path = (typeof e.composedPath === 'function' ? e.composedPath() : []) as unknown[];

        const isControlEl = (x: unknown) =>
            x instanceof HTMLInputElement ||
            x instanceof HTMLTextAreaElement ||
            x instanceof HTMLSelectElement ||
            x instanceof HTMLButtonElement ||
            (x instanceof HTMLElement && x.isContentEditable);

        if (isControlEl(e.target)) return true;

        for (const node of path) {
            if (isControlEl(node)) return true;
        }

        return false;
    }

    function handlePanelKeydown(e: KeyboardEvent) {
        if (isTypingInControl(e)) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!open) openForm();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            if (open) closeForm();
        }
    }

    function handlePanelClick(e: MouseEvent) {
        if (open) return;
        const target = e.target;
        if (!(target instanceof Element)) {
            openForm();
            return;
        }
        if (target === e.currentTarget || !!target.closest('.plusWrap')) {
            openForm();
        }
    }

    $: hasAll =
        required.every((r) => r === 'target'
            ? values.target.length > 0
            : !!values[r]
        );

    $: rolesForDedup = {
        looker: values.looker,
        focus: values.focus,
        target: multiTarget ? values.target : (values.target[0] ?? null),
    };

    // -------------------------
    // observer draft (location UI only for compass/horizon)
    // -------------------------
    function resetObserverDraftForType(t: WheelType | null) {
        if (t === 'compass' || t === 'horizon') {
            observerDraft = { locationId: $currentLocationId || DEFAULT_LOCATION_ID, locked: false };
        } else {
            observerDraft = { locationId: DEFAULT_LOCATION_ID, locked: false };
        }
    }

    function setObserverLocation(loc: Location) {
        observerDraft = { locationId: loc.id, locked: true };
        pickedSavedId = '';
    }

    function setObserverLock(next: boolean) {
        observerDraft = { locationId: observerDraft.locationId, locked: next };
        pickedSavedId = '';
    }

    let observerDraft: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };
    let observerLoc: Location | null = null;
    let lastGlobalLocId = '';

    $: observerLoc = $currentLocation;

    $: {
        const g = ($currentLocationId || DEFAULT_LOCATION_ID);

        if (!lastGlobalLocId) lastGlobalLocId = g;

        const needsObserverUi = type === 'compass' || type === 'horizon';

        if (needsObserverUi) {
            if (!observerDraft.locked) {
                observerDraft = { locationId: g, locked: false };
            }
        } else {
            observerDraft = { locationId: DEFAULT_LOCATION_ID, locked: false };
        }

        lastGlobalLocId = g;
    }

    $: observerLoc =
        (type === 'compass' || type === 'horizon')
            ? resolveLocationById(observerDraft.locationId)
            : null;

    // -------------------------
    // dedupKey for “match saved preset” (NOT board)
    // -------------------------
    $: cfgDedupKey = (hasAll && type)
        ? makeDedupKey(type, rolesForDedup as any, observerDraft, timeDraft)
        : '';

    // best matching saved wheel for current config
    $: matchedSaved =
        cfgDedupKey
            ? (savedList.find(w => w.dedupKey === cfgDedupKey) ?? null)
            : null;

    // what to use on Add: explicit picked > auto matched
    $: pickedSaved =
        pickedSavedId
            ? (savedList.find(w => w.dedupKey === pickedSavedId) ?? null)
            : null;

    $: savedToApplyOnAdd = pickedSaved ?? matchedSaved;

    // Auto-highlight saved wheel in selector when current config matches a saved preset.
    // Don’t override a user-picked value; we only fill when empty.
    $: if (open && !pickedSavedId && cfgDedupKey && savedList.some(w => w.dedupKey === cfgDedupKey)) {
        pickedSavedId = cfgDedupKey;
    }

    $: canAddNow = !!type && hasAll;
</script>

<div class="panel addWheel"
     class:open={open}
     role="button"
     tabindex="0"
     aria-label="Add wheel"
     on:click={handlePanelClick}
     on:keydown={handlePanelKeydown}>
    {#if !open}
        <div class="plusWrap" aria-hidden="true">
            <div class="plusCircle">
                <span class="plus">+</span>
            </div>
        </div>
    {:else}
        <header class="top">
            <div class="left">
                <div class="title">Add Wheel</div>
                <div class="sub">Build a wheel and drop it onto the board</div>
            </div>

            <div class="right">
                <button type="button" class="navBtn" title="Docs" on:click={() => docs.openDocs()}>i</button>
                <button type="button" class="navBtn danger" title="Close" on:click|stopPropagation={closeForm}>×</button>
            </div>
        </header>

        <div class="form">
            <!-- Saved selector -->
            <div class="row">
                <label class="lbl" for={`${formId}-saved`}>Saved</label>
                <select
                        id={`${formId}-saved`}
                        class="sel"
                        bind:value={pickedSavedId}
                        on:change={handlePickSaved}
                        disabled={savedList.length === 0}
                >
                    <option value="">{savedList.length === 0 ? '— (empty)' : '—'}</option>
                    {#each savedList as w (w.dedupKey)}
                        <option value={w.dedupKey}>
                            {savedLabel(w)}
                        </option>
                    {/each}
                </select>
            </div>

            <!-- Type selector -->
            <div class="row multiRow">
                <div class="lbl" id={`${formId}-type-label`}>Type</div>
                <div class="checks" role="group" aria-labelledby={`${formId}-type-label`}>
                    {#each ALL_TYPES as t (t)}
                        {@const checked = type === t}
                        <label class="checkItem" class:checked={checked}>
                            <input
                                    class="checkInput"
                                    type="checkbox"
                                    checked={checked}
                                    on:change={() => toggleTypeOption(t)}
                            />
                            <span class="checkBox" aria-hidden="true"></span>
                            <span class="checkText">{typeLabel(t)}</span>
                        </label>
                    {/each}
                </div>
            </div>

            {#if type && spec}
                {#if type === 'compass' || type === 'horizon'}
                    <LocationPicker
                            value={observerLoc}
                            locked={observerDraft.locked}
                            onChange={(loc) => {
                            onUserActivity();
                            setObserverLocation(loc);
                        }}
                            onToggleLock={(next) => {
                            onUserActivity();
                            setObserverLock(next);
                        }}
                    />
                {/if}

                <div class="row">
                    <label class="lbl" for={`${formId}-name`}>Name</label>
                    <input
                            id={`${formId}-name`}
                            class="inp"
                            type="text"
                            placeholder="-"
                            bind:value={draftTitle}
                            on:input={() => { pickedSavedId = ''; }}
                    />
                </div>

                {#if selects.looker.length > 0}
                    <div class="row multiRow">
                        <div class="lbl" id={`${formId}-looker-label`}>looker</div>
                        <div class="checks" role="group" aria-labelledby={`${formId}-looker-label`}>
                            {#each selects.looker as id (id)}
                                {@const checked = values.looker === id}
                                <label class="checkItem" class:checked={checked}>
                                    <input
                                            class="checkInput"
                                            type="checkbox"
                                            checked={checked}
                                            on:change={() => toggleSingleRole('looker', id)}
                                    />
                                    <span class="checkBox" aria-hidden="true"></span>
                                    <span class="checkText">{objectLabel(id)}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if selects.focus.length > 0}
                    <div class="row multiRow">
                        <div class="lbl" id={`${formId}-focus-label`}>focus</div>
                        <div class="checks" role="group" aria-labelledby={`${formId}-focus-label`}>
                            {#each selects.focus as id (id)}
                                {@const checked = values.focus === id}
                                <label class="checkItem" class:checked={checked}>
                                    <input
                                            class="checkInput"
                                            type="checkbox"
                                            checked={checked}
                                            on:change={() => toggleSingleRole('focus', id)}
                                    />
                                    <span class="checkBox" aria-hidden="true"></span>
                                    <span class="checkText">{objectLabel(id)}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if selects.target.length > 0}
                    <div class="row" class:multiRow={multiTarget}>
                        <div class="lbl" id={`${formId}-target-label`}>target</div>
                        <div class="checks" role="group" aria-labelledby={`${formId}-target-label`}>
                            {#each selects.target as id (id)}
                                {@const checked = values.target.includes(id)}
                                <label class="checkItem" class:checked={checked}>
                                    <input
                                            class="checkInput"
                                            type="checkbox"
                                            checked={checked}
                                            on:change={() => toggleTarget(id)}
                                    />
                                    <span class="checkBox" aria-hidden="true"></span>
                                    <span class="checkText">{objectLabel(id)}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                {/if}

                <footer class="bottom">
                    <button type="button" class="btn ghost" on:click={closeForm}>Cancel</button>
                    <button
                            type="button"
                            class="btn ghost"
                            on:click={resetRolesOnly}
                            disabled={!type}
                            title="Reset roles (keep type)"
                    >
                        Reset
                    </button>
                    <button type="button" class="btn primary" on:click={addWheel} disabled={!canAddNow}>Add</button>
                </footer>
            {/if}
        </div>
    {/if}
</div>

<DocsModal
        open={$docsState.open}
        title={$docsState.title}
        md={$docsState.loading ? '# Loading…' : $docsState.md}
        url={$docsState.url}
        onClose={docs.closeDocs}
/>

<style>
    .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        padding: 14px;
        overflow: hidden;
        min-height: 220px;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }

    .panel:not(.open) {
        min-height: clamp(420px, 40vw, 620px);
        display: grid;
        place-items: center;
    }

    .panel.open {
        display: block;
        cursor: default;
    }

    .plusWrap {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
    }

    .plusCircle {
        width: 92px;
        height: 92px;
        border-radius: 999px;
        border: 2px dashed color-mix(in oklab, var(--fg), transparent 70%);
        display: grid;
        place-items: center;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
        background: color-mix(in oklab, var(--btn-bg), transparent 40%);
    }

    .panel:hover:not(.open) {
        transform: translateY(-2px);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
    }

    .panel:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 4px;
    }

    .panel:hover .plusCircle {
        transform: scale(1.03);
        border-color: color-mix(in oklab, var(--accent-gold), transparent 35%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 8%);
    }

    .plus {
        font-size: 56px;
        line-height: 1;
        font-weight: 900;
        opacity: 0.85;
        transform: translateY(-2px);
    }

    .top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        cursor: default;
    }

    .left { min-width: 0; }
    .title {
        font-size: 24px;
        font-weight: 650;
        opacity: 0.95;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .sub {
        margin-top: 6px;
        font-size: 14px;
        opacity: 0.65;
        font-weight: 650;
    }

    .right { display: flex; gap: 10px; align-items: center; }
    .form {
        display: grid;
        gap: 10px;
        cursor: default;
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

    .inp:focus-visible, .sel:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 2px;
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
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    .checkItem:hover {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
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

    .bottom {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 6px;
    }

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
    .btn:disabled { opacity: 0.45; cursor: default; transform: none; pointer-events: none; }

    .btn.primary {
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 25%);
    }
    .btn.ghost { opacity: 0.92; }
</style>
