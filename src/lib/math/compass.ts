// src/lib/math/compass.ts
import { objects } from '../catalog';
import type { ObjId } from '../catalog';
import type { MarkerItem } from '../wheel/wheel'; // если путь у тебя другой — скажи, поправлю

import type { WheelInput, CompassSolveResult, CycleSpoke } from '../board/runtime';
import { resolveWheel } from '../board/dispatcher';
import {toSigned180} from "./helpers";
import { computeHorizonInstant, type HorizonMeta } from './horizon';

export type CompassTrackPoint = {
    ts: number;
    index: number;
    code: string;
    azimuthDeg: number;
    altitudeDeg: number;
    angleDeg: number;
    orbit: number;
    visible: boolean;
};

export type CompassTargetState = {
    id: ObjId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    angleDeg: number;     // wheel angle from azimuth
    orbit: number;        // radial coefficient [0..2]
    visible: boolean;
    cycleSpokes?: CycleSpoke<HorizonMeta>[];
    orbitTrack?: CompassTrackPoint[];

    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
};

function bodyEmoji(id: ObjId): string {
    const b = (objects as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyNameEn(id: ObjId): string {
    const b = (objects as any)[id] as { name?: { en?: string } } | undefined;
    return b?.name?.en ?? String(id);
}

/**
 * Главный solver для registry/runtime.
 * Берёт:
 * - ts из WheelInput
 * - looker из WheelInput (по умолчанию Earth)
 * - targets из WheelInput.target (ObjId или ObjId[])
 * - observer из WheelInput.location (lat/lon)
 *
 * Возвращает:
 * - CompassSolveResult из board/runtime: kind='compass', objects=[]
 */
function locationCacheKeyPart(loc: WheelInput['location']): string {
    if (typeof loc?.id === 'string' && loc.id.trim()) return loc.id;
    return 'loc:system';
}

async function resolveHorizonSpokesForTarget(input: WheelInput, target: ObjId): Promise<CycleSpoke<HorizonMeta>[] | undefined> {
    const loc = input.location;
    if (!loc) return undefined;

    const virtualHorizonWheel = {
        wheelType: 'horizon' as const,
        roles: { looker: 'Earth', target },
        observer: { locationId: locationCacheKeyPart(loc) }
    };

    const res = await resolveWheel(virtualHorizonWheel as any, {
        ts: input.ts,
        location: loc,
        dbg: input.dbg
    });

    if (!res || res.kind !== 'cycle' || !res.ok) return undefined;
    return res.spokes as CycleSpoke<HorizonMeta>[];
}

function buildTrackFromHorizonSpokes(spokes: CycleSpoke<HorizonMeta>[] | undefined): CompassTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: CompassTrackPoint[] = [];
    for (const s of spokes) {
        const az = Number(s.meta?.azimuthDeg);
        const alt = Number(s.meta?.altitudeDeg);
        const orbit = Number(s.meta?.orbit);
        if (!Number.isFinite(az) || !Number.isFinite(alt) || !Number.isFinite(orbit)) continue;

        out.push({
            ts: s.ts,
            index: s.index,
            code: s.code,
            azimuthDeg: az,
            altitudeDeg: alt,
            angleDeg: azimuthToWheelAngleDeg(az),
            orbit,
            visible: alt >= 0
        });
    }
    return out;
}

export async function solveCompassWheel(input: WheelInput): Promise<CompassSolveResult<CompassTargetState>> {
    const dbg = input.dbg;

    const ts = input.ts;
    const looker = (input.looker ?? 'Earth') as ObjId;

    const loc = input.location;
    if (!loc) {
        const reason = 'Compass wheel requires location (input.location is missing).';
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    // targets из input.target (обязателен по твоему правилу)
    const rawTarget = input.target;
    const targets: ObjId[] = Array.isArray(rawTarget) ? rawTarget : [rawTarget];

    dbg?.log?.('solveCompassWheel.in', { ts, looker, targets, loc });

    if (looker !== 'Earth') {
        const reason = `Compass: topocentric horizon supported only for looker=Earth (got ${String(looker)}).`;
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    if (!targets.length) {
        const reason = 'Compass: target list is empty.';
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    const out = await Promise.all(targets.map(async (id): Promise<CompassTargetState | null> => {
        try {
            const instant = computeHorizonInstant({
                ts,
                looker,
                target: id,
                location: loc
            });
            if (!instant) return null;

            const cycleSpokes = await resolveHorizonSpokesForTarget(input, id);
            const orbitTrack = buildTrackFromHorizonSpokes(cycleSpokes);

            return {
                id,
                azimuthDeg: instant.azimuthDeg,
                altitudeDeg: instant.altitudeDeg,
                angleDeg: azimuthToWheelAngleDeg(instant.azimuthDeg),
                orbit: instant.orbit,
                visible: instant.visible,
                cycleSpokes,
                orbitTrack,
                raHours: instant.raHours,
                decDeg: instant.decDeg,
                distanceAu: instant.distanceAu
            };
        } catch (err) {
            dbg?.warn?.('solveCompassWheel.targetError', { id, err });
            return null;
        }
    }));

    const bodies = out.filter((x): x is CompassTargetState => !!x);

    dbg?.log?.('solveCompassWheel.out', { count: bodies.length, ids: bodies.map(x => x.id) });

    return { ok: true, kind: 'compass', ts, bodies };
}

/**
 * Convert geodetic azimuth (0=N, 90=E) -> wheel angle for your SVG geom
 * (0=E, -90=N, ±180=W, +90=S).
 */
function azimuthToWheelAngleDeg(azimuthDeg: number): number {
    return toSigned180(azimuthDeg - 90);
}

/**
 * UI helper (как и раньше): вычисленные objects -> MarkerItem[]
 * Эту штуку обычно дергает Compass.svelte.
 */
export function compassTargetsToMarkerItems(
    ts: number,
    targets: CompassTargetState[],
    looker: ObjId = 'Earth'
): MarkerItem[] {
    const collectionId = `compass:${String(looker)}`;

    return targets.map((t) => {
        const baseId = `body:${String(t.id)}`;
        const emoji = bodyEmoji(t.id);
        const name = bodyNameEn(t.id);

        return {
            id: `compass:${String(looker)}:${String(t.id)}@${ts}`,
            baseId,
            collectionId,

            ts,
            angleDeg: t.angleDeg,
            orbit: t.orbit,

            bg: 'transparent',
            emoji,

            title: name,
            description: t.visible
                ? `Alt ${t.altitudeDeg.toFixed(1)}°, Az ${t.azimuthDeg.toFixed(1)}°`
                : `Below horizon (${t.altitudeDeg.toFixed(1)}°)`,

            opacity: t.visible ? 1 : 0.6
        };
    });
}
