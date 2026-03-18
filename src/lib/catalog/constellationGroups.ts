import { objects } from './objects';
import { objectLabel, type ConstellationRefId, type ObjId, type StarObj } from './types';

export type ConstellationTargetGroup = {
    id: ConstellationRefId;
    label: string;
    itemIds: ObjId[];
};

export function constellationIdsForTarget(id: ObjId): readonly ConstellationRefId[] {
    const item = objects[id];
    if (!item || item.kind !== 'star') return [];
    const star = item as StarObj;
    return [star.meta.constellationId];
}

export function buildConstellationTargetGroups(targetIds: ObjId[]): ConstellationTargetGroup[] {
    if (targetIds.length === 0) return [];

    const uniqueTargets = Array.from(new Set(targetIds));
    const byConstellation = new Map<ConstellationRefId, ObjId[]>();

    for (const targetId of uniqueTargets) {
        for (const constellationId of constellationIdsForTarget(targetId)) {
            const ids = byConstellation.get(constellationId) ?? [];
            ids.push(targetId);
            byConstellation.set(constellationId, ids);
        }
    }

    return Array.from(byConstellation.entries())
        .map(([constellationId, ids]) => ({
            id: constellationId,
            label: objectLabel(constellationId),
            itemIds: ids.sort((a, b) => objectLabel(a).localeCompare(objectLabel(b)))
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}
