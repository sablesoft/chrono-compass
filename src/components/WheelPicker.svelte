<!-- src/components/WheelPicker.svelte -->
<script lang="ts">
    import { bodies, wheels, filteredRoles } from '../lib/catalog';
    import type { BodyId, WheelType, RoleName, WheelSpec, RoleSelects, RoleValues } from '../lib/catalog';

    import { boardApi } from '../lib/board/store';
    import { makeWheelId } from '../lib/wheel/id';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import { formatWheelSpec, typeLabel } from '../lib/wheel/control';
    import { debug } from '../lib/debug';

    // profiles (saved wheels)
    import { activeProfile } from '../lib/profile/store';
    import type { SavedWheel } from '../lib/profile/types';

    const dbg = debug('wheel', '?');

    const DEFAULT_LOCATION_ID = 'loc:system';
    const DEFAULT_OBSERVER: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };
    const DEFAULT_TIME: WheelTimeState = { live: true, locked: false };

    const ALL_TYPES = (Object.keys(wheels) as WheelType[])
        .filter((t) => wheels[t].ready === true);

    export let onUserActivity: () => void = () => {};

    let open = false;

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

    // -------------------------
    // Saved wheels (from profile)
    // -------------------------
    let savedList: SavedWheel[] = [];
    $: {
        const p = $activeProfile;
        const list = (p?.data?.wheels ?? []).slice();

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt - a.updatedAt);
        });

        savedList = list;
    }

    let pickedSavedId = '';

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

    function bodyLabel(id: BodyId): string {
        const b = (bodies as any)[id];
        return b?.name?.en ?? String(id);
    }

    function selectValue(e: Event): string {
        const t = e.currentTarget;
        return t instanceof HTMLSelectElement ? t.value : '';
    }

    function selectValues(e: Event): string[] {
        const t = e.currentTarget;
        if (!(t instanceof HTMLSelectElement)) return [];
        return Array.from(t.selectedOptions).map(o => o.value).filter(Boolean);
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
        spec = wheels[type];

        values = { looker: null, focus: null, target: [] };
        selects = { looker: [], focus: [], target: [] };
        draftTitle = '';

        required = spec.requiredRoles ?? [];
        multiTarget = (spec as any).multiTarget === true;

        rebuild();
    }

    function applySavedWheel(w: SavedWheel) {
        onUserActivity();

        const t = String(w.type ?? '');
        if (!t || !isWheelType(t)) {
            dbg.warn('WheelPicker.saved: unknown type', { t, w });
            return;
        }

        // set type/spec first (but do NOT wipe everything like initForType)
        type = t;
        spec = wheels[type];
        required = spec.requiredRoles ?? [];
        multiTarget = (spec as any).multiTarget === true;

        // title
        draftTitle = (w.title ?? '').trim();

        // roles -> RoleValues
        const r: any = w.roles ?? {};
        const looker = (r.looker ?? null) as BodyId | null;
        const focus = (r.focus ?? null) as BodyId | null;

        let targetArr: BodyId[] = [];
        const rt = r.target;

        if (multiTarget) {
            targetArr = Array.isArray(rt) ? (rt as BodyId[]).filter(Boolean) : (rt ? [rt as BodyId] : []);
        } else {
            // single target wheels: allow both array and scalar in saved data
            const one = Array.isArray(rt) ? (rt[0] ?? null) : (rt ?? null);
            targetArr = one ? [one as BodyId] : [];
        }

        values = { looker, focus, target: targetArr };
        selects = { looker: [], focus: [], target: [] };

        rebuild();
    }

    function handlePickSaved(e: Event) {
        const el = e.currentTarget as HTMLSelectElement | null;
        const id = el?.value ?? '';
        pickedSavedId = id;

        if (!id) return;

        const w = savedList.find(x => x.id === id) ?? null;
        dbg.group('WheelPicker.pickSaved', () => {
            dbg.log('picked', { profileId: $activeProfile?.id, id, type: w?.type, title: w?.title });
        });

        if (!w) return;

        applySavedWheel(w);
    }

    function resetRolesOnly() {
        onUserActivity();
        if (!spec || !type) return;

        // сброс значений ролей, но type/spec оставляем
        values = { looker: null, focus: null, target: [] };
        draftTitle = '';

        // clear saved pick because now it's not the same config anymore
        pickedSavedId = '';

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

    function setTargets(list: string[]) {
        onUserActivity();

        pickedSavedId = '';

        const next = list.filter(Boolean) as any;
        values = { ...values, target: next };
        rebuild();
    }

    function addWheel() {
        if (!spec || !type) return;

        onUserActivity();

        const nextTitle = (draftTitle ?? '').trim() || formatWheelSpec(type as any, values as any);

        boardApi.upsertWheel(
            { mode: 'upsertByKey' },
            {
                wheelType: type as any,
                roles: values as any,
                title: nextTitle,
                observer: DEFAULT_OBSERVER,
                time: DEFAULT_TIME
            },
            'WheelPicker.add'
        );

        open = false;
        resetAll();
    }

    $: hasAll =
        required.every((r) => r === 'target'
            ? values.target.length > 0
            : !!values[r]
        );

    $: rolesForId = {
        looker: values.looker,
        focus: values.focus,
        target: multiTarget ? values.target : (values.target[0] ?? null),
    };

    $: cfgId = hasAll && type ? makeWheelId(type, rolesForId, DEFAULT_OBSERVER, DEFAULT_TIME) : '';
    $: existsOnBoard = !!cfgId && boardApi.hasWheelId(cfgId);

    $: canAddNow = !!type && hasAll && !existsOnBoard;

    let titlePlaceholder = '';
    $: titlePlaceholder = type && spec
        ? formatWheelSpec(type, values as any)
        : '';
</script>

<section
        class="panel addWheel"
        class:open={open}
        role="button"
        tabindex="0"
        aria-label="Add wheel"
        on:click={() => { if (!open) openForm(); }}
        on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!open) openForm();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (open) closeForm();
        }
    }}
>
    {#if !open}
        <div class="plusWrap" aria-hidden="true">
            <div class="plusCircle">
                <span class="plus">+</span>
            </div>
        </div>
    {:else}
        <header class="top" on:click|stopPropagation>
            <div class="left">
                <div class="title">Add Wheel</div>
                <div class="sub">Build a wheel and drop it onto the board</div>
            </div>

            <div class="right">
                <button type="button" class="navBtn danger" title="Close" on:click|stopPropagation={closeForm}>×</button>
            </div>
        </header>

        <div class="form" on:click|stopPropagation>
            <!-- NEW: Saved selector (before Type) -->
            <div class="row">
                <label class="lbl">Saved</label>
                <select class="sel" bind:value={pickedSavedId} on:change={handlePickSaved} disabled={savedList.length === 0}>
                    <option value="">{savedList.length === 0 ? '— (empty)' : '—'}</option>
                    {#each savedList as w (w.id)}
                        <option value={w.id}>
                            {savedLabel(w)}
                        </option>
                    {/each}
                </select>
            </div>

            <!-- Type selector -->
            <div class="row">
                <label class="lbl">Type</label>
                <select class="sel" bind:value={type} on:change={(e) => initForType(selectValue(e))}>
                    <option value="">—</option>
                    {#each ALL_TYPES as t (t)}
                        <option value={t}>{typeLabel(t)}</option>
                    {/each}
                </select>
            </div>

            {#if type && spec}
                <div class="row">
                    <label class="lbl">Name</label>
                    <input
                            class="inp"
                            type="text"
                            placeholder={titlePlaceholder}
                            bind:value={draftTitle}
                            on:input={() => { pickedSavedId = ''; }}
                    />
                </div>

                {#if selects.looker.length > 0}
                    <div class="row">
                        <label class="lbl">looker</label>
                        <select
                                class="sel"
                                value={values.looker ?? ''}
                                disabled={selects.looker.length === 1}
                                on:change={(e) => setSingle('looker', selectValue(e))}
                        >
                            <option value="">—</option>
                            {#each selects.looker as id (id)}
                                <option value={id}>{bodyLabel(id)}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                {#if selects.focus.length > 0}
                    <div class="row">
                        <label class="lbl">focus</label>
                        <select
                                class="sel"
                                value={values.focus ?? ''}
                                disabled={selects.focus.length === 1}
                                on:change={(e) => setSingle('focus', selectValue(e))}
                        >
                            <option value="">—</option>
                            {#each selects.focus as id (id)}
                                <option value={id}>{bodyLabel(id)}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                {#if selects.target.length > 0}
                    <div class="row">
                        <label class="lbl">target</label>

                        {#if multiTarget}
                            <select
                                    class="sel selMulti"
                                    multiple
                                    on:change={(e) => setTargets(selectValues(e))}
                            >
                                {#each selects.target as id (id)}
                                    <option value={id} selected={values.target.includes(id)}>
                                        {bodyLabel(id)}
                                    </option>
                                {/each}
                            </select>
                        {:else}
                            <select
                                    class="sel"
                                    value={(values.target[0] ?? '')}
                                    disabled={selects.target.length === 1}
                                    on:change={(e) => setTargets([selectValue(e)])}
                            >
                                <option value="">—</option>
                                {#each selects.target as id (id)}
                                    <option value={id}>{bodyLabel(id)}</option>
                                {/each}
                            </select>
                        {/if}
                    </div>
                {/if}

                {#if existsOnBoard}
                    <div class="existsNote">⚠ This wheel already exists on board.</div>
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
</section>

<style>
    /* Match the same “card” silhouette as Wheel/Cycle/Compass */
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

    /* КОГДА ПИКЕР ЗАКРЫТ — делаем его “как карточка”, и центрируем плюс */
    .panel:not(.open) {
        min-height: clamp(420px, 40vw, 620px);
        display: grid;
        place-items: center;
    }

    /* КОГДА ОТКРЫТ — возвращаем нормальную “формовую” раскладку */
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

    .navBtn {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }
    .navBtn:hover:not(:disabled) {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .navBtn:disabled { opacity: 0.45; cursor: default; transform: none; }

    .navBtn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

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

    .selMulti {
        min-height: 120px;
        padding: 8px 10px;
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
