// src/lib/compass.ts
import {
    AstroTime,
    Body as EngineBody,
    Equator,
    Horizon,
    Observer
} from 'astronomy-engine';

import { bodies } from './catalog';
import type { BodyId } from './catalog';
import type { MarkerItem } from './wheel/wheel'; // если путь у тебя другой — скажи, поправлю

import type { WheelInput, CompassSolveResult } from './board/runtime';
import {clamp, norm360, toSigned180} from "./math/helpers";

export type CompassTargetState = {
    id: BodyId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    visible: boolean;

    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
};

function bodyEmoji(id: BodyId): string {
    const b = (bodies as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyNameEn(id: BodyId): string {
    const b = (bodies as any)[id] as { name?: { en?: string } } | undefined;
    return b?.name?.en ?? String(id);
}

function toEngineBody(id: BodyId): EngineBody {
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
 * - targets из WheelInput.target (BodyId или BodyId[])
 * - observer из WheelInput.location (lat/lon)
 *
 * Возвращает:
 * - CompassSolveResult из board/runtime: kind='compass', bodies=[]
 */
export function solveCompassWheel(input: WheelInput): CompassSolveResult<CompassTargetState> {
    const dbg = input.dbg;

    const ts = input.ts;
    const looker = (input.looker ?? 'Earth') as BodyId;

    const loc = input.location;
    if (!loc) {
        const reason = 'Compass wheel requires location (input.location is missing).';
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    // targets из input.target (обязателен по твоему правилу)
    const rawTarget = input.target;
    const targets: BodyId[] = Array.isArray(rawTarget) ? rawTarget : [rawTarget];

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

    const out: CompassTargetState[] = [];

    for (const id of targets) {
        try {
            const body = toEngineBody(id);

            // refraction пока фикс false (как было в Compass.svelte)
            const eq = Equator(body, time, obs, true, true);
            const hor = Horizon(time, obs, eq.ra, eq.dec, refractionMode(false));

            const az = norm360(hor.azimuth);
            const alt = clamp(hor.altitude, -90, 90);

            out.push({
                id,
                azimuthDeg: az,
                altitudeDeg: alt,
                visible: alt >= 0,
                raHours: eq.ra,
                decDeg: eq.dec,
                distanceAu: eq.dist
            });
        } catch (err) {
            dbg?.warn?.('solveCompassWheel.targetError', { id, err });
        }
    }

    dbg?.log?.('solveCompassWheel.out', { count: out.length, ids: out.map(x => x.id) });

    return { ok: true, kind: 'compass', ts, bodies: out };
}

/**
 * Convert geodetic azimuth (0=N, 90=E) -> wheel angle for your SVG geom
 * (0=E, -90=N, ±180=W, +90=S).
 */
function azimuthToWheelAngleDeg(azimuthDeg: number): number {
    return toSigned180(azimuthDeg - 90);
}

/**
 * UI helper (как и раньше): вычисленные bodies -> MarkerItem[]
 * Эту штуку обычно дергает Compass.svelte.
 */
export function compassTargetsToMarkerItems(
    ts: number,
    targets: CompassTargetState[],
    looker: BodyId = 'Earth'
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
