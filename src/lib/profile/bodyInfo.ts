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

type BodyOverrideMap = Partial<Record<ObjId, BodyUserOverride>>;

function catalogBody(id: ObjId): {
    name?: string;
    description?: string;
    emoji?: string;
    meta?: { color?: string } & Partial<ReferenceMeta>;
} | null {
    return ((objects as any)?.[id] ?? null) as {
        name?: string;
        description?: string;
        emoji?: string;
        meta?: { color?: string } & Partial<ReferenceMeta>;
    } | null;
}

function trimText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function itemIdFromLabel(label: string): string {
    const key = String(label ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return `system:${key || 'item'}`;
}

export function bodyOverrideRecord(overrides: BodyOverrideMap | null | undefined, id: ObjId): BodyUserOverride | null {
    const entry = overrides?.[id];
    return entry && typeof entry === 'object' ? entry : null;
}

export function resolveBodyName(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const custom = trimText(bodyOverrideRecord(overrides, id)?.name?.en);
    if (custom) return custom;
    const body = catalogBody(id);
    return trimText(body?.name) || String(id);
}

export function resolveBodyEmoji(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const custom = trimText(bodyOverrideRecord(overrides, id)?.emoji);
    if (custom) return custom;
    return trimText(catalogBody(id)?.emoji) || '•';
}

export function resolveBodyDescription(id: ObjId, overrides: BodyOverrideMap | null | undefined): string {
    const custom = trimText(bodyOverrideRecord(overrides, id)?.description?.en);
    if (custom) return custom;
    return trimText(catalogBody(id)?.description);
}

export function resolveBodyDescriptionLabel(id: ObjId, overrides: BodyOverrideMap | null | undefined, lang = 'en'): string {
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

export function resolveBodyCustomInfoItems(id: ObjId, overrides: BodyOverrideMap | null | undefined): BodyInfoChip[] {
    const raw = bodyOverrideRecord(overrides, id)?.infoItems;
    if (!Array.isArray(raw)) return [];
    return raw.reduce<BodyInfoChip[]>((items, item: BodyUserInfoItem, index: number) => {
            const itemId = trimText(item?.id) || `custom:${index}`;
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

export function resolveBodyInfoItems(id: ObjId, overrides: BodyOverrideMap | null | undefined, lang = 'en'): BodyInfoChip[] {
    const items: BodyInfoChip[] = [];
    const description = resolveBodyDescription(id, overrides);
    if (description) {
        items.push({
            id: 'system:description',
            label: resolveBodyDescriptionLabel(id, overrides, lang),
            modal: description
        });
    }

    const distancePc = resolveBodyDistancePc(id);
    if (Number.isFinite(distancePc)) {
        const distanceAu = distancePc * 3.26156 * AU_PER_LY;
        const starMeta: Record<string, number> = { distanceAu };
        for (const def of STAR_INFO_ITEMS) {
            const label = trimText(def.defaultLabel ?? def.label);
            if (!label || !def.metaField) continue;
            const raw = starMeta[def.metaField];
            const value = formatInfoValue(def.format, raw);
            if (!value || value === '—') continue;
            items.push({
                id: itemIdFromLabel(label),
                label,
                value,
                modal: typeof def.modal === 'string' ? def.modal : undefined
            });
        }
    }

    items.push(...resolveBodyCustomInfoItems(id, overrides));
    return items;
}

export function resolveBodyColor(id: ObjId): string | undefined {
    const color = trimText(catalogBody(id)?.meta?.color);
    return color || undefined;
}
