import type { CycleSolveResult, CycleSpoke, WheelInput } from '../board/runtime';
import type { ObjId } from '../catalog';
import { cycleSpokeTags } from '../catalog/tags';
import { SPOKES_ORDER } from '../wheel/types';
import { buildSpokeTimes, type Anchors } from '../wheel/spokes';
import { isFiniteNumber } from './helpers';
import { getPlatoAnchors } from './deprecated/plato';

type PlatoMeta = Record<string, never>;

function toTargetId(target: ObjId | ObjId[]): ObjId | null {
    if (Array.isArray(target)) return (target[0] as ObjId | undefined) ?? null;
    return target ?? null;
}

function anchorsToSpokes(a: Anchors): CycleSpoke<PlatoMeta>[] | null {
    const times = buildSpokeTimes(a);
    if (!Array.isArray(times) || times.length !== 17) return null;

    const out: CycleSpoke<PlatoMeta>[] = [];
    for (let i = 0; i < 17; i++) {
        const ts = times[i];
        const code = SPOKES_ORDER[i] ?? (i === 16 ? 'E_next' : 'E');
        if (!isFiniteNumber(ts)) return null;
        if (i > 0 && !(ts > times[i - 1])) return null;
        out.push({
            ts,
            code,
            index: i,
            tags: cycleSpokeTags('plato', code),
            meta: {},
        });
    }
    return out;
}

export function solvePlatoWheel(input: WheelInput<'plato'>): CycleSolveResult<PlatoMeta> {
    const ts = input.ts;
    const fail = (reason: string): CycleSolveResult<PlatoMeta> => ({
        ok: false,
        kind: 'cycle',
        ts,
        reason,
        spokes: [],
    });

    const looker = input.looker as ObjId | undefined;
    const target = toTargetId(input.target as ObjId | ObjId[]);

    if (looker !== 'ref:galactic-center' || target !== 'Earth') {
        return fail('Plato wheel: invalid roles (allowed only looker=ref:galactic-center, target=Earth)');
    }

    const anchors = getPlatoAnchors(ts);
    if (!anchors) return fail('Plato wheel: deprecated solver returned no anchors');

    const spokes = anchorsToSpokes(anchors);
    if (!spokes) return fail('Plato wheel: failed to build spokes from anchors');

    return {
        ok: true,
        kind: 'cycle',
        ts,
        spokes,
    };
}
