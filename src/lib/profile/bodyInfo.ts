import { objects, type ObjId, type ReferenceMeta } from '../catalog';
import { STAR_INFO_ITEMS } from '../catalog/starInfoItems';
import { AU_PER_LY } from '../math/helpers';
import { formatInfoValue } from '../wheel/infoFormat';
import type { BodyUserInfoItem, BodyUserOverride } from './types';

export type BodyInfoChip = {
    id: string;
    label: string;
    value?: string;
    modal?: string;
};

type ResolveBodyStarInfoItemsOptions = {
    includeEmpty?: boolean;
};

type BodyOverrideMap = Partial<Record<ObjId, BodyUserOverride>>;
export const DEFAULT_EMOJI_SCALE = 0.7;

function catalogBody(id: ObjId): {
    kind?: 'engine_body' | 'reference' | 'star' | 'pole' | 'constellation';
    name?: string;
    description?: string;
    emoji?: string;
    emojiScale?: number;
    meta?: { color?: string } & Partial<ReferenceMeta>;
} | null {
    return ((objects as any)?.[id] ?? null) as {
        kind?: 'engine_body' | 'reference' | 'star' | 'pole' | 'constellation';
        name?: string;
        description?: string;
        emoji?: string;
        emojiScale?: number;
        meta?: { color?: string } & Partial<ReferenceMeta>;
    } | null;
}

function trimText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function bodyInfoItemIdFromLabel(label: string): string {
    const key = String(label ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return `system:${key || 'item'}`;
}

export function isSystemBodyInfoItemId(id: string): boolean {
    return String(id ?? '').trim().startsWith('system:');
}

export function bodyOverrideRecord(overrides: BodyOverrideMap | null | undefined, id: ObjId): BodyUserOverride | null {
    const entry = overrides?.[id];
    return entry && typeof entry === 'object' ? entry : null;
}

export function resolveBodyName(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const record = bodyOverrideRecord(overrides, id);
    // TODO - remove legacy profile fallback after demo data update.
    const custom = trimText(record?.name) || trimText((record as { name?: { en?: string } } | null)?.name?.en);
    if (custom) return custom;
    const body = catalogBody(id);
    return trimText(body?.name) || String(id);
}

export function resolveBodyEmoji(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const custom = trimText(bodyOverrideRecord(overrides, id)?.emoji);
    if (custom) return custom;
    return trimText(catalogBody(id)?.emoji) || '•';
}

export function resolveBodyEmojiScale(id: ObjId): number {
    const raw = Number(catalogBody(id)?.emojiScale);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return DEFAULT_EMOJI_SCALE;
}

export function resolveBodyDescription(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const record = bodyOverrideRecord(overrides, id);
    // TODO - remove legacy profile fallback after demo data update.
    const custom = trimText(record?.description) || trimText((record as { description?: { en?: string } } | null)?.description?.en);
    if (custom) return custom;
    return trimText(catalogBody(id)?.description);
}

export function resolveBodyDescriptionLabel(
    id: ObjId,
    overrides: BodyOverrideMap | null | undefined,
    lang = 'en',
    sharedDescriptionLabel?: string | null
): string {
    const shared = trimText(sharedDescriptionLabel);
    if (shared) return shared;
    const custom = trimText(bodyOverrideRecord(overrides, id)?.descriptionLabel);
    if (custom) return custom;
    return lang === 'ru' ? 'Описание' : 'Description';
}

export function resolveBodyDistanceLy(id: ObjId): number {
    const distancePc = resolveBodyDistancePc(id);
    return Number.isFinite(distancePc) && distancePc > 0 ? distancePc * 3.26156 : NaN;
}

export function resolveBodyDistancePc(id: ObjId): number {
    const meta = catalogBody(id)?.meta;
    const distancePc = Number((meta as any)?.distancePc);
    if (Number.isFinite(distancePc) && distancePc > 0) return distancePc;
    const distanceLy = Number((meta as any)?.distanceLy);
    return Number.isFinite(distanceLy) && distanceLy > 0 ? distanceLy / 3.26156 : NaN;
}

export function resolveBodyDistanceLyLabel(id: ObjId, overrides: BodyOverrideMap | null | undefined, lang = 'en'): string {
    const custom = trimText(bodyOverrideRecord(overrides, id)?.distanceLyLabel);
    if (custom) return custom;
    return lang === 'ru' ? 'Расстояние' : 'Distance';
}

function bodyInfoOverrideItems(overrides: BodyOverrideMap | null | undefined, id: ObjId): Map<string, BodyUserInfoItem> {
    const raw = bodyOverrideRecord(overrides, id)?.infoItems;
    if (!Array.isArray(raw)) return new Map();
    return raw.reduce<Map<string, BodyUserInfoItem>>((map, item) => {
        const itemId = trimText(item?.id);
        if (!itemId) return map;
        map.set(itemId, item);
        return map;
    }, new Map());
}

function sharedStarInfoOverrideItems(sharedInfoItems: BodyUserInfoItem[] | null | undefined): Map<string, BodyUserInfoItem> {
    if (!Array.isArray(sharedInfoItems)) return new Map();
    return sharedInfoItems.reduce<Map<string, BodyUserInfoItem>>((map, item) => {
        const itemId = trimText(item?.id);
        if (!itemId || !isSystemBodyInfoItemId(itemId)) return map;
        map.set(itemId, item);
        return map;
    }, new Map());
}

function starMetaRecord(id: ObjId): Record<string, number> | null {
    const distancePc = resolveBodyDistancePc(id);
    if (!Number.isFinite(distancePc)) return null;
    const apparentMagnitude = Number((catalogBody(id)?.meta as Partial<ReferenceMeta> | undefined)?.apparentMagnitude);
    const distanceAu = distancePc * 3.26156 * AU_PER_LY;
    const starMeta: Record<string, number> = { distanceAu };
    if (Number.isFinite(apparentMagnitude)) {
        starMeta.apparentMagnitude = apparentMagnitude;
    }
    return starMeta;
}

export function resolveBodyStarInfoItems(
    id: ObjId,
    overrides: BodyOverrideMap | null | undefined,
    sharedInfoItems?: BodyUserInfoItem[] | null,
    opts?: ResolveBodyStarInfoItemsOptions
): BodyInfoChip[] {
    const starMeta = starMetaRecord(id);
    const includeEmpty = !!opts?.includeEmpty;
    if (!starMeta && !includeEmpty) return [];
    const sharedOverrideItems = sharedStarInfoOverrideItems(sharedInfoItems);
    const legacyBodyOverrideItems = bodyInfoOverrideItems(overrides, id);
    const overrideItems = sharedOverrideItems.size > 0 ? sharedOverrideItems : legacyBodyOverrideItems;

    // STAR_INFO_ITEMS defines only catalog defaults; editor/runtime need merged rows with profile overrides.
    return STAR_INFO_ITEMS.reduce<BodyInfoChip[]>((items, def) => {
        const defaultLabel = trimText(def.defaultLabel ?? def.label);
        if (!defaultLabel || !def.metaField) return items;
        const raw = starMeta?.[def.metaField];
        const value = formatInfoValue(def.format, raw);
        if ((!value || value === '—') && !includeEmpty) return items;
        const itemId = bodyInfoItemIdFromLabel(defaultLabel);
        const override = overrideItems.get(itemId);
        const label = trimText(override?.label) || defaultLabel;
        const modal = trimText(override?.modal) || trimText(def.modal);
        items.push({
            id: itemId,
            label,
            value: value && value !== '—' ? value : undefined,
            modal: modal || undefined
        });
        return items;
    }, []);
}

export function resolveBodyCustomInfoItems(id: ObjId, overrides: BodyOverrideMap | null | undefined): BodyInfoChip[] {
    const raw = bodyOverrideRecord(overrides, id)?.infoItems;
    if (!Array.isArray(raw)) return [];
    return raw.reduce<BodyInfoChip[]>((items, item: BodyUserInfoItem, index: number) => {
            const itemId = trimText(item?.id) || `custom:${index}`;
            if (isSystemBodyInfoItemId(itemId)) return items;
            const label = trimText(item?.label);
            const value = trimText(item?.value);
            const modal = trimText(item?.modal);
            if (!label) return items;
            if (!value && !modal) return items;
            items.push({
                id: itemId,
                label,
                value: value || undefined,
                modal: modal || undefined
            } satisfies BodyInfoChip);
            return items;
        }, []);
}

export function resolveBodyInfoItems(
    id: ObjId,
    overrides: BodyOverrideMap | null | undefined,
    lang = 'en',
    sharedInfoItems?: BodyUserInfoItem[] | null,
    sharedDescriptionLabel?: string | null
): BodyInfoChip[] {
    const items: BodyInfoChip[] = [];
    const description = resolveBodyDescription(id, overrides);
    if (description) {
        items.push({
            id: 'system:description',
            label: resolveBodyDescriptionLabel(id, overrides, lang, sharedDescriptionLabel),
            modal: description
        });
    }

    items.push(...resolveBodyStarInfoItems(id, overrides, sharedInfoItems));
    items.push(...resolveBodyCustomInfoItems(id, overrides));
    return items;
}

export function resolveBodyColor(id: ObjId): string | undefined {
    const color = trimText(catalogBody(id)?.meta?.color);
    return color || undefined;
}
