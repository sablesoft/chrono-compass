// src/lib/math/compass.ts
import {
    AstroTime,
    Body as EngineBody,
    Equator,
    Horizon,
    Observer
} from 'astronomy-engine';

import { objects } from '../catalog';
import type { ObjId } from '../catalog';
import type { MarkerItem } from '../wheel/wheel'; // если путь у тебя другой — скажи, поправлю

import type { WheelInput, CompassSolveResult, CycleSpoke } from '../board/runtime';
import { resolveWheel } from '../board/dispatcher';
import {clamp, norm360, toSigned180} from "./helpers";
import type { HorizonMeta } from './horizon';

export type CompassTargetState = {
    id: ObjId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    visible: boolean;
    horizonSpokes?: CycleSpoke<HorizonMeta>[];

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

function toEngineBody(id: ObjId): EngineBody {
    return EngineBody[id as keyof typeof EngineBody];
}

type RefractionMode = 'normal' | 'jplhor' | undefined;
function refractionMode(enabled: boolean, mode: 'normal' | 'jplhor' = 'normal'): RefractionMode {
    return enabled ? mode : undefined;
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

    const time = new AstroTime(new Date(ts));
    const obs = new Observer(loc.lat, loc.lon, 0);

    const out = await Promise.all(targets.map(async (id): Promise<CompassTargetState | null> => {
        try {
            const body = toEngineBody(id);

            // refraction пока фикс false (как было в Compass.svelte)
            const eq = Equator(body, time, obs, true, true);
            const hor = Horizon(time, obs, eq.ra, eq.dec, refractionMode(false));

            const az = norm360(hor.azimuth);
            const alt = clamp(hor.altitude, -90, 90);
            const horizonSpokes = await resolveHorizonSpokesForTarget(input, id);

            return {
                id,
                azimuthDeg: az,
                altitudeDeg: alt,
                visible: alt >= 0,
                horizonSpokes,
                raHours: eq.ra,
                decDeg: eq.dec,
                distanceAu: eq.dist
            };
        } catch (err) {
            dbg?.warn?.('solveCompassWheel.targetError', { id, err });
            return null;
        }
    }));

    const bodies = out.filter((x): x is CompassTargetState => !!x);

    dbg?.log?.('solveCompassWheel.out', { count: bodies.length, ids: bodies.map(x => x.id), bodies });

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
        const alt = clamp(t.altitudeDeg, -90,90);

        const orbit = alt >= 0
            ? (90 - alt) / 90
            : 1 + (-alt) / 90;

        const baseId = `body:${String(t.id)}`;
        const emoji = bodyEmoji(t.id);
        const name = bodyNameEn(t.id);

        return {
            id: `compass:${String(looker)}:${String(t.id)}@${ts}`,
            baseId,
            collectionId,

            ts,
            angleDeg: azimuthToWheelAngleDeg(t.azimuthDeg),
            orbit,

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
