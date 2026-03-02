import type { CycleSolveResult, CycleSpoke, WheelInput } from '../board/runtime';
import type { ObjId } from '../catalog';
import { cycleSpokeTags } from '../catalog/tags';
import { SPOKES_ORDER } from '../wheel/types';
import { buildSpokeTimes, type Anchors } from '../wheel/spokes';
import { isFiniteNumber } from './helpers';
import { getTropicalAnchors } from './deprecated/solarTropical';

type SeasonMeta = Record<string, never>;

function toTargetId(target: ObjId | ObjId[]): ObjId | null {
    if (Array.isArray(target)) return (target[0] as ObjId | undefined) ?? null;
    return target ?? null;
}

function anchorsToSpokes(a: Anchors): CycleSpoke<SeasonMeta>[] | null {
    const times = buildSpokeTimes(a);
    if (!Array.isArray(times) || times.length !== 17) return null;

    const out: CycleSpoke<SeasonMeta>[] = [];
    for (let i = 0; i < 17; i++) {
        const ts = times[i];
        const code = SPOKES_ORDER[i] ?? (i === 16 ? 'E_next' : 'E');
        if (!isFiniteNumber(ts)) return null;
        if (i > 0 && !(ts > times[i - 1])) return null;
        out.push({
            ts,
            code,
            index: i,
            tags: cycleSpokeTags('season', code),
            meta: {},
        });
    }
    return out;
}

export function solveSeasonWheel(input: WheelInput<'season'>): CycleSolveResult<SeasonMeta> {
    const ts = input.ts;
    const fail = (reason: string): CycleSolveResult<SeasonMeta> => ({
        ok: false,
        kind: 'cycle',
        ts,
        reason,
        spokes: [],
    });

    const focus = input.focus as ObjId | undefined;
    const target = toTargetId(input.target as ObjId | ObjId[]);

    if (focus !== 'Sun' || target !== 'Earth') {
        return fail('Season wheel: invalid roles (allowed only focus=Sun, target=Earth)');
    }

    const anchors = getTropicalAnchors(ts, 0, 0);
    if (!anchors) return fail('Season wheel: deprecated solver returned no anchors');

    const spokes = anchorsToSpokes(anchors);
    if (!spokes) return fail('Season wheel: failed to build spokes from anchors');

    return {
        ok: true,
        kind: 'cycle',
        ts,
        spokes,
    };
}
