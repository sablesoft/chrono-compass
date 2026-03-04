import { wheels } from './wheels';
import type { WheelType } from './types';
import type { SpokeKey } from '../wheel/types';

type CycleTaggedWheelType = Extract<WheelType, 'compass' | 'synod' | 'bind' | 'horizon' | 'nodal' | 'season' | 'plato'>;

function uniqueTags(tags: Array<string | null | undefined>): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of tags) {
        if (typeof raw !== 'string') continue;
        const tag = raw.trim();
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
    }
    return out;
}

export function cycleSpokeTags(wheelType: CycleTaggedWheelType, code: SpokeKey): string[] {
    const spec = (wheels as any)[wheelType] as { info?: Array<{ defaultLabel?: string; spokes?: SpokeKey[] | '*' }> } | undefined;
    const defs = Array.isArray(spec?.info) ? spec.info : [];

    const fromSpec = defs
        .filter((row) => {
            if (!row) return false;
            if (row.spokes === '*') return true;
            return Array.isArray(row.spokes) && row.spokes.includes(code);
        })
        .map((row) => String(row?.defaultLabel ?? '').trim())
        .filter(Boolean);

    return uniqueTags([...fromSpec, `${code}-${wheelType}`]);
}

export function momentTagChipId(value: string): string {
    return `moment:${String(value ?? '').trim()}`;
}
