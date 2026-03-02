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
    const spec = (wheels as any)[wheelType] as { tags?: Array<{ value?: string; spokes?: string[] }> } | undefined;
    const defs = Array.isArray(spec?.tags) ? spec.tags : [];

    const fromSpec = defs
        .filter((row) => Array.isArray(row?.spokes) && row.spokes.includes(code))
        .map((row) => String(row?.value ?? '').trim())
        .filter(Boolean);

    return uniqueTags([...fromSpec, `${code}-${wheelType}`]);
}
