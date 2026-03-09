<script lang="ts">
    import type { ObjId } from '../lib/catalog';
    import type { CompassInfoConfig, CompassInfoTagConfig } from '../lib/wheel/types';
    import { formatDateTime } from '../lib/format';

    type CompassInfoChip = {
        id: string;
        label: string;
        value?: string;
        modal?: string;
    };

    type CompassDynamicRow = {
        id: ObjId;
        emoji: string;
        name: string;
        houseCode: string;
        houseLabel: string;
        pinned: boolean;
        items: CompassInfoChip[];
    };

    type CompassHouseDef = {
        id: string;
        code: string;
        label: string;
    };

    type CompassPinnedInfoRow = {
        id: string;
        bodyId: ObjId;
        emoji: string;
        name: string;
        description?: string;
        durationItem?: {
            id: string;
            label: string;
            value: string;
            modal?: string;
        };
        nodes: Array<{
            id: string;
            label: string;
            ts: number;
            code: string;
            source: 'regular' | 'compass' | 'horizon' | 'nodal' | 'synod' | 'bind';
            sourceWheel: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
            disabled?: boolean;
        }>;
    };

    type CompassTagDef = {
        id: string;
        label: string;
        scope: 'dynamic' | 'pinned';
        enabledByDefault: boolean;
        modal?: string;
        group?: 'general' | 'regular' | 'compass' | 'horizon' | 'nodal' | 'synod' | 'bind';
    };

    export let config: CompassInfoConfig;
    export let tagDefs: CompassTagDef[] = [];
    export let houseDefs: CompassHouseDef[] = [];
    export let generalChips: CompassInfoChip[] = [];
    export let dynamicRows: CompassDynamicRow[] = [];
    export let pinnedRows: CompassPinnedInfoRow[] = [];
    export let referenceTs: number = Date.now();

    export let onBodyPick: (bodyId: ObjId) => void = () => {};
    export let onPinnedPick: (ts: number, bodyId: ObjId, code?: string, sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal') => void = () => {};
    export let onConfigure: (next: CompassInfoConfig) => void = () => {};
    export let locked = false;

    let showEditor = false;
    let draftConfig: CompassInfoConfig | null = null;
    let openEditorSection: 'general' | 'houses' | 'dynamic' | 'pinned' | null = null;
    let modalRowsOpen = new Set<string>();
    let modalText: string | null = null;
    let modalTitle: string | null = null;

    function cloneConfig(src: CompassInfoConfig): CompassInfoConfig {
        return {
            general: {
                enabled: src.general.enabled,
                tags: src.general.tags.map((t) => ({ ...t }))
            },
            dynamic: {
                enabled: src.dynamic.enabled,
                tags: src.dynamic.tags.map((t) => ({ ...t }))
            },
            houses: {
                tags: src.houses.tags.map((t) => ({ ...t }))
            },
            pinned: {
                enabled: src.pinned.enabled,
                groups: { ...src.pinned.groups },
                tags: src.pinned.tags.map((t) => ({ ...t }))
            }
        };
    }

    function openEditor() {
        if (locked) return;
        draftConfig = cloneConfig(config);
        pinnedEditorFilters = {
            general: true,
            regular: true,
            compass: true,
            horizon: true,
            nodal: true,
            synod: true,
            bind: true
        };
        openEditorSection = null;
        showEditor = true;
        console.log('[CompassInfoBlock] editor opened');
    }

    function closeEditor() {
        modalRowsOpen = new Set();
        showEditor = false;
    }

    function applyEditor() {
        if (locked) return;
        if (!draftConfig) return;
        onConfigure(draftConfig);
        showEditor = false;
    }

    function toggleEditorSection(id: 'general' | 'houses' | 'dynamic' | 'pinned') {
        openEditorSection = openEditorSection === id ? null : id;
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

    function toggleModalRow(id: string) {
        const next = new Set(modalRowsOpen);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        modalRowsOpen = next;
    }

    function pinnedNodeTitle(node: { ts: number; disabled?: boolean }): string {
        const moment = Number.isFinite(node.ts) ? formatDateTime(node.ts) : '—';
        return `Moment • ${moment}`;
    }

    function nodeTimeClass(ts: number): 'past' | 'future' | '' {
        if (!Number.isFinite(referenceTs) || !Number.isFinite(ts)) return '';
        return Number(ts) < referenceTs ? 'past' : 'future';
    }

    function updateGeneralTag(id: string, patch: Partial<CompassInfoTagConfig>) {
        if (!draftConfig) return;
        const tags = draftConfig.general.tags.slice();
        const idx = tags.findIndex((t) => t.id === id);
        if (idx >= 0) {
            tags[idx] = {
                ...tags[idx],
                ...patch
            };
        } else {
            tags.push({
                id,
                ...patch
            });
        }
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags
            }
        };
    }

    let generalDragId: string | null = null;

    function moveGeneralTagTo(sourceId: string, targetId: string) {
        if (!draftConfig) return;
        if (sourceId === targetId) return;
        const tags = draftConfig.general.tags.slice();
        const from = tags.findIndex((t) => t.id === sourceId);
        const target = tags.findIndex((t) => t.id === targetId);
        if (from < 0 || target < 0) return;
        const [item] = tags.splice(from, 1);
        if (!item) return;
        tags.splice(target, 0, item);
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags
            }
        };
    }

    function handleGeneralDragStart(e: DragEvent, id: string) {
        generalDragId = id;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
        }
    }

    function handleGeneralDragEnd() {
        generalDragId = null;
    }

    function handleGeneralDragOver(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    }

    function handleGeneralDrop(e: DragEvent, targetId: string) {
        e.preventDefault();
        const sourceId = generalDragId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
        if (!sourceId) return;
        moveGeneralTagTo(sourceId, targetId);
        generalDragId = null;
    }

    function updateHouseTag(id: string, patch: Partial<CompassInfoTagConfig>) {
        if (!draftConfig) return;
        const tags = draftConfig.houses.tags.slice();
        const idx = tags.findIndex((t) => t.id === id);
        const def = houseDefs.find((d) => d.id === id);
        const fallbackLabel = def?.label ?? id;
        const current = idx >= 0 ? tags[idx] : { id, label: fallbackLabel };
        const nextItem: CompassInfoTagConfig = {
            ...current,
            ...patch,
            enabled: true
        };
        if (idx >= 0) tags[idx] = nextItem;
        else tags.push(nextItem);
        draftConfig = {
            ...draftConfig,
            houses: {
                ...draftConfig.houses,
                tags
            }
        };
    }

    function removeGeneralTag(id: string) {
        if (!draftConfig) return;
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags: draftConfig.general.tags.filter((t) => t.id !== id)
            }
        };
    }

    function addGeneralTag() {
        if (!draftConfig) return;
        const id = `custom:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
        draftConfig = {
            ...draftConfig,
            general: {
                ...draftConfig.general,
                tags: [...draftConfig.general.tags, { id, label: 'Custom', value: '', enabled: true, isCustom: true }]
            }
        };
    }

    function updateScopedTag(scope: 'dynamic' | 'pinned', id: string, patch: Partial<CompassInfoTagConfig>) {
        if (!draftConfig) return;
        if (scope === 'dynamic') {
            const tags = updateTagsByPatch(draftConfig.dynamic.tags, id, patch);
            console.log('[CompassInfoBlock] updateScopedTag(dynamic)', {
                id,
                patch,
                order: tags.map((t) => `${t.id}:${t.enabled !== false ? 'on' : 'off'}`)
            });
            draftConfig = {
                ...draftConfig,
                dynamic: {
                    ...draftConfig.dynamic,
                    tags
                }
            };
            return;
        }
        const tags = updateTagsByPatch(draftConfig.pinned.tags, id, patch, false);
        console.log('[CompassInfoBlock] updateScopedTag(pinned)', {
            id,
            patch,
            order: tags.map((t) => `${t.id}:${t.enabled !== false ? 'on' : 'off'}`)
        });
        draftConfig = {
            ...draftConfig,
            pinned: {
                ...draftConfig.pinned,
                tags
            }
        };
    }

    function findScopedTag(scope: 'dynamic' | 'pinned', id: string): CompassInfoTagConfig | undefined {
        if (scope === 'dynamic') return draftConfig?.dynamic.tags.find((t) => t.id === id);
        return draftConfig?.pinned.tags.find((t) => t.id === id);
    }

    function uniqueTagDefsByLabel(scope: 'dynamic' | 'pinned'): CompassTagDef[] {
        const out: CompassTagDef[] = [];
        const seen = new Set<string>();
        for (const def of tagDefs) {
            if (def.scope !== scope) continue;
            const key = String(def.label ?? '').trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(def);
        }
        return out;
    }

    function normalizeTagsByEnabled(tags: CompassInfoTagConfig[]): CompassInfoTagConfig[] {
        const enabled = tags.filter((t) => t.enabled !== false);
        const disabled = tags.filter((t) => t.enabled === false);
        return [...enabled, ...disabled];
    }

    function updateTagsByPatch(
        source: CompassInfoTagConfig[],
        id: string,
        patch: Partial<CompassInfoTagConfig>,
        reorderByEnabled = true
    ): CompassInfoTagConfig[] {
        const hasEnabledPatch = Object.prototype.hasOwnProperty.call(patch, 'enabled');
        const tags = source.slice();
        const idx = tags.findIndex((t) => t.id === id);
        const current = idx >= 0 ? tags[idx] : { id, enabled: true };
        const nextItem: CompassInfoTagConfig = { ...current, ...patch };

        if (idx >= 0) tags.splice(idx, 1);
        tags.push(nextItem);

        if (hasEnabledPatch && reorderByEnabled) {
            const moved = tags.pop();
            if (moved) {
                const firstDisabled = tags.findIndex((t) => t.enabled === false);
                const at = firstDisabled >= 0 ? firstDisabled : tags.length;
                tags.splice(at, 0, moved);
            }
        }

        const next = (hasEnabledPatch && reorderByEnabled) ? normalizeTagsByEnabled(tags) : tags;
        console.log('[CompassInfoBlock] updateTagsByPatch', {
            id,
            patch,
            reorderByEnabled,
            before: source.map((t) => `${t.id}:${t.enabled !== false ? 'on' : 'off'}`),
            after: next.map((t) => `${t.id}:${t.enabled !== false ? 'on' : 'off'}`)
        });
        return next;
    }

    function generalTagsForEditor(cfg: CompassInfoConfig | null): CompassInfoTagConfig[] {
        if (!cfg) return [];
        return cfg.general.tags.slice();
    }

    type HouseEditorRow = { id: string; code: string; systemLabel: string; tag?: CompassInfoTagConfig };

    function houseTagsForEditor(cfg: CompassInfoConfig | null): HouseEditorRow[] {
        if (!cfg) return [];
        const byId = new Map(cfg.houses.tags.map((t) => [t.id, t]));
        return houseDefs.map((d) => ({
            id: d.id,
            code: d.code,
            systemLabel: d.label,
            tag: byId.get(d.id)
        }));
    }

    function houseInputLabelValue(row: HouseEditorRow): string {
        const custom = String(row.tag?.label ?? '').trim();
        if (!custom) return '';
        return custom === row.systemLabel ? '' : custom;
    }

    function scopedInputLabelValue(row: ScopedEditorRow): string {
        const custom = String(row.tag?.label ?? '').trim();
        if (!custom) return '';
        return custom === row.systemLabel ? '' : custom;
    }

    type ScopedEditorRow = {
        id: string;
        systemLabel: string;
        tag?: CompassInfoTagConfig;
    };
    type PinnedGroupKey = 'general' | 'regular' | 'compass' | 'horizon' | 'nodal' | 'synod' | 'bind';
    const PINNED_GROUP_FILTERS: Array<{ key: PinnedGroupKey; label: string }> = [
        { key: 'general', label: 'general' },
        { key: 'regular', label: 'regular' },
        { key: 'compass', label: 'compass' },
        { key: 'synod', label: 'synod' },
        { key: 'bind', label: 'bind' },
        { key: 'horizon', label: 'horizon' },
        { key: 'nodal', label: 'nodal' }
    ];

    let dynamicEditorRows: ScopedEditorRow[] = [];
    let pinnedEditorRows: ScopedEditorRow[] = [];
    let pinnedEditorRowsFiltered: ScopedEditorRow[] = [];
    let pinnedGroupFiltersVisible: Array<{ key: PinnedGroupKey; label: string }> = [];
    export let pinnedAvailableGroups: PinnedGroupKey[] = ['general', 'regular'];
    let dynamicRowsByHouse: Array<{ code: string; label: string; modal?: string; rows: CompassDynamicRow[] }> = [];
    let pinnedEditorFilters: Record<PinnedGroupKey, boolean> = {
        general: true,
        regular: true,
        compass: true,
        horizon: true,
        nodal: true,
        synod: true,
        bind: true
    };

    function scopedRows(scope: 'dynamic' | 'pinned'): ScopedEditorRow[] {
        if (!draftConfig) return [];
        const defs = uniqueTagDefsByLabel(scope);
        const tagsOrdered = normalizeTagsByEnabled(
            (scope === 'dynamic' ? draftConfig.dynamic.tags : draftConfig.pinned.tags).slice()
        );
        const ids = scope === 'pinned'
            ? defs.map((d) => d.id)
            : tagsOrdered.map((t) => t.id);
        if (scope !== 'pinned') {
            for (const t of tagsOrdered) {
                if (!ids.includes(t.id)) ids.push(t.id);
            }
            for (const d of defs) {
                if (!ids.includes(d.id)) ids.push(d.id);
            }
        }

        const defById = new Map(defs.map((d) => [d.id, d]));
        const rows = ids.map((id) => {
            const def = defById.get(id);
            const tag = tagsOrdered.find((t) => t.id === id);
            if (def) {
                return {
                    id,
                    systemLabel: def.label,
                    tag
                };
            }
            return {
                id,
                systemLabel: (tag?.label && tag.label.trim()) ? tag.label.trim() : id,
                tag
            };
        });
        if (scope === 'pinned') {
            console.log('[CompassInfoBlock] scopedRows(pinned)', rows.map((r) => `${r.systemLabel}:${r.tag?.enabled !== false ? 'on' : 'off'}`));
            return rows;
        }
        console.log('[CompassInfoBlock] scopedRows(dynamic)', rows.map((r) => `${r.id}:${r.tag?.enabled !== false ? 'on' : 'off'}`));
        return rows;
    }

    $: dynamicEditorRows = draftConfig ? scopedRows('dynamic') : [];
    $: pinnedEditorRows = draftConfig ? scopedRows('pinned') : [];
    $: pinnedGroupFiltersVisible = (() => {
        const present = new Set<PinnedGroupKey>();
        for (const group of pinnedAvailableGroups) {
            present.add(group);
        }
        return PINNED_GROUP_FILTERS.filter((g) => present.has(g.key));
    })();
    $: pinnedEditorRowsFiltered = (() => {
        if (!draftConfig) return [];
        const defById = new Map(uniqueTagDefsByLabel('pinned').map((d) => [d.id, d]));
        return pinnedEditorRows.filter((row) => {
            const group = (defById.get(row.id)?.group as PinnedGroupKey | undefined) ?? 'regular';
            return pinnedEditorFilters[group] !== false;
        });
    })();
    $: dynamicRowsByHouse = (() => {
        const houseCfgById = new Map(config.houses.tags.map((t) => [t.id, t]));
        const map = new Map<string, { code: string; label: string; modal?: string; rows: CompassDynamicRow[] }>();
        for (const row of dynamicRows) {
            const houseCfg = houseCfgById.get(`house:${row.houseCode}`);
            const modal = (houseCfg?.modal && houseCfg.modal.trim()) ? houseCfg.modal.trim() : undefined;
            const current = map.get(row.houseCode) ?? { code: row.houseCode, label: row.houseLabel, modal, rows: [] };
            current.rows.push(row);
            if (!map.has(row.houseCode)) map.set(row.houseCode, current);
        }

        const ordered: Array<{ code: string; label: string; modal?: string; rows: CompassDynamicRow[] }> = [];
        for (const d of houseDefs) {
            const g = map.get(d.code);
            if (g && g.rows.length > 0) ordered.push(g);
        }
        for (const [code, g] of map) {
            if (ordered.some((x) => x.code === code)) continue;
            if (g.rows.length > 0) ordered.push(g);
        }
        return ordered;
    })();

    function setPinnedGroup(group: PinnedGroupKey, enabled: boolean) {
        pinnedEditorFilters = {
            ...pinnedEditorFilters,
            [group]: enabled
        };
    }

</script>

<section class="infoBlock">
    {#if !locked}
        <button
            type="button"
            class="editBtn navBtn"
            title="Edit compass info"
            aria-label="Edit compass info"
            on:click|stopPropagation={openEditor}
        >✎</button>
    {/if}

    {#if config.general.enabled}
        <section class="infoSection">
            {#if generalChips.length > 0}
                <div class="chipGrid">
                    {#each generalChips as chip (chip.id)}
                        {#if chip.modal}
                            <button
                                type="button"
                                class="ui-tag chipButton chipAction"
                                on:click={() => {
                                    modalTitle = chip.label;
                                    modalText = chip.modal ?? null;
                                }}
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
                            <span class="ui-tag chipStatic" title={chip.modal}>
                                <span class="chipLine">
                                    <span class="chipLabel">{chip.label}</span>
                                    {#if chip.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{chip.value}</span>
                                    {/if}
                                </span>
                            </span>
                        {/if}
                    {/each}
                </div>
            {:else}
                <div class="empty">General section is empty.</div>
            {/if}
        </section>
    {/if}

    {#if config.general.enabled}
        <div class="chipSep" aria-hidden="true"></div>
    {/if}

    <section class="infoSection pinnedSection">
        {#if config.pinned.enabled && pinnedRows.length > 0}
            <div class="rowList">
                {#each pinnedRows as row (row.id)}
                    <div class="rowItem">
                        <button
                            type="button"
                            class="rowNameBtn pinnedNameBtn"
                            title="Pinned body"
                            on:click={() => onBodyPick(row.bodyId)}
                        >{row.emoji} {row.name}</button>
                        <div class="chipGrid">
                            {#if row.nodes.length === 0}
                                <span class="empty">No enabled nodes.</span>
                            {:else}
                                {#each row.nodes as node (`${row.id}:${node.id}:${node.ts}`)}
                                    <button
                                        type="button"
                                        class="ui-tag chipButton pinnedChipButton"
                                        class:isActive={node.disabled === true}
                                        class:time-tone-past={nodeTimeClass(node.ts) === 'past'}
                                        class:time-border-past={nodeTimeClass(node.ts) === 'past'}
                                        class:time-tone-future={nodeTimeClass(node.ts) === 'future'}
                                        class:time-border-future={nodeTimeClass(node.ts) === 'future'}
                                        title={pinnedNodeTitle(node)}
                                        disabled={node.disabled === true}
                                        on:click={() => onPinnedPick(node.ts, row.bodyId, node.code, node.sourceWheel)}
                                    >{node.label}</button>
                                {/each}
                            {/if}
                        </div>
                        {#if row.durationItem}
                            <div class="chipGrid">
                                {#if row.durationItem.modal}
                                    <button
                                        type="button"
                                        class="ui-tag chipButton"
                                        on:click={() => {
                                            modalTitle = row.durationItem?.label ?? 'Duration';
                                            modalText = row.durationItem?.modal ?? null;
                                        }}
                                    >
                                        <span class="chipLine">
                                            <span class="chipLabel">{row.durationItem.label}</span>
                                            <span class="chipDivider" aria-hidden="true"></span>
                                            <span class="chipValue">{row.durationItem.value}</span>
                                        </span>
                                    </button>
                                {:else}
                                    <span class="ui-tag chipStatic">
                                        <span class="chipLine">
                                            <span class="chipLabel">{row.durationItem.label}</span>
                                            <span class="chipDivider" aria-hidden="true"></span>
                                            <span class="chipValue">{row.durationItem.value}</span>
                                        </span>
                                    </span>
                                {/if}
                            </div>
                        {/if}
                        {#if row.description}
                            <div class="pinnedDescription">{row.description}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="empty">Pin a body to see node rows.</div>
        {/if}
    </section>

    <div class="chipSep chipSepTight" aria-hidden="true"></div>

    <section class="infoSection">
        {#if config.dynamic.enabled && dynamicRows.length > 0}
            <div class="rowList">
                {#each dynamicRowsByHouse as group (`house:${group.code}`)}
                    <div class="houseGroup">
                        {#if group.modal}
                            <h4 class="houseHeader">
                                <button
                                    type="button"
                                    class="houseHeaderBtn houseHeaderInteractive"
                                    on:click={() => {
                                        modalTitle = group.label;
                                        modalText = group.modal ?? null;
                                    }}
                                >{group.label}</button>
                            </h4>
                        {:else}
                            <h4 class="houseHeader">{group.label}</h4>
                        {/if}
                        {#each group.rows as row (row.id)}
                            <div class="rowItem">
                                <button
                                    type="button"
                                    class="rowNameBtn"
                                    title="Pin/unpin body"
                                    on:click={() => onBodyPick(row.id)}
                                >{row.emoji} {row.name}</button>
                                <div class="chipGrid">
                                    {#each row.items as item (`${row.id}:${item.id}`)}
                                        {#if item.modal}
                                            <button
                                                type="button"
                                                class="ui-tag chipButton"
                                                on:click|stopPropagation={() => { modalTitle = item.label; modalText = item.modal ?? null; }}
                                            >
                                                <span class="chipLine">
                                                    <span class="chipLabel">{item.label}</span>
                                                    {#if item.value}
                                                        <span class="chipDivider" aria-hidden="true"></span>
                                                        <span class="chipValue">{item.value}</span>
                                                    {/if}
                                                </span>
                                            </button>
                                        {:else}
                                            <span class="ui-tag chipStatic" title={item.modal}>
                                                <span class="chipLine">
                                                    <span class="chipLabel">{item.label}</span>
                                                    {#if item.value}
                                                        <span class="chipDivider" aria-hidden="true"></span>
                                                        <span class="chipValue">{item.value}</span>
                                                    {/if}
                                                </span>
                                            </span>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="empty">Dynamic section is hidden.</div>
        {/if}
    </section>
</section>

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
                            <button type="button" class="toggleBtn" on:click={addGeneralTag}>+ Tag</button>
                        </div>
                        <div class="editorSectionBody">
                            {#if draftConfig.general.tags.length === 0}
                                <div class="editorEmpty">No general tags.</div>
                            {/if}
                            {#each generalTagsForEditor(draftConfig) as tag (tag.id)}
                                {@const rowKey = `general:${tag.id}`}
                                <div class="editorRowWrap" role="listitem" on:dragover={handleGeneralDragOver} on:drop={(e) => handleGeneralDrop(e, tag.id)}>
                                    <div class="editorRow">
                                        <div class="col sys">{tag.id}</div>
                                        <input class="col user" type="text" value={tag.label ?? ''} placeholder="Custom label" on:input={(e) => updateGeneralTag(tag.id, { label: readValue(e) })} />
                                        <input class="col val" type="text" value={tag.value ?? ''} placeholder="Value" on:input={(e) => updateGeneralTag(tag.id, { value: readValue(e) })} />
                                        <label class="stateToggle" title={tag.enabled !== false ? 'Hide tag' : 'Show tag'}>
                                            <input type="checkbox" checked={tag.enabled !== false} on:change={(e) => updateGeneralTag(tag.id, { enabled: readChecked(e) })} />
                                            <span class="stateTrack"><span class="stateThumb"></span></span>
                                            <span class="stateText">{tag.enabled !== false ? 'On' : 'Off'}</span>
                                        </label>
                                        <div class="rowActions">
                                            <button type="button" class="miniBtn dragHandleBtn" title="Drag to reorder" aria-label="Drag to reorder" draggable="true" on:dragstart={(e) => handleGeneralDragStart(e, tag.id)} on:dragend={handleGeneralDragEnd}>⋮⋮</button>
                                            <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                            {#if tag.isCustom}
                                                <button type="button" class="miniBtn dangerBtn" on:click={() => removeGeneralTag(tag.id)}>×</button>
                                            {/if}
                                        </div>
                                    </div>
                                    {#if modalRowsOpen.has(rowKey)}
                                        <div class="modalAccordion">
                                            <textarea class="modalInput" placeholder="Modal text" value={tag.modal ?? ''} on:input={(e) => updateGeneralTag(tag.id, { modal: readValue(e) })}></textarea>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>

                <section class="editorSection">
                    <div class="editorSectionHead">
                        <button type="button" class="editorSectionToggle" aria-expanded={openEditorSection === 'houses'} on:click={() => toggleEditorSection('houses')}>
                            <span class="editorSectionTitle">Houses</span>
                            <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'houses' ? '▾' : '▸'}</span>
                        </button>
                    </div>
                    {#if openEditorSection === 'houses'}
                        <div class="editorSectionBody">
                            {#if houseTagsForEditor(draftConfig).length === 0}
                                <div class="editorEmpty">No houses.</div>
                            {/if}
                            {#each houseTagsForEditor(draftConfig) as row (row.id)}
                                {@const rowKey = `houses:${row.id}`}
                                <div class="editorRowWrap">
                                    <div class="editorRow houseEditorRow">
                                        <div class="col sys">{row.systemLabel}</div>
                                        <input class="col user" type="text" value={houseInputLabelValue(row)} placeholder={row.systemLabel} on:input={(e) => updateHouseTag(row.id, { label: readValue(e) })} />
                                        <div class="rowActions">
                                            <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                        </div>
                                    </div>
                                    {#if modalRowsOpen.has(rowKey)}
                                        <div class="modalAccordion">
                                            <textarea class="modalInput" placeholder="Modal text" value={row.tag?.modal ?? ''} on:input={(e) => updateHouseTag(row.id, { modal: readValue(e) })}></textarea>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>

                <section class="editorSection">
                    <div class="editorSectionHead">
                        <button type="button" class="editorSectionToggle" aria-expanded={openEditorSection === 'dynamic'} on:click={() => toggleEditorSection('dynamic')}>
                            <span class="editorSectionTitle">Dynamic</span>
                            <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'dynamic' ? '▾' : '▸'}</span>
                        </button>
                        <div class="editorHeadActions">
                            <button type="button" class="toggleBtn" on:click|stopPropagation={() => draftConfig && (draftConfig = { ...draftConfig, dynamic: { ...draftConfig.dynamic, enabled: !draftConfig.dynamic.enabled } })}>
                                {draftConfig.dynamic.enabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>
                    {#if openEditorSection === 'dynamic'}
                        <div class="editorSectionBody">
                            {#each dynamicEditorRows as row (row.id)}
                                {@const rowKey = `dynamic:${row.id}`}
                                <div class="editorRowWrap">
                                    <div class="editorRow dynamicEditorRow">
                                        <div class="col sys">{row.systemLabel}</div>
                                        <input class="col user" type="text" value={scopedInputLabelValue(row)} placeholder={row.systemLabel} on:input={(e) => updateScopedTag('dynamic', row.id, { label: readValue(e) })} />
                                        <label class="stateToggle" title={row.tag?.enabled !== false ? 'Hide tag' : 'Show tag'}>
                                            <input type="checkbox" checked={row.tag?.enabled !== false} on:change={(e) => updateScopedTag('dynamic', row.id, { enabled: readChecked(e) })} />
                                            <span class="stateTrack"><span class="stateThumb"></span></span>
                                            <span class="stateText">{row.tag?.enabled !== false ? 'On' : 'Off'}</span>
                                        </label>
                                        <div class="rowActions">
                                            <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(rowKey)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(rowKey)}>T</button>
                                        </div>
                                    </div>
                                    {#if modalRowsOpen.has(rowKey)}
                                        <div class="modalAccordion">
                                            <textarea class="modalInput" placeholder="Modal text" value={row.tag?.modal ?? ''} on:input={(e) => updateScopedTag('dynamic', row.id, { modal: readValue(e) })}></textarea>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>

                <section class="editorSection">
                    <div class="editorSectionHead">
                        <button type="button" class="editorSectionToggle" aria-expanded={openEditorSection === 'pinned'} on:click={() => toggleEditorSection('pinned')}>
                            <span class="editorSectionTitle">Pinned</span>
                            <span class="editorSectionChevron" aria-hidden="true">{openEditorSection === 'pinned' ? '▾' : '▸'}</span>
                        </button>
                        <div class="editorHeadActions">
                            <button type="button" class="toggleBtn" on:click|stopPropagation={() => draftConfig && (draftConfig = { ...draftConfig, pinned: { ...draftConfig.pinned, enabled: !draftConfig.pinned.enabled } })}>
                                {draftConfig.pinned.enabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>
                    {#if openEditorSection === 'pinned'}
                        <div class="groupFilters">
                            {#each pinnedGroupFiltersVisible as gf (gf.key)}
                                {@const enabled = pinnedEditorFilters[gf.key] !== false}
                                <button
                                    type="button"
                                    class="groupFilterBtn"
                                    class:isOn={enabled}
                                    on:click={() => setPinnedGroup(gf.key, !enabled)}
                                >{gf.label}</button>
                            {/each}
                        </div>
                        <div class="editorSectionBody">
                            {#each pinnedEditorRowsFiltered as row (row.id)}
                                <div class="editorRowWrap">
                                    <div class="editorRow pinnedEditorRow">
                                        <div class="col sys">{row.systemLabel}</div>
                                        <input class="col user" type="text" value={scopedInputLabelValue(row)} placeholder={row.systemLabel} on:input={(e) => updateScopedTag('pinned', row.id, { label: readValue(e) })} />
                                        <label class="stateToggle" title={row.tag?.enabled !== false ? 'Hide tag' : 'Show tag'}>
                                            <input type="checkbox" checked={row.tag?.enabled !== false} on:change={(e) => updateScopedTag('pinned', row.id, { enabled: readChecked(e) })} />
                                            <span class="stateTrack"><span class="stateThumb"></span></span>
                                            <span class="stateText">{row.tag?.enabled !== false ? 'On' : 'Off'}</span>
                                        </label>
                                        <div class="rowActions"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            </div>

            <footer class="editorFoot">
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
        position: relative;
    }

    .infoSection {
        display: grid;
        gap: 6px;
    }

    .chipSep {
        height: 1px;
        width: 100%;
        margin: 2px 0 6px;
        background: color-mix(in oklab, var(--fg), transparent 88%);
    }
    .chipSepTight {
        margin: 1px 0 3px;
    }

    .editBtn {
        position: absolute;
        top: 2px;
        right: 2px;
        z-index: 3;
        height: 28px;
        min-width: 34px;
        padding: 0 8px;
    }

    .rowList {
        display: grid;
        gap: 6px;
    }

    .houseGroup {
        display: grid;
        gap: 6px;
        padding-top: 4px;
    }

    .houseGroup + .houseGroup {
        border-top: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        margin-top: 2px;
        padding-top: 8px;
    }

    .houseHeader {
        margin: 0;
        justify-self: center;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.03em;
        opacity: 0.7;
    }
    .houseHeaderBtn {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        letter-spacing: inherit;
        padding: 0;
    }
    .houseHeaderInteractive {
        cursor: pointer;
        color: color-mix(in oklab, var(--accent-live), var(--fg) 48%);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        text-decoration-color: color-mix(in oklab, var(--accent-live), transparent 45%);
    }

    .rowItem {
        display: grid;
        grid-template-columns: minmax(120px, 200px) minmax(0, 1fr);
        gap: 8px;
        align-items: flex-start;
    }

    .rowNameBtn {
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
        color: inherit;
        font-size: 12px;
        font-weight: 700;
        text-align: left;
        padding: 6px 8px;
        cursor: pointer;
    }
    .chipGrid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 2px 0;
    }

    .chipStatic {
        border-color: color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }
    .chipButton {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
        color: inherit;
        cursor: pointer;
    }

    .pinnedSection {
        border: 1px solid color-mix(in oklab, var(--accent-live), transparent 82%);
        border-radius: 12px;
        padding: 8px;
        background: color-mix(in oklab, var(--accent-live), transparent 96%);
    }

    .pinnedNameBtn {
        border-color: color-mix(in oklab, var(--accent-live), transparent 62%);
        background: color-mix(in oklab, var(--accent-live), transparent 90%);
    }

    .pinnedChipButton {
        border-color: color-mix(in oklab, var(--accent-live), transparent 70%);
        background: color-mix(in oklab, var(--accent-live), transparent 92%);
    }
    .pinnedChipButton:not(:disabled) {
        opacity: 1;
        filter: saturate(1.06) brightness(1.03);
    }
    .pinnedChipButton.isActive {
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--accent-live), transparent 46%),
            0 0 10px color-mix(in oklab, var(--accent-live), transparent 82%);
    }
    .pinnedChipButton.isActive.time-tone-past {
        background: color-mix(in oklab, var(--btn-bg), var(--accent-blue) 44%) !important;
        border-color: color-mix(in oklab, var(--accent-blue), transparent 18%) !important;
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--accent-blue), transparent 26%),
            0 0 14px color-mix(in oklab, var(--accent-blue), transparent 68%);
    }
    .pinnedChipButton.isActive.time-tone-future {
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 46%) !important;
        border-color: color-mix(in oklab, var(--accent-gold), transparent 16%) !important;
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--accent-gold), transparent 24%),
            0 0 14px color-mix(in oklab, var(--accent-gold), transparent 66%);
    }
    .pinnedChipButton:disabled {
        opacity: 1;
        cursor: not-allowed;
        filter: saturate(1.06) brightness(1.03);
    }

    .pinnedDescription {
        font-size: 14px;
        line-height: 1.35;
        color: color-mix(in oklab, var(--fg), transparent 25%);
        padding: 2px 4px 0;
    }

    .ui-tag {
        font-size: 12px;
        padding: 5px 10px;
    }

    .chipLine {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        font-size: 13px;
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

    .empty {
        font-size: 12px;
        opacity: 0.72;
        padding: 4px 2px;
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

    .editorRowWrap {
        display: grid;
        gap: 6px;
    }

    .modalAccordion {
        border-left: 2px solid color-mix(in oklab, var(--fg), transparent 84%);
        margin-left: 8px;
        padding-left: 10px;
    }

    .modalInput {
        width: 100%;
        min-height: 64px;
        resize: vertical;
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), transparent 10%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        border-radius: 8px;
        color: var(--fg);
        padding: 8px;
        font: inherit;
        font-size: 12px;
        line-height: 1.35;
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
        cursor: default;
    }
    .houseEditorRow {
        grid-template-columns: minmax(120px, 0.95fr) minmax(160px, 1.15fr) auto;
    }
    .dynamicEditorRow {
        grid-template-columns: minmax(120px, 0.95fr) minmax(160px, 1.15fr) auto auto;
    }
    .pinnedEditorRow {
        grid-template-columns: minmax(120px, 0.95fr) minmax(160px, 1.15fr) auto auto;
    }

    .col {
        min-width: 0;
        font-size: 12px;
    }

    .col.user,
    .col.val {
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

    .groupFilters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .editorSectionBody {
        max-height: 320px;
        overflow-y: auto;
        padding-right: 4px;
    }
    .groupFilterBtn {
        height: 26px;
        min-width: 74px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 78%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
        color: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }
    .groupFilterBtn.isOn {
        border-color: color-mix(in oklab, var(--accent-live), transparent 48%);
        background: color-mix(in oklab, var(--accent-live), transparent 86%);
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
    .dragHandleBtn {
        cursor: grab;
        letter-spacing: -1px;
        font-weight: 900;
    }
    .dragHandleBtn:active {
        cursor: grabbing;
    }

    .miniBtn {
        min-width: 36px;
        padding: 0 9px;
    }

    .dangerBtn {
        color: color-mix(in oklab, var(--accent-red), var(--fg) 20%);
    }

    .modalBtn {
        min-width: 36px;
    }

    .modalBody {
        font-size: 15px;
        line-height: 1.45;
        white-space: pre-wrap;
        opacity: 0.9;
        padding: 4px 2px 2px;
    }

    @media (max-width: 780px) {
        .rowItem {
            grid-template-columns: 1fr;
        }

        .editorRow {
            grid-template-columns: auto minmax(0, 1fr);
        }
    }
</style>
