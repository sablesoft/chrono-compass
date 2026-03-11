<script lang="ts">
    import type { ObjId } from '../lib/catalog';
    import { activeProfile, profilesApi } from '../lib/profile/store';
    import type { BodyUserInfoItem } from '../lib/profile/types';
    import {
        isSystemBodyInfoItemId,
        resolveBodyStarInfoItems,
        resolveBodyDescription,
        resolveBodyDescriptionLabel,
        resolveBodyDistanceLy,
        resolveBodyDistanceLyLabel,
        resolveBodyEmoji,
        resolveBodyName
    } from '../lib/profile/bodyInfo';
    import { formatInfoValue } from '../lib/wheel/infoFormat';

    type DraftInfoItem = {
        id: string;
        label: string;
        value: string;
        modal: string;
    };

    type DraftSystemInfoItem = {
        id: string;
        defaultLabel: string;
        defaultModal: string;
        label: string;
        value: string;
        modal: string;
    };

    export let open = false;
    export let bodyId: ObjId | null = null;
    export let locked = false;
    export let onClose: () => void = () => {};

    let lastDraftKey = '';
    let labelDraft = '';
    let descriptionLabelDraft = '';
    let descriptionDraft = '';
    let distanceLyLabelDraft = '';
    let systemItemsDraft: DraftSystemInfoItem[] = [];
    let customItemsDraft: DraftInfoItem[] = [];
    let modalRowsOpen = new Set<string>();

    function trimText(value: unknown): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    function makeCustomItemId(): string {
        return `custom:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
    }

    function buildDraftKey(nextOpen: boolean, nextBodyId: ObjId | null): string {
        return nextOpen && nextBodyId ? `${nextBodyId}` : '';
    }

    function resetDraft() {
        if (!bodyId) return;
        const overrides = $activeProfile?.data?.bodies ?? {};
        const sharedStarInfoItems = $activeProfile?.data?.starInfoItems ?? [];
        const existing = overrides[bodyId];
        labelDraft = resolveBodyName(bodyId, overrides);
        descriptionLabelDraft = resolveBodyDescriptionLabel(bodyId, overrides, 'en', $activeProfile?.data?.bodyDescriptionLabel);
        descriptionDraft = resolveBodyDescription(bodyId, overrides);
        distanceLyLabelDraft = resolveBodyDistanceLyLabel(bodyId, overrides);
        systemItemsDraft = resolveBodyStarInfoItems(bodyId, overrides, sharedStarInfoItems, { includeEmpty: true }).map((item) => {
            const base = resolveBodyStarInfoItems(bodyId, null, undefined, { includeEmpty: true }).find((x) => x.id === item.id);
            return {
                id: item.id,
                defaultLabel: trimText(base?.label) || trimText(item.label),
                defaultModal: trimText(base?.modal),
                label: trimText(item.label),
                value: trimText(item.value),
                modal: trimText(item.modal)
            };
        });
        customItemsDraft = Array.isArray(existing?.infoItems)
            ? existing.infoItems.map((item) => ({
                id: trimText(item.id) || makeCustomItemId(),
                label: trimText(item.label),
                value: trimText(item.value),
                modal: trimText(item.modal)
            })).filter((item) => !isSystemBodyInfoItemId(item.id))
            : [];
        modalRowsOpen = new Set();
    }

    $: {
        const key = buildDraftKey(open, bodyId);
        if (key && key !== lastDraftKey) {
            resetDraft();
        }
        if (!key && lastDraftKey) {
            modalRowsOpen = new Set();
        }
        lastDraftKey = key;
    }

    function closeEditor() {
        modalRowsOpen = new Set();
        onClose();
    }

    function toggleModalRow(id: string) {
        const next = new Set(modalRowsOpen);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        modalRowsOpen = next;
    }

    function readValue(e: Event): string {
        const target = e.currentTarget;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
        return '';
    }

    function updateCustomItem(id: string, patch: Partial<DraftInfoItem>) {
        customItemsDraft = customItemsDraft.map((item) => item.id === id ? { ...item, ...patch } : item);
    }

    function updateSystemItem(id: string, patch: Partial<DraftSystemInfoItem>) {
        systemItemsDraft = systemItemsDraft.map((item) => item.id === id ? { ...item, ...patch } : item);
    }

    function addCustomItem() {
        customItemsDraft = [
            ...customItemsDraft,
            {
                id: makeCustomItemId(),
                label: '',
                value: '',
                modal: ''
            }
        ];
    }

    function removeCustomItem(id: string) {
        customItemsDraft = customItemsDraft.filter((item) => item.id !== id);
        const next = new Set(modalRowsOpen);
        next.delete(id);
        modalRowsOpen = next;
    }

    function sanitizeCustomItems(items: DraftInfoItem[]): BodyUserInfoItem[] | undefined {
        const out = items.reduce<BodyUserInfoItem[]>((acc, item) => {
                const id = trimText(item.id);
                const label = trimText(item.label);
                const value = trimText(item.value);
                const modal = trimText(item.modal);
                if (!id || !label) return acc;
                if (!value && !modal) return acc;
                acc.push({
                    id,
                    label,
                    value: value || undefined,
                    modal: modal || undefined
                } satisfies BodyUserInfoItem);
                return acc;
            }, []);
        return out.length ? out : undefined;
    }

    function sanitizeSystemItems(items: DraftSystemInfoItem[]): BodyUserInfoItem[] | undefined {
        const out = items.reduce<BodyUserInfoItem[]>((acc, item) => {
                const id = trimText(item.id);
                const label = trimText(item.label);
                const modal = trimText(item.modal);
                const defaultLabel = trimText(item.defaultLabel);
                const defaultModal = trimText(item.defaultModal);
                if (!id || !label) return acc;
                if (label === defaultLabel && modal === defaultModal) return acc;
                acc.push({
                    id,
                    label,
                    modal: modal || undefined
                } satisfies BodyUserInfoItem);
                return acc;
            }, []);
        return out.length ? out : undefined;
    }

    function applyEditor() {
        if (locked || !bodyId) return;
        const defaultName = resolveBodyName(bodyId, null);
        const defaultDescription = resolveBodyDescription(bodyId, null);
        const defaultDescriptionLabel = resolveBodyDescriptionLabel(bodyId, null);
        const defaultDistanceLyLabel = resolveBodyDistanceLyLabel(bodyId, null);

        const name = trimText(labelDraft);
        const description = trimText(descriptionDraft);
        const descriptionLabel = trimText(descriptionLabelDraft);
        const distanceLyLabel = trimText(distanceLyLabelDraft);
        const systemInfoItems = sanitizeSystemItems(systemItemsDraft) ?? [];
        const customInfoItems = sanitizeCustomItems(customItemsDraft) ?? [];
        const currentSharedDescriptionLabel = typeof $activeProfile?.data?.bodyDescriptionLabel === 'string'
            ? $activeProfile.data.bodyDescriptionLabel.trim()
            : '';
        const currentSharedSystemItems = (($activeProfile?.data?.starInfoItems ?? []) as BodyUserInfoItem[])
            .filter((item) => isSystemBodyInfoItemId(item.id));
        const nextSharedSignature = JSON.stringify(systemInfoItems);
        const currentSharedSignature = JSON.stringify(currentSharedSystemItems);

        const patch = {
            name: name && name !== defaultName ? name : undefined,
            description: description && description !== defaultDescription ? description : undefined,
            descriptionLabel: undefined,
            distanceLyLabel: distanceLyLabel && distanceLyLabel !== defaultDistanceLyLabel ? distanceLyLabel : undefined,
            infoItems: customInfoItems.length ? customInfoItems : undefined
        };

        const hasPatch = !!(patch.name || patch.description || patch.distanceLyLabel || patch.infoItems?.length);
        if (descriptionLabel !== currentSharedDescriptionLabel) {
            profilesApi.setBodyDescriptionLabel(descriptionLabel && descriptionLabel !== defaultDescriptionLabel ? descriptionLabel : undefined);
        }
        if (nextSharedSignature !== currentSharedSignature) {
            profilesApi.setStarInfoOverrides(systemInfoItems.length ? systemInfoItems : undefined);
        }
        if (hasPatch) profilesApi.setBodyOverride(bodyId, patch);
        else profilesApi.clearBodyOverride(bodyId);
        closeEditor();
    }

    function resetOverrides() {
        if (!bodyId || locked) return;
        profilesApi.setBodyDescriptionLabel(undefined);
        if (systemItemsDraft.length > 0) {
            profilesApi.setStarInfoOverrides(undefined);
        }
        profilesApi.clearBodyOverride(bodyId);
        closeEditor();
    }

    $: resolvedEmoji = bodyId ? resolveBodyEmoji(bodyId, $activeProfile?.data?.bodies ?? {}) : '•';
    $: resolvedDistanceLy = bodyId ? resolveBodyDistanceLy(bodyId) : NaN;
    $: distanceLyValue = Number.isFinite(resolvedDistanceLy) ? formatInfoValue('ly', resolvedDistanceLy) : '—';
</script>

{#if open && bodyId}
    <div
        class="editorOverlay"
        role="button"
        tabindex="0"
        aria-label="Close body info editor"
        on:click={closeEditor}
        on:keydown={(e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeEditor();
            }
        }}
    >
        <div
            class="editorModal"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Body info"
            on:click|stopPropagation
            on:keydown|stopPropagation
        >
            <header class="editorHead">
                <div class="editorTitle"><span class="bodyEmoji">{resolvedEmoji}</span> {labelDraft || String(bodyId)}</div>
                <button type="button" class="navBtn" on:click={closeEditor}>×</button>
            </header>

            <section class="editorSection">
                <div class="sectionTitle">Body Info</div>

                <div class="editorRow staticRow">
                    <div class="col sys">Label</div>
                    <input class="col user" type="text" value={labelDraft} placeholder="Body label" on:input={(e) => { labelDraft = readValue(e); }} />
                </div>

                <div class="editorRow staticRow">
                    <div class="col sys">Description label</div>
                    <input class="col user" type="text" value={descriptionLabelDraft} placeholder="Description label" on:input={(e) => { descriptionLabelDraft = readValue(e); }} />
                </div>

                <div class="editorRowArea">
                    <div class="areaLabel">Description modal</div>
                    <textarea class="modalInput" placeholder="Description text" value={descriptionDraft} on:input={(e) => { descriptionDraft = readValue(e); }}></textarea>
                </div>

                <div class="editorRow staticRow">
                    <div class="col sys">Distance label</div>
                    <input class="col user" type="text" value={distanceLyLabelDraft} placeholder="Distance label" on:input={(e) => { distanceLyLabelDraft = readValue(e); }} />
                    <div class="col val readonlyValue">{distanceLyValue}</div>
                </div>

                {#if systemItemsDraft.length > 0}
                    <div class="editorItems">
                        {#each systemItemsDraft as item (item.id)}
                            <div class="editorRowWrap">
                                <div class="editorRow customRow">
                                    <div class="col sys">{item.defaultLabel}</div>
                                    <input class="col user" type="text" value={item.label} placeholder="Label" on:input={(e) => updateSystemItem(item.id, { label: readValue(e) })} />
                                    <div class="col val readonlyValue" title={item.value}>{item.value || '—'}</div>
                                    <div class="rowActions">
                                        <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(item.id)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(item.id)}>T</button>
                                    </div>
                                </div>
                                {#if modalRowsOpen.has(item.id)}
                                    <div class="modalAccordion">
                                        <textarea class="modalInput" placeholder="Modal text" value={item.modal} on:input={(e) => updateSystemItem(item.id, { modal: readValue(e) })}></textarea>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="editorSectionActions">
                    <button type="button" class="toggleBtn" on:click={addCustomItem}>+ Item</button>
                </div>

                <div class="editorItems">
                    {#if customItemsDraft.length === 0}
                        <div class="editorEmpty">No custom body items.</div>
                    {/if}
                    {#each customItemsDraft as item (item.id)}
                        <div class="editorRowWrap">
                            <div class="editorRow customRow">
                                <div class="col sys">Custom</div>
                                <input class="col user" type="text" value={item.label} placeholder="Label" on:input={(e) => updateCustomItem(item.id, { label: readValue(e) })} />
                                <input class="col val" type="text" value={item.value} placeholder="Value" on:input={(e) => updateCustomItem(item.id, { value: readValue(e) })} />
                                <div class="rowActions">
                                    <button type="button" class="miniBtn modalBtn" aria-expanded={modalRowsOpen.has(item.id)} title="Modal text" on:click|stopPropagation={() => toggleModalRow(item.id)}>T</button>
                                    <button type="button" class="miniBtn dangerBtn" title="Remove item" on:click={() => removeCustomItem(item.id)}>×</button>
                                </div>
                            </div>
                            {#if modalRowsOpen.has(item.id)}
                                <div class="modalAccordion">
                                    <textarea class="modalInput" placeholder="Modal text" value={item.modal} on:input={(e) => updateCustomItem(item.id, { modal: readValue(e) })}></textarea>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>

            <footer class="editorFoot">
                <button type="button" class="navBtn" on:click={resetOverrides}>Reset</button>
                <div class="footActions">
                    <button type="button" class="navBtn" on:click={closeEditor}>Cancel</button>
                    <button type="button" class="navBtn" on:click={applyEditor}>Apply</button>
                </div>
            </footer>
        </div>
    </div>
{/if}

<style>
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
    }

    .editorTitle {
        font-size: 16px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .bodyEmoji {
        font-size: 18px;
    }

    .editorSection {
        display: grid;
        gap: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        border-radius: 12px;
        padding: 10px;
    }

    .sectionTitle {
        font-size: 16px;
        font-weight: 800;
    }

    .editorSectionActions,
    .footActions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }

    .editorItems,
    .editorRowWrap {
        display: grid;
        gap: 6px;
    }

    .editorRow {
        display: grid;
        grid-template-columns: minmax(120px, 0.9fr) minmax(180px, 1.2fr) minmax(110px, 0.8fr) auto;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 9px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
    }

    .staticRow {
        grid-template-columns: minmax(120px, 0.9fr) minmax(220px, 1.3fr) minmax(120px, 0.8fr);
    }

    .customRow {
        grid-template-columns: minmax(120px, 0.9fr) minmax(180px, 1.1fr) minmax(120px, 0.9fr) auto;
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
        padding: 6px 8px;
        color: var(--fg);
        font: inherit;
    }

    .readonlyValue {
        opacity: 0.82;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .editorRowArea {
        display: grid;
        gap: 6px;
    }

    .areaLabel {
        font-size: 12px;
        font-weight: 700;
        opacity: 0.82;
    }

    .modalAccordion {
        border-left: 2px solid color-mix(in oklab, var(--fg), transparent 84%);
        margin-left: 8px;
        padding-left: 10px;
    }

    .modalInput {
        width: 100%;
        min-height: 88px;
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

    .rowActions {
        display: inline-flex;
        gap: 6px;
        align-items: center;
    }

    .miniBtn {
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 78%);
        background: color-mix(in oklab, var(--btn-bg), transparent 12%);
        color: inherit;
    }

    .dangerBtn {
        color: color-mix(in oklab, var(--danger, #ff6b6b), var(--fg) 20%);
    }

    .editorEmpty {
        padding: 10px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
        opacity: 0.8;
        font-size: 12px;
    }

    @media (max-width: 720px) {
        .editorRow,
        .staticRow,
        .customRow {
            grid-template-columns: 1fr;
        }

        .rowActions,
        .editorFoot {
            justify-content: flex-end;
        }

        .editorFoot {
            flex-direction: column-reverse;
            align-items: stretch;
        }

        .footActions {
            width: 100%;
            justify-content: space-between;
        }
    }
</style>
