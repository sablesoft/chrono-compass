<script lang="ts">
    import { nanoid } from 'nanoid';
    import { tick } from 'svelte';
    import { formatSpokeCodeUi, type CycleInfoConfig, type InfoTagConfig, type InfoTemplate, type SpokeKey } from '../lib/wheel/types';

    type WheelInfoChip = {
        id: string;
        label: string;
        value?: string;
        modal?: string;
        kind?: string;
        dim?: boolean;
        templateId?: string;
    };

    type SpokeInfoRow = {
        code: SpokeKey;
        chips: WheelInfoChip[];
        ts?: number;
        isCurrent?: boolean;
        templateId?: string;
    };

    type TagDef = {
        id: string;
        label: string;
    };

    type GeneralDef = {
        id: string;
        label: string;
        value: string;
    };

    type TagRow = {
        id: string;
        systemLabel: string;
        value: string;
        tag?: InfoTagConfig;
        isCustom: boolean;
    };

    export let generalChips: WheelInfoChip[] = [];
    export let currentRow: SpokeInfoRow | null = null;
    export let spokeRows: SpokeInfoRow[] = [];
    export let referenceTs: number = Date.now();

    export let config: CycleInfoConfig;
    export let defaultConfig: CycleInfoConfig;

    export let spokeOptions: SpokeKey[] = [];
    export let tagDefs: TagDef[] = [];
    export let generalDefs: GeneralDef[] = [];
    export let currentValues: Record<string, string> = {};
    export let staticValues: Record<string, string> = {};

    export let onSpokeClick: (code: SpokeKey) => void = () => {};
    export let onGeneralReorder: (ids: string[]) => void = () => {};
    export let onTemplateReorder: (templateId: string, ids: string[]) => void = () => {};
    export let onConfigure: (next: CycleInfoConfig) => void = () => {};
    export let reorderEnabled = true;
    export let locked = false;
    export let canPlaceSide = false;
    export let layoutPosition: 'left' | 'right' | 'bottom' = 'bottom';
    export let onMoveLeft: () => void = () => {};
    export let onMoveRight: () => void = () => {};
    export let onMoveBottom: () => void = () => {};

    let dragChipId: string | null = null;
    let dragContext: string | null = null;
    let dragEditorRowId: string | null = null;
    let dragEditorTemplateId: string | null = null;

    let showEditButton = false;
    let showEditor = false;
    let touchMode = false;

    let draftConfig: CycleInfoConfig | null = null;
    let templateTabs: Record<string, 'spokes' | 'tags'> = {};
    let modalRowsOpen = new Set<string>();
    let openEditorSection: 'general' | 'dynamic' | 'static' | null = 'general';
    let openDynamicTemplateId: string | null = null;
    let openStaticTemplateId: string | null = null;
    let titleEditTemplateId: string | null = null;
    let titleEditValue = '';
    let titleEditOriginal = '';
    let titleEditInput: HTMLInputElement | null = null;

    let modalText: string | null = null;
    let modalTitle: string | null = null;

    function rowTimeClass(row: SpokeInfoRow | null | undefined): 'past' | 'future' | '' {
        if (!row) return '';
        if (!Number.isFinite(referenceTs) || !Number.isFinite(row.ts)) return '';
        return Number(row.ts) < referenceTs ? 'past' : 'future';
    }

    function cloneConfig(src: CycleInfoConfig): CycleInfoConfig {
        return {
            general: {
                enabled: src.general.enabled,
                tags: src.general.tags.map((t) => ({ ...t }))
            },
            templates: src.templates.map((tpl) => ({
                ...tpl,
                spokes: tpl.spokes.slice(),
                tags: tpl.tags.map((t) => ({ ...t }))
            }))
        };
    }

    function reorderIds(list: string[], fromId: string, toId: string): string[] {
        const from = list.indexOf(fromId);
        const to = list.indexOf(toId);
        if (from < 0 || to < 0 || from === to) return list;
        const next = list.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
    }

    function readChecked(e: Event): boolean {
        const target = e.currentTarget;
        return target instanceof HTMLInputElement ? target.checked : false;
    }

    function readValue(e: Event): string {
        const target = e.currentTarget;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
        return '';
    }

    function ensureTouchMode() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            touchMode = false;
            return;
        }
        touchMode = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    }

    function onBlockEnter() {
        if (!touchMode) showEditButton = true;
    }

    function onBlockLeave() {
        if (!touchMode) showEditButton = false;
    }

    function onBlockClick() {
        if (touchMode) showEditButton = !showEditButton;
    }

    function onBlockKeydown(e: KeyboardEvent) {
        if (!touchMode) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showEditButton = !showEditButton;
        }
    }

    function handleDragStart(e: DragEvent, context: string, id: string) {
        if (!reorderEnabled) return;
        dragChipId = id;
        dragContext = context;
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.effectAllowed = 'move';
        dt.setData('text/plain', id);
    }

    function handleDragEnd() {
        dragChipId = null;
        dragContext = null;
    }

    function handleDrop(e: DragEvent, context: string, targetId: string, ids: string[]) {
        e.preventDefault();
        if (!reorderEnabled || !dragChipId || dragContext !== context || dragChipId === targetId) {
            dragChipId = null;
            dragContext = null;
            return;
        }
        const next = reorderIds(ids, dragChipId, targetId);
        dragChipId = null;
        dragContext = null;
        if (context === 'general') onGeneralReorder(next);
        else onTemplateReorder(context, next);
    }

    function normalizeTagsByEnabled(tags: InfoTagConfig[]): InfoTagConfig[] {
        const enabled = tags.filter((t) => t.enabled !== false);
        const disabled = tags.filter((t) => t.enabled === false);
        return [...enabled, ...disabled];
    }

    function reorderTemplateDraftTags(templateId: string, fromId: string, toId: string) {
        if (!draftConfig || fromId === toId) return;
        draftConfig = {
            ...draftConfig,
            templates: draftConfig.templates.map((tpl) => {
                if (tpl.id !== templateId) return tpl;
                const ids = tpl.tags.map((t) => t.id);
                const nextIds = reorderIds(ids, fromId, toId);
                const map = new Map(tpl.tags.map((t) => [t.id, t]));
                const reordered = nextIds.map((id) => map.get(id)).filter((x): x is InfoTagConfig => !!x);
                return { ...tpl, tags: normalizeTagsByEnabled(reordered) };
            })
        };
    }

    function handleEditorRowDragStart(e: DragEvent, templateId: string, rowId: string) {
        dragEditorTemplateId = templateId;
        dragEditorRowId = rowId;
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.effectAllowed = 'move';
        dt.setData('text/plain', `${templateId}:${rowId}`);
    }

    function handleEditorRowDrop(e: DragEvent, templateId: string, targetRowId: string) {
        e.preventDefault();
        if (!dragEditorTemplateId || !dragEditorRowId) return;
        if (dragEditorTemplateId !== templateId) return;
        reorderTemplateDraftTags(templateId, dragEditorRowId, targetRowId);
        dragEditorTemplateId = null;
        dragEditorRowId = null;
    }

    function handleEditorRowDragEnd() {
        dragEditorTemplateId = null;
        dragEditorRowId = null;
    }

    function openEditor() {
        if (locked) return;
        draftConfig = cloneConfig(config);
        const tabs: Record<string, 'spokes' | 'tags'> = {};
        for (const tpl of config.templates) tabs[tpl.id] = templateTabs[tpl.id] ?? 'tags';
        templateTabs = tabs;
        openEditorSection = 'general';
        openDynamicTemplateId = config.templates.find((t) => t.dynamic)?.id ?? null;
        openStaticTemplateId = config.templates.find((t) => !t.dynamic)?.id ?? null;
        showEditor = true;
    }

    function closeEditor() {
        cancelTemplateTitleEdit();
        showEditor = false;
    }

    function setTemplateTab(id: string, tab: 'spokes' | 'tags') {
        templateTabs = { ...templateTabs, [id]: tab };
    }

    async function beginTemplateTitleEdit(tpl: InfoTemplate) {
        titleEditTemplateId = tpl.id;
        const base = String(tpl.title ?? '').trim() || 'Template';
        titleEditValue = base;
        titleEditOriginal = base;
        await tick();
        titleEditInput?.focus();
        titleEditInput?.select();
    }

    function cancelTemplateTitleEdit() {
        titleEditTemplateId = null;
        titleEditValue = '';
        titleEditOriginal = '';
        titleEditInput = null;
    }

    function applyTemplateTitleEdit() {
        if (!draftConfig || !titleEditTemplateId) return;
        const next = titleEditValue.trim() || titleEditOriginal.trim() || 'Template';
        updateTemplate(titleEditTemplateId, { title: next });
        cancelTemplateTitleEdit();
    }

    function handleTemplateTitleInput(e: Event) {
        titleEditValue = readValue(e);
    }

    function handleTemplateTitleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyTemplateTitleEdit();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelTemplateTitleEdit();
        }
    }

    function toggleModalRow(id: string) {
        const next = new Set(modalRowsOpen);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        modalRowsOpen = next;
    }

    function isTagEnabled(tag: InfoTagConfig | undefined): boolean {
        return tag ? tag.enabled !== false : true;
    }

    function generalRows(cfg: CycleInfoConfig | null): TagRow[] {
        if (!cfg) return [];
        const sys = new Map(generalDefs.map((d) => [d.id, d]));
        const rows: TagRow[] = generalDefs.map((d) => ({
            id: d.id,
            systemLabel: d.label,
            value: d.value,
            tag: cfg.general.tags.find((t) => t.id === d.id),
            isCustom: false
        }));
        for (const t of cfg.general.tags) {
            if (sys.has(t.id) && !t.isCustom) continue;
            rows.push({
                id: t.id,
                systemLabel: t.label?.trim() || 'Custom tag',
                value: '—',
                tag: t,
                isCustom: true
            });
        }
        return rows;
    }

    function templateRows(tpl: InfoTemplate, values: Record<string, string>): TagRow[] {
        const sys = new Map(tagDefs.map((d) => [d.id, d]));
        const tagsOrdered = normalizeTagsByEnabled(tpl.tags.slice());
        const ids = tagsOrdered.map((t) => t.id);
        for (const d of tagDefs) {
            if (!ids.includes(d.id)) ids.push(d.id);
        }
        const rows: TagRow[] = ids.map((id) => {
            const t = tagsOrdered.find((x) => x.id === id);
            const d = sys.get(id);
            const isCustom = !!t?.isCustom || !d;
            return {
                id,
                systemLabel: d?.label ?? (t?.label?.trim() || 'Custom tag'),
                value: values[id] ?? '—',
                tag: t,
                isCustom
            };
        });
        return rows;
    }

    function updateGeneralTag(id: string, patch: Partial<InfoTagConfig>) {
        if (!draftConfig) return;
        const idx = draftConfig.general.tags.findIndex((t) => t.id === id);
        const next = draftConfig.general.tags.slice();
        if (idx >= 0) next[idx] = { ...next[idx], ...patch };
        else next.push({ id, enabled: true, ...patch });
        draftConfig = { ...draftConfig, general: { ...draftConfig.general, tags: next } };
    }

    function removeGeneralCustomTag(id: string) {
        if (!draftConfig) return;
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags: draftConfig.general.tags.filter((t) => t.id !== id)
            }
        };
    }

    function addGeneralCustomTag() {
        if (!draftConfig) return;
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags: [...draftConfig.general.tags, { id: `custom:${nanoid(8)}`, label: 'Custom tag', enabled: true, isCustom: true }]
            }
        };
    }

    function updateTemplate(templateId: string, patch: Partial<InfoTemplate>) {
        if (!draftConfig) return;
        draftConfig = {
            ...draftConfig,
            templates: draftConfig.templates.map((tpl) => tpl.id === templateId ? { ...tpl, ...patch } : tpl)
        };
    }

    function setTemplateSpokesUnique(templateId: string, nextSpokes: SpokeKey[]) {
        if (!draftConfig) return;
        const target = draftConfig.templates.find((t) => t.id === templateId);
        if (!target) return;

        const templates = draftConfig.templates.map((tpl) => {
            if (tpl.id === templateId) return { ...tpl, spokes: nextSpokes.slice() };
            if (!target.enabled || !tpl.enabled || tpl.dynamic !== target.dynamic) return tpl;
            return { ...tpl, spokes: tpl.spokes.filter((code) => !nextSpokes.includes(code)) };
        });

        draftConfig = { ...draftConfig, templates };
    }

    function toggleTemplateSpoke(templateId: string, code: SpokeKey) {
        if (!draftConfig) return;
        const target = draftConfig.templates.find((t) => t.id === templateId);
        if (!target) return;
        const set = new Set(target.spokes);
        if (set.has(code)) set.delete(code);
        else set.add(code);
        setTemplateSpokesUnique(templateId, Array.from(set));
    }

    function toggleAllTemplateSpokes(templateId: string) {
        if (!draftConfig) return;
        const target = draftConfig.templates.find((t) => t.id === templateId);
        if (!target) return;
        if (target.spokes.length === spokeOptions.length) setTemplateSpokesUnique(templateId, []);
        else setTemplateSpokesUnique(templateId, spokeOptions.slice());
    }

    function updateTemplateTag(templateId: string, tagId: string, patch: Partial<InfoTagConfig>) {
        if (!draftConfig) return;
        const hasEnabledPatch = Object.prototype.hasOwnProperty.call(patch, 'enabled');
        draftConfig = {
            ...draftConfig,
            templates: draftConfig.templates.map((tpl) => {
                if (tpl.id !== templateId) return tpl;
                const idx = tpl.tags.findIndex((t) => t.id === tagId);
                const tags = tpl.tags.slice();
                const current = idx >= 0 ? tags[idx] : { id: tagId, enabled: true };
                const nextItem: InfoTagConfig = { ...current, ...patch };

                if (idx >= 0) tags.splice(idx, 1);
                tags.push(nextItem);

                if (hasEnabledPatch) {
                    const enabled = nextItem.enabled !== false;
                    const moved = tags.pop();
                    if (moved) {
                        if (enabled) {
                            const firstDisabled = tags.findIndex((t) => t.enabled === false);
                            const at = firstDisabled >= 0 ? firstDisabled : tags.length;
                            tags.splice(at, 0, moved);
                        } else {
                            const firstDisabled = tags.findIndex((t) => t.enabled === false);
                            const at = firstDisabled >= 0 ? firstDisabled : tags.length;
                            tags.splice(at, 0, moved);
                        }
                    }
                }

                return { ...tpl, tags: normalizeTagsByEnabled(tags) };
            })
        };
    }

    function removeTemplateCustomTag(templateId: string, tagId: string) {
        if (!draftConfig) return;
        draftConfig = {
            ...draftConfig,
            templates: draftConfig.templates.map((tpl) =>
                tpl.id === templateId ? { ...tpl, tags: tpl.tags.filter((t) => t.id !== tagId) } : tpl
            )
        };
    }

    function addTemplate(dynamic: boolean) {
        if (!draftConfig) return;
        const id = `tpl:${dynamic ? 'dynamic' : 'static'}:${nanoid(6)}`;
        const next: InfoTemplate = {
            id,
            title: dynamic ? 'Dynamic template' : 'Static template',
            enabled: true,
            dynamic,
            spokes: dynamic ? spokeOptions.slice() : [],
            tags: normalizeTagsByEnabled(tagDefs.map((d) => ({ id: d.id, enabled: true })))
        };
        draftConfig = { ...draftConfig, templates: [...draftConfig.templates, next] };
        templateTabs = { ...templateTabs, [id]: 'tags' };
    }

    function removeTemplate(templateId: string) {
        if (!draftConfig) return;
        if (titleEditTemplateId === templateId) cancelTemplateTitleEdit();
        draftConfig = {
            ...draftConfig,
            templates: draftConfig.templates.filter((tpl) => tpl.id !== templateId)
        };
    }

    function addTemplateCustomTag(templateId: string) {
        updateTemplateTag(templateId, `custom:${nanoid(8)}`, { label: 'Custom tag', enabled: true, isCustom: true });
    }

    function applyEditor() {
        if (locked) return;
        if (!draftConfig) return;
        cancelTemplateTitleEdit();
        onConfigure(draftConfig);
        showEditor = false;
    }

    function resetToDefaults() {
        if (locked) return;
        cancelTemplateTitleEdit();
        onConfigure(defaultConfig);
        showEditor = false;
    }

    function toggleEditorSection(id: 'general' | 'dynamic' | 'static') {
        openEditorSection = openEditorSection === id ? null : id;
    }

    function toggleTemplatePanel(dynamic: boolean, templateId: string) {
        if (dynamic) openDynamicTemplateId = openDynamicTemplateId === templateId ? null : templateId;
        else openStaticTemplateId = openStaticTemplateId === templateId ? null : templateId;
    }

    function handleTemplateHeadKeydown(e: KeyboardEvent, dynamic: boolean, templateId: string) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTemplatePanel(dynamic, templateId);
        }
    }

    $: if (titleEditTemplateId && titleEditInput) {
        queueMicrotask(() => {
            titleEditInput?.focus();
            titleEditInput?.select();
        });
    }

    $: ensureTouchMode();
</script>

<div
    class="infoBlock"
    role="button"
    aria-label="Info chips block"
    tabindex="0"
    on:mouseenter={onBlockEnter}
    on:mouseleave={onBlockLeave}
    on:click={onBlockClick}
    on:keydown={onBlockKeydown}
>
    <div class="blockToolbar">
        <div class="layoutControls" aria-label="Info block position">
            <button
                type="button"
                class="navBtn layoutBtn"
                class:isActive={layoutPosition === 'left'}
                title={canPlaceSide ? 'Place info block on the left' : 'Left side is available only when visual is visible'}
                aria-label="Place info block on the left"
                on:click|stopPropagation={onMoveLeft}
                disabled={!canPlaceSide}
            >⇠</button>
            <button
                type="button"
                class="navBtn layoutBtn"
                class:isActive={layoutPosition === 'bottom'}
                title="Place info block under the visual"
                aria-label="Place info block under the visual"
                on:click|stopPropagation={onMoveBottom}
            >⇣</button>
            <button
                type="button"
                class="navBtn layoutBtn"
                class:isActive={layoutPosition === 'right'}
                title={canPlaceSide ? 'Place info block on the right' : 'Right side is available only when visual is visible'}
                aria-label="Place info block on the right"
                on:click|stopPropagation={onMoveRight}
                disabled={!canPlaceSide}
            >⇢</button>
        </div>

        {#if showEditButton && !locked}
            <button
                type="button"
                class="editBtn navBtn"
                title="Edit info block"
                aria-label="Edit info block"
                on:click|stopPropagation={openEditor}
            >✎</button>
        {/if}
    </div>

    {#if generalChips.length}
        <section class="infoSection">
            <div class="chipGrid">
                {#each generalChips as chip (chip.id)}
                    <div
                        class="chipWrap"
                        class:dragging={dragChipId === chip.id}
                        draggable={reorderEnabled}
                        role="listitem"
                        on:dragstart={(e) => handleDragStart(e, 'general', chip.id)}
                        on:dragend={handleDragEnd}
                        on:dragover|preventDefault
                        on:drop={(e) => handleDrop(e, 'general', chip.id, generalChips.map((x) => x.id))}
                    >
                        {#if chip.modal}
                            <button
                                type="button"
                                class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                                class:dim={chip.dim}
                                on:click|stopPropagation={() => { modalTitle = chip.label; modalText = chip.modal ?? null; }}
                            >
                                <span class="chipLine">
                                    <span class="chipLabel">{chip.label}</span>
                                    {#if chip.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{chip.value}</span>
                                    {/if}
                                </span>
                            </button>
                        {:else}
                            <span class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`} class:dim={chip.dim}>
                                <span class="chipLine">
                                    <span class="chipLabel">{chip.label}</span>
                                    {#if chip.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{chip.value}</span>
                                    {/if}
                                </span>
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    {#if generalChips.length && (currentRow || spokeRows.length)}
        <div class="chipSep" aria-hidden="true"></div>
    {/if}

    {#if currentRow}
        <section class="infoSection">
            <div class="spokeRow currentRow" class:time-surface-past={rowTimeClass(currentRow) === 'past'} class:time-surface-future={rowTimeClass(currentRow) === 'future'}>
                <button
                    type="button"
                    class="spokeCode"
                    class:time-tone-past={rowTimeClass(currentRow) === 'past'}
                    class:time-border-past={rowTimeClass(currentRow) === 'past'}
                    class:time-tone-future={rowTimeClass(currentRow) === 'future'}
                    class:time-border-future={rowTimeClass(currentRow) === 'future'}
                    on:click={() => onSpokeClick(currentRow.code)}
                >{formatSpokeCodeUi(currentRow.code)}</button>
                <div class="chipGrid">
                    {#each currentRow.chips as chip (chip.id)}
                        <div
                            class="chipWrap"
                            class:dragging={dragChipId === chip.id}
                            draggable={reorderEnabled && !!currentRow.templateId}
                            role="listitem"
                            on:dragstart={(e) => currentRow && currentRow.templateId && handleDragStart(e, currentRow.templateId, chip.id)}
                            on:dragend={handleDragEnd}
                            on:dragover|preventDefault
                            on:drop={(e) => currentRow && currentRow.templateId && handleDrop(e, currentRow.templateId, chip.id, currentRow.chips.map((x) => x.id))}
                        >
                            {#if chip.modal}
                                <button
                                    type="button"
                                    class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                                    class:dim={chip.dim}
                                    on:click|stopPropagation={() => { modalTitle = chip.label; modalText = chip.modal ?? null; }}
                                >
                                    <span class="chipLine">
                                        <span class="chipLabel">{chip.label}</span>
                                        {#if chip.value}
                                            <span class="chipDivider" aria-hidden="true"></span>
                                            <span class="chipValue">{chip.value}</span>
                                        {/if}
                                    </span>
                                </button>
                            {:else}
                                <span class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`} class:dim={chip.dim}>
                                    <span class="chipLine">
                                        <span class="chipLabel">{chip.label}</span>
                                        {#if chip.value}
                                            <span class="chipDivider" aria-hidden="true"></span>
                                            <span class="chipValue">{chip.value}</span>
                                        {/if}
                                    </span>
                                </span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        </section>
    {/if}

    {#if currentRow && spokeRows.length}
        <div class="chipSep" aria-hidden="true"></div>
    {/if}

    {#if spokeRows.length}
        <section class="infoSection">
            {#each spokeRows as row (row.code)}
                <div class="spokeRow" class:time-surface-past={rowTimeClass(row) === 'past'} class:time-surface-future={rowTimeClass(row) === 'future'}>
                    <button
                        type="button"
                        class="spokeCode"
                        class:time-tone-past={rowTimeClass(row) === 'past'}
                        class:time-border-past={rowTimeClass(row) === 'past'}
                        class:time-tone-future={rowTimeClass(row) === 'future'}
                        class:time-border-future={rowTimeClass(row) === 'future'}
                        on:click={() => onSpokeClick(row.code)}
                    >{formatSpokeCodeUi(row.code)}</button>
                    <div class="chipGrid">
                        {#each row.chips as chip (chip.id)}
                            <div
                                class="chipWrap"
                                class:dragging={dragChipId === chip.id}
                                draggable={reorderEnabled && !!row.templateId}
                                role="listitem"
                                on:dragstart={(e) => row.templateId && handleDragStart(e, row.templateId, chip.id)}
                                on:dragend={handleDragEnd}
                                on:dragover|preventDefault
                                on:drop={(e) => row.templateId && handleDrop(e, row.templateId, chip.id, row.chips.map((x) => x.id))}
                            >
                                {#if chip.modal}
                                    <button
                                        type="button"
                                        class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                                        class:dim={chip.dim}
                                        on:click|stopPropagation={() => { modalTitle = chip.label; modalText = chip.modal ?? null; }}
                                    >
                                        <span class="chipLine">
                                            <span class="chipLabel">{chip.label}</span>
                                            {#if chip.value}
                                                <span class="chipDivider" aria-hidden="true"></span>
                                                <span class="chipValue">{chip.value}</span>
                                            {/if}
                                        </span>
                                    </button>
                                {:else}
                                    <span class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`} class:dim={chip.dim}>
                                        <span class="chipLine">
                                            <span class="chipLabel">{chip.label}</span>
                                            {#if chip.value}
                                                <span class="chipDivider" aria-hidden="true"></span>
                                                <span class="chipValue">{chip.value}</span>
                                            {/if}
                                        </span>
                                    </span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </section>
    {/if}
</div>

{#if showEditor && draftConfig}
    <div class="editorOverlay" role="button" tabindex="0" aria-label="Close editor" on:click={closeEditor} on:keydown={(e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeEditor();
        }
    }}>
        <div class="editorModal" role="dialog" tabindex="-1" aria-modal="true" aria-label="Info block" on:click|stopPropagation on:keydown|stopPropagation>
            <header class="editorHead">
                <div class="editorTitle">Info block</div>
                <button type="button" class="navBtn" on:click={closeEditor}>×</button>
            </header>

            <div class="editorList">
                <section class="editorSection">
                    <div class="editorSectionHead">
                        <button type="button" class="editorSectionToggle" aria-expanded={openEditorSection === 'general'} on:click={() => toggleEditorSection('general')}>
                            <span class="editorSectionTitle">General</span>
                            <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'general' ? '▾' : '▸'}</span>
                        </button>
                        <div class="editorHeadActions">
                            <button type="button" class="toggleBtn" on:click|stopPropagation={() => draftConfig && (draftConfig = { ...draftConfig, general: { ...draftConfig.general, enabled: !draftConfig.general.enabled } })}>
                                {draftConfig.general.enabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>
                    {#if openEditorSection === 'general'}
                    <div class="editorSectionActions">
                        <button type="button" class="toggleBtn" on:click={addGeneralCustomTag}>+ Tag</button>
                    </div>
                    {#if generalRows(draftConfig).length === 0}
                        <div class="editorEmpty">No general tags.</div>
                    {/if}
                    {#each generalRows(draftConfig) as row (row.id)}
                        {@const rowKey = `general:${row.id}`}
                        <div class="editorRowWrap">
                            <div class="editorRow">
                                <div class="col sys">{row.systemLabel}</div>
                                <input class="col user" type="text" placeholder="Custom label" value={row.tag?.label ?? ''} on:input={(e) => updateGeneralTag(row.id, { label: readValue(e) })} />
                                <div class="col val">{row.value}</div>
                                <label class="stateToggle" title={isTagEnabled(row.tag) ? 'Hide tag' : 'Show tag'}>
                                    <input type="checkbox" checked={isTagEnabled(row.tag)} on:change={(e) => updateGeneralTag(row.id, { enabled: readChecked(e) })} />
                                    <span class="stateTrack" aria-hidden="true"><span class="stateThumb"></span></span>
                                    <span class="stateText">{isTagEnabled(row.tag) ? 'On' : 'Off'}</span>
                                </label>
                                <div class="rowActions">
                                    <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                    {#if row.isCustom}
                                        <button type="button" class="miniBtn dangerBtn" on:click={() => removeGeneralCustomTag(row.id)}>×</button>
                                    {/if}
                                </div>
                            </div>
                            {#if modalRowsOpen.has(rowKey)}
                                <div class="modalAccordion">
                                    <textarea class="modalInput" placeholder="Modal text" value={row.tag?.modal ?? ''} on:input={(e) => updateGeneralTag(row.id, { modal: readValue(e) })}></textarea>
                                </div>
                            {/if}
                        </div>
                    {/each}
                    {/if}
                </section>

                <section class="editorSection">
                    <button type="button" class="editorSectionHead editorSectionToggle" aria-expanded={openEditorSection === 'dynamic'} on:click={() => toggleEditorSection('dynamic')}>
                        <span class="editorSectionTitle">Dynamic templates</span>
                        <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'dynamic' ? '▾' : '▸'}</span>
                    </button>
                    {#if openEditorSection === 'dynamic'}
                    <div class="editorSectionActions">
                        <button type="button" class="toggleBtn" on:click={() => addTemplate(true)}>Add template</button>
                    </div>
                    {#if draftConfig.templates.filter((t) => t.dynamic).length === 0}
                        <div class="editorEmpty">No dynamic templates.</div>
                    {/if}
                    {#each draftConfig.templates.filter((t) => t.dynamic) as tpl (tpl.id)}
                        <div class="templateBlock">
                            <div class="templateHead" data-template-title-editor={tpl.id} role="button" tabindex="0" aria-expanded={openDynamicTemplateId === tpl.id} on:click={() => toggleTemplatePanel(true, tpl.id)} on:keydown={(e) => handleTemplateHeadKeydown(e, true, tpl.id)}>
                                {#key `${tpl.id}:${titleEditTemplateId === tpl.id ? 'edit' : 'view'}`}
                                <div class="templateTitleGroup">
                                    {#if titleEditTemplateId === tpl.id}
                                        <input
                                            bind:this={titleEditInput}
                                            class="templateTitle"
                                            type="text"
                                            data-template-title-input="1"
                                            value={titleEditValue}
                                            on:input={handleTemplateTitleInput}
                                            on:keydown|stopPropagation={handleTemplateTitleKeydown}
                                            on:blur={cancelTemplateTitleEdit}
                                            on:click|stopPropagation
                                        />
                                    {:else}
                                        <div class="templateTitleText" title={tpl.title || 'Template'}>{tpl.title || 'Template'}</div>
                                    {/if}
                                    {#if titleEditTemplateId === tpl.id}
                                        <button type="button" class="toggleBtn iconBtn" data-template-title-accept="1" title="Apply title" on:pointerdown|preventDefault on:click|stopPropagation={applyTemplateTitleEdit}>✓</button>
                                    {:else}
                                        <button type="button" class="toggleBtn iconBtn" data-template-title-edit="1" title="Edit title" on:click|stopPropagation={() => beginTemplateTitleEdit(tpl)}>✎</button>
                                    {/if}
                                </div>
                                {/key}
                                <div class="templateActions">
                                    <button type="button" class="toggleBtn" on:click|stopPropagation={() => updateTemplate(tpl.id, { enabled: !tpl.enabled })}>{tpl.enabled ? 'On' : 'Off'}</button>
                                    <button type="button" class="toggleBtn" on:click|stopPropagation={() => removeTemplate(tpl.id)}>Remove</button>
                                </div>
                            </div>
                            {#if openDynamicTemplateId === tpl.id}
                            <div class="templateTabs">
                                <button type="button" class:active={(templateTabs[tpl.id] ?? 'tags') === 'spokes'} on:click={() => setTemplateTab(tpl.id, 'spokes')}>Spokes</button>
                                <button type="button" class:active={(templateTabs[tpl.id] ?? 'tags') === 'tags'} on:click={() => setTemplateTab(tpl.id, 'tags')}>Tags</button>
                            </div>
                            {#if (templateTabs[tpl.id] ?? 'tags') === 'spokes'}
                                <div class="spokePickGrid">
                                    <label class="spokePick" class:checked={tpl.spokes.length === spokeOptions.length}>
                                        <input class="spokePickInput" type="checkbox" checked={tpl.spokes.length === spokeOptions.length} on:change={() => toggleAllTemplateSpokes(tpl.id)} />
                                        <span class="spokePickBox" aria-hidden="true"></span>
                                        <span class="spokePickText">All</span>
                                    </label>
                                    {#each spokeOptions as code (code)}
                                        <label class="spokePick" class:checked={tpl.spokes.includes(code)}>
                                            <input class="spokePickInput" type="checkbox" checked={tpl.spokes.includes(code)} on:change={() => toggleTemplateSpoke(tpl.id, code)} />
                                            <span class="spokePickBox" aria-hidden="true"></span>
                                            <span class="spokePickText">{formatSpokeCodeUi(code)}</span>
                                        </label>
                                    {/each}
                                </div>
                            {:else}
                                <div class="templateTags">
                                    {#each templateRows(tpl, currentValues) as row (row.id)}
                                        {@const rowKey = `${tpl.id}:${row.id}`}
                                        <div class="editorRowWrap">
                                            <div
                                                class="editorRow"
                                                role="listitem"
                                                class:dragging={dragEditorTemplateId === tpl.id && dragEditorRowId === row.id}
                                                draggable="true"
                                                on:dragstart={(e) => handleEditorRowDragStart(e, tpl.id, row.id)}
                                                on:dragend={handleEditorRowDragEnd}
                                                on:dragover|preventDefault
                                                on:drop={(e) => handleEditorRowDrop(e, tpl.id, row.id)}
                                            >
                                                <div class="col sys">{row.systemLabel}</div>
                                                <input class="col user" type="text" placeholder="Custom label" value={row.tag?.label ?? ''} on:input={(e) => updateTemplateTag(tpl.id, row.id, { label: readValue(e) })} />
                                                <div class="col val">{row.value}</div>
                                                <label class="stateToggle" title={isTagEnabled(row.tag) ? 'Hide tag' : 'Show tag'}>
                                                    <input type="checkbox" checked={isTagEnabled(row.tag)} on:change={(e) => updateTemplateTag(tpl.id, row.id, { enabled: readChecked(e) })} />
                                                    <span class="stateTrack" aria-hidden="true"><span class="stateThumb"></span></span>
                                                    <span class="stateText">{isTagEnabled(row.tag) ? 'On' : 'Off'}</span>
                                                </label>
                                                <div class="rowActions">
                                                    <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                                </div>
                                            </div>
                                            {#if modalRowsOpen.has(rowKey)}
                                                <div class="modalAccordion">
                                                    <textarea class="modalInput" placeholder="Modal text" value={row.tag?.modal ?? ''} on:input={(e) => updateTemplateTag(tpl.id, row.id, { modal: readValue(e) })}></textarea>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                            {/if}
                        </div>
                    {/each}
                    {/if}
                </section>

                <section class="editorSection">
                    <button type="button" class="editorSectionHead editorSectionToggle" aria-expanded={openEditorSection === 'static'} on:click={() => toggleEditorSection('static')}>
                        <span class="editorSectionTitle">Static templates</span>
                        <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'static' ? '▾' : '▸'}</span>
                    </button>
                    {#if openEditorSection === 'static'}
                    <div class="editorSectionActions">
                        <button type="button" class="toggleBtn" on:click={() => addTemplate(false)}>Add template</button>
                    </div>
                    {#if draftConfig.templates.filter((t) => !t.dynamic).length === 0}
                        <div class="editorEmpty">No static templates.</div>
                    {/if}
                    {#each draftConfig.templates.filter((t) => !t.dynamic) as tpl (tpl.id)}
                        <div class="templateBlock">
                            <div class="templateHead" data-template-title-editor={tpl.id} role="button" tabindex="0" aria-expanded={openStaticTemplateId === tpl.id} on:click={() => toggleTemplatePanel(false, tpl.id)} on:keydown={(e) => handleTemplateHeadKeydown(e, false, tpl.id)}>
                                {#key `${tpl.id}:${titleEditTemplateId === tpl.id ? 'edit' : 'view'}`}
                                <div class="templateTitleGroup">
                                    {#if titleEditTemplateId === tpl.id}
                                        <input
                                            bind:this={titleEditInput}
                                            class="templateTitle"
                                            type="text"
                                            data-template-title-input="1"
                                            value={titleEditValue}
                                            on:input={handleTemplateTitleInput}
                                            on:keydown|stopPropagation={handleTemplateTitleKeydown}
                                            on:blur={cancelTemplateTitleEdit}
                                            on:click|stopPropagation
                                        />
                                    {:else}
                                        <div class="templateTitleText" title={tpl.title || 'Template'}>{tpl.title || 'Template'}</div>
                                    {/if}
                                    {#if titleEditTemplateId === tpl.id}
                                        <button type="button" class="toggleBtn iconBtn" data-template-title-accept="1" title="Apply title" on:pointerdown|preventDefault on:click|stopPropagation={applyTemplateTitleEdit}>✓</button>
                                    {:else}
                                        <button type="button" class="toggleBtn iconBtn" data-template-title-edit="1" title="Edit title" on:click|stopPropagation={() => beginTemplateTitleEdit(tpl)}>✎</button>
                                    {/if}
                                </div>
                                {/key}
                                <div class="templateActions">
                                    <button type="button" class="toggleBtn" on:click|stopPropagation={() => updateTemplate(tpl.id, { enabled: !tpl.enabled })}>{tpl.enabled ? 'On' : 'Off'}</button>
                                    <button type="button" class="toggleBtn" on:click|stopPropagation={() => removeTemplate(tpl.id)}>Remove</button>
                                </div>
                            </div>
                            {#if openStaticTemplateId === tpl.id}
                            <div class="templateTabs">
                                <div class="templateTabsLeft">
                                    <button type="button" class:active={(templateTabs[tpl.id] ?? 'tags') === 'spokes'} on:click={() => setTemplateTab(tpl.id, 'spokes')}>Spokes</button>
                                    <button type="button" class:active={(templateTabs[tpl.id] ?? 'tags') === 'tags'} on:click={() => setTemplateTab(tpl.id, 'tags')}>Tags</button>
                                </div>
                                <div class="templateTabsRight">
                                    <button type="button" class="toggleBtn" on:click={() => addTemplateCustomTag(tpl.id)}>+ Tag</button>
                                </div>
                            </div>
                            {#if (templateTabs[tpl.id] ?? 'tags') === 'spokes'}
                                <div class="spokePickGrid">
                                    <label class="spokePick" class:checked={tpl.spokes.length === spokeOptions.length}>
                                        <input class="spokePickInput" type="checkbox" checked={tpl.spokes.length === spokeOptions.length} on:change={() => toggleAllTemplateSpokes(tpl.id)} />
                                        <span class="spokePickBox" aria-hidden="true"></span>
                                        <span class="spokePickText">All</span>
                                    </label>
                                    {#each spokeOptions as code (code)}
                                        <label class="spokePick" class:checked={tpl.spokes.includes(code)}>
                                            <input class="spokePickInput" type="checkbox" checked={tpl.spokes.includes(code)} on:change={() => toggleTemplateSpoke(tpl.id, code)} />
                                            <span class="spokePickBox" aria-hidden="true"></span>
                                            <span class="spokePickText">{formatSpokeCodeUi(code)}</span>
                                        </label>
                                    {/each}
                                </div>
                            {:else}
                                <div class="templateTags">
                                    {#each templateRows(tpl, staticValues) as row (row.id)}
                                        {@const rowKey = `${tpl.id}:${row.id}`}
                                        <div class="editorRowWrap">
                                            <div
                                                class="editorRow"
                                                role="listitem"
                                                class:dragging={dragEditorTemplateId === tpl.id && dragEditorRowId === row.id}
                                                draggable="true"
                                                on:dragstart={(e) => handleEditorRowDragStart(e, tpl.id, row.id)}
                                                on:dragend={handleEditorRowDragEnd}
                                                on:dragover|preventDefault
                                                on:drop={(e) => handleEditorRowDrop(e, tpl.id, row.id)}
                                            >
                                                <div class="col sys">{row.systemLabel}</div>
                                                <input class="col user" type="text" placeholder="Custom label" value={row.tag?.label ?? ''} on:input={(e) => updateTemplateTag(tpl.id, row.id, { label: readValue(e) })} />
                                                <div class="col val">{row.value}</div>
                                                <label class="stateToggle" title={isTagEnabled(row.tag) ? 'Hide tag' : 'Show tag'}>
                                                    <input type="checkbox" checked={isTagEnabled(row.tag)} on:change={(e) => updateTemplateTag(tpl.id, row.id, { enabled: readChecked(e) })} />
                                                    <span class="stateTrack" aria-hidden="true"><span class="stateThumb"></span></span>
                                                    <span class="stateText">{isTagEnabled(row.tag) ? 'On' : 'Off'}</span>
                                                </label>
                                                <div class="rowActions">
                                                    <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                                    {#if row.isCustom}
                                                        <button type="button" class="miniBtn dangerBtn" on:click={() => removeTemplateCustomTag(tpl.id, row.id)}>×</button>
                                                    {/if}
                                                </div>
                                            </div>
                                            {#if modalRowsOpen.has(rowKey)}
                                                <div class="modalAccordion">
                                                    <textarea class="modalInput" placeholder="Modal text" value={row.tag?.modal ?? ''} on:input={(e) => updateTemplateTag(tpl.id, row.id, { modal: readValue(e) })}></textarea>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                            {/if}
                        </div>
                    {/each}
                    {/if}
                </section>
            </div>

            <footer class="editorFoot">
                <button type="button" class="navBtn" on:click={resetToDefaults}>Reset</button>
                <button type="button" class="navBtn" on:click={closeEditor}>Cancel</button>
                <button type="button" class="navBtn" on:click={applyEditor}>Apply</button>
            </footer>
        </div>
    </div>
{/if}

{#if modalText}
    <div class="editorOverlay" role="button" tabindex="0" aria-label="Close info modal" on:click={() => { modalText = null; modalTitle = null; }} on:keydown={(e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            modalText = null;
            modalTitle = null;
        }
    }}>
        <div class="editorModal" role="dialog" tabindex="-1" aria-modal="true" aria-label={modalTitle ?? 'Info'} on:click|stopPropagation on:keydown|stopPropagation>
            <header class="editorHead">
                <div class="editorTitle">{modalTitle ?? 'Info'}</div>
                <button type="button" class="navBtn" on:click={() => { modalText = null; modalTitle = null; }}>×</button>
            </header>
            <div class="modalBody">{modalText}</div>
        </div>
    </div>
{/if}

<style>
    .infoBlock {
        width: 100%;
        display: grid;
        gap: 8px;
        min-height: 0;
        height: 100%;
        overflow: auto;
        position: relative;
        align-content: start;
        align-items: start;
    }

    .blockToolbar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 4px;
        background: linear-gradient(
            to bottom,
            color-mix(in oklab, var(--panel), transparent 2%) 0%,
            color-mix(in oklab, var(--panel), transparent 10%) 78%,
            transparent 100%
        );
    }

    .layoutControls {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .layoutBtn {
        min-width: 34px;
        height: 28px;
        padding: 0 8px;
    }

    .layoutBtn.isActive {
        border-color: color-mix(in oklab, var(--accent-live), transparent 46%);
        background: color-mix(in oklab, var(--accent-live), transparent 84%);
    }

    .infoSection {
        display: grid;
        gap: 6px;
        align-content: start;
        align-items: start;
        align-self: start;
    }

    .editBtn {
        height: 28px;
        min-width: 34px;
        padding: 0 8px;
    }

    .chipGrid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 2px;
        align-content: flex-start;
        align-items: flex-start;
        align-self: start;
    }

    .chipSep {
        height: 1px;
        width: 100%;
        margin: 2px 0 6px;
        background: color-mix(in oklab, var(--fg), transparent 88%);
    }

    .spokeRow {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 10px;
        align-items: center;
    }

    .infoSection .spokeRow + .spokeRow {
        border-top: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        padding-top: 4px;
        margin-top: 2px;
    }

    .spokeRow.currentRow,
    .spokeRow.time-surface-past,
    .spokeRow.time-surface-future {
        border-radius: 10px;
        padding: 4px;
    }

    .spokeCode {
        height: 32px;
        min-width: 32px;
        width: max-content;
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: nowrap;
        border-radius: 999px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        background: color-mix(in oklab, var(--panel), transparent 20%);
        color: var(--fg);
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
    }

    .chipWrap {
        display: inline-flex;
        align-items: stretch;
        flex: 0 0 auto;
        width: fit-content;
        max-width: 100%;
        cursor: default;
    }

    .chipWrap.dragging {
        opacity: 0.55;
    }

    .chipStatic {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        border-color: color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }

    .chipButton {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        cursor: pointer;
        border-color: color-mix(in oklab, var(--accent-blue), transparent 70%);
        background: color-mix(in oklab, var(--accent-blue), transparent 91%);
    }

    .chipButton:hover:not(:disabled) {
        background: color-mix(in oklab, var(--accent-blue), transparent 86%);
        border-color: color-mix(in oklab, var(--accent-blue), transparent 58%);
    }

    .ui-tag {
        font-variant-numeric: tabular-nums;
        font-size: 12px;
        padding: 5px 10px;
    }

    .chipLine {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        max-width: 100%;
        font-size: 14px;
        font-weight: 700;
        opacity: 0.95;
    }

    .chipLabel {
        opacity: 0.85;
        font-weight: 700;
    }

    .chipDivider {
        width: 1px;
        height: 1.1em;
        background: color-mix(in oklab, var(--fg), transparent 84%);
    }

    .chipValue {
        opacity: 0.98;
        font-weight: 800;
    }

    .dim {
        opacity: 0.72;
    }

    .editorOverlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        background: rgba(0, 0, 0, 0.5);
        display: grid;
        place-items: center;
        padding: 12px;
    }

    .editorModal {
        width: min(760px, 94vw);
        max-height: min(86vh, 900px);
        overflow: auto;
        border-radius: 14px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--panel), black 6%);
        box-shadow: 0 16px 56px rgba(0, 0, 0, 0.4);
        display: grid;
        gap: 10px;
        padding: 10px;
    }

    .editorHead,
    .editorFoot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 14px;
    }

    .editorTitle {
        font-size: 16px;
        font-weight: 800;
    }

    .editorList {
        display: grid;
        gap: 10px;
    }

    .editorSection {
        display: grid;
        gap: 8px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        border-radius: 12px;
        padding: 10px;
    }

    .editorSectionHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .editorHeadActions {
        display: inline-flex;
        gap: 6px;
    }

    .editorSectionToggle {
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 0;
        cursor: pointer;
        text-align: left;
    }

    .editorSectionToggle:focus,
    .editorSectionToggle:focus-visible {
        outline: none;
        box-shadow: none;
    }

    .editorSectionTitle {
        font-size: 16px;
        font-weight: 800;
    }

    .editorSectionChevron {
        opacity: 0.75;
        font-size: 12px;
    }

    .editorSectionActions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
    }

    .editorEmpty {
        padding: 10px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
        opacity: 0.8;
        font-size: 12px;
    }

    .editorRow {
        display: grid;
        grid-template-columns: minmax(120px, 0.95fr) minmax(160px, 1.15fr) minmax(92px, 0.75fr) auto auto;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 9px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
        cursor: grab;
    }

    .editorRow.dragging {
        opacity: 0.55;
    }

    .editorRowWrap {
        display: grid;
        gap: 6px;
    }

    .col {
        min-width: 0;
        font-size: 12px;
    }

    .col.user,
    .templateTitle {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), transparent 12%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        border-radius: 8px;
        padding: 3px 6px;
        color: var(--fg);
    }

    .col.val {
        opacity: 0.8;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .stateToggle {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
    }

    .stateToggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .stateTrack {
        width: 30px;
        height: 17px;
        border-radius: 999px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 72%);
        background: color-mix(in oklab, var(--fg), transparent 90%);
        display: inline-flex;
        align-items: center;
        padding: 1px;
        box-sizing: border-box;
        transition: background 120ms ease, border-color 120ms ease;
    }

    .stateThumb {
        width: 13px;
        height: 13px;
        border-radius: 999px;
        background: color-mix(in oklab, var(--fg), transparent 18%);
        transition: transform 120ms ease, background 120ms ease;
    }

    .stateToggle input:checked + .stateTrack {
        border-color: color-mix(in oklab, var(--accent-live), transparent 40%);
        background: color-mix(in oklab, var(--accent-live), transparent 82%);
    }

    .stateToggle input:checked + .stateTrack .stateThumb {
        transform: translateX(12px);
        background: color-mix(in oklab, var(--accent-live), transparent 14%);
    }

    .stateText {
        font-size: 11px;
        font-weight: 700;
        opacity: 0.8;
        min-width: 20px;
    }

    .rowActions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .modalAccordion {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        border-radius: 9px;
        padding: 6px;
        background: color-mix(in oklab, var(--panel), transparent 4%);
    }

    .modalInput {
        width: 100%;
        box-sizing: border-box;
        min-height: 64px;
        resize: vertical;
        font-family: inherit;
        background: color-mix(in oklab, var(--panel), transparent 12%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        border-radius: 8px;
        padding: 6px 8px;
        color: var(--fg);
    }

    .toggleBtn,
    .miniBtn {
        height: 28px;
        min-width: 56px;
        padding: 0 11px;
        white-space: nowrap;
        border-radius: 999px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        background: color-mix(in oklab, var(--panel), transparent 12%);
        color: var(--fg);
        font-weight: 700;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
    }

    .miniBtn {
        min-width: 36px;
        padding: 0 9px;
    }

    .modalBtn {
        min-width: 30px;
    }

    .dangerBtn {
        color: color-mix(in oklab, var(--accent-red), var(--fg) 30%);
    }

    .templateBlock {
        display: grid;
        gap: 8px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 85%);
        border-radius: 12px;
        padding: 10px;
        background: color-mix(in oklab, var(--panel), transparent 4%);
    }

    .templateHead {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        padding-bottom: 10px;
    }

    .templateHead:focus,
    .templateHead:focus-visible {
        outline: none;
        box-shadow: none;
    }

    .templateTitleGroup {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .templateTitle {
        flex: 0 1 220px;
        max-width: 220px;
    }

    .templateTitleText {
        flex: 0 1 220px;
        max-width: 220px;
        min-height: 24px;
        display: inline-flex;
        align-items: center;
        padding: 0 2px;
        font-size: 13px;
        font-weight: 800;
        opacity: 0.95;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .templateActions {
        display: flex;
        gap: 6px;
        flex-wrap: nowrap;
        margin-left: auto;
    }

    .templateActions .toggleBtn {
        min-width: 64px;
        padding: 0 12px;
    }

    .iconBtn {
        min-width: 34px;
        padding: 0 8px;
        font-size: 13px;
    }

    .templateTabs {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
    }

    .templateTabsLeft {
        display: inline-flex;
        gap: 6px;
    }

    .templateTabsRight {
        margin-left: auto;
        display: inline-flex;
    }

    .templateTabs button {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--panel), transparent 8%);
        color: var(--fg);
        border-radius: 999px;
        min-height: 28px;
        min-width: 56px;
        padding: 0 11px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
    }

    .templateTabs button.active {
        background: color-mix(in oklab, var(--accent-live), transparent 85%);
        border-color: color-mix(in oklab, var(--accent-live), transparent 60%);
    }

    .spokePickGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
    }

    .spokePick {
        position: relative;
        display: grid;
        grid-template-columns: 16px 1fr;
        align-items: center;
        gap: 8px;
        padding: 7px 9px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--btn-border), transparent 25%);
        background: color-mix(in oklab, var(--btn-bg), transparent 18%);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    .spokePick:hover {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }

    .spokePick.checked {
        border-color: color-mix(in oklab, var(--accent-live), transparent 35%);
        background: color-mix(in oklab, var(--accent-live), transparent 88%);
    }

    .spokePickInput {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .spokePickBox {
        width: 16px;
        height: 16px;
        border-radius: 5px;
        border: 1px solid color-mix(in oklab, var(--btn-border), var(--fg) 15%);
        background: color-mix(in oklab, var(--bg), white 6%);
        box-sizing: border-box;
        display: inline-block;
        position: relative;
    }

    .spokePick.checked .spokePickBox {
        border-color: color-mix(in oklab, var(--accent-live), transparent 20%);
        background: color-mix(in oklab, var(--accent-live), transparent 35%);
    }

    .spokePick.checked .spokePickBox::after {
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

    .spokePickText {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
    }

    .templateTags {
        display: grid;
        gap: 8px;
        max-height: 360px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 2px;
    }

    .modalBody {
        white-space: pre-wrap;
        font-size: 15px;
        line-height: 1.4;
        padding: 6px 2px;
    }
</style>
