// src/lib/wheel/compass.ts
import {
    AstroTime,
    Body as EngineBody,
    Equator,
    Horizon,
    Observer
} from 'astronomy-engine';

import { bodies } from '../catalog';
import type { BodyId } from '../catalog';
import type { MarkerItem } from './wheel';

export type CompassObserver = {
    lat: number;
    lon: number;
    heightMeters?: number;
};

export type CompassDbg = {
    log?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
};

export type CompassInput = {
    ts: number;
    looker: BodyId;
    observer: CompassObserver;
    targets: BodyId[];
    refraction?: boolean;

    // NEW
    dbg?: CompassDbg;
};

export type CompassTargetState = {
    id: BodyId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    visible: boolean;

    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
};

export type CompassSolveResult =
    | { ok: true; ts: number; looker: BodyId; observer: CompassObserver; targets: CompassTargetState[] }
    | { ok: false; reason: string; ts: number; looker: BodyId; observer: CompassObserver; targets: CompassTargetState[] };

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

function norm360(deg: number): number {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

function clamp(min: number, x: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

type RefractionMode = 'normal' | 'jplhor' | undefined;

function refractionMode(enabled: boolean, mode: 'normal' | 'jplhor' = 'normal'): RefractionMode {
    return enabled ? mode : undefined;
}

export function computeCompassTargets(input: CompassInput): CompassSolveResult {
    const { ts, looker, observer, targets, refraction = false, dbg } = input;

    dbg?.log?.('computeCompassTargets.in', {
        ts,
        looker,
        observer,
        targets,
        refraction
    });

    if (looker !== 'Earth') {
        const reason = `Compass: topocentric horizon supported only for looker=Earth (got ${String(looker)}).`;
        dbg?.warn?.('computeCompassTargets.fail', reason);

        return {
            ok: false,
            reason,
            ts,
            looker,
            observer,
            targets: []
        };
    }

    const time = new AstroTime(new Date(ts));
    const obs = new Observer(observer.lat, observer.lon, observer.heightMeters ?? 0);

    const out: CompassTargetState[] = [];

    for (const id of targets) {
        try {
            const body = toEngineBody(id);

            const eq = Equator(body, time, obs, true, true);
            const hor = Horizon(time, obs, eq.ra, eq.dec, refractionMode(refraction));

            const az = norm360(hor.azimuth);
            const alt = clamp(-90, hor.altitude, 90);

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
            dbg?.warn?.('computeCompassTargets.targetError', { id, err });
        }
    }

    dbg?.log?.('computeCompassTargets.out', {
        count: out.length,
        ids: out.map(x => x.id),
        sample: out[0]
    });

    return {
        ok: true,
        ts,
        looker,
        observer,
        targets: out
    };
}

export function compassTargetsToMarkerItems(
    ts: number,
    targets: CompassTargetState[],
    looker: BodyId = 'Earth'
): MarkerItem[] {
    const collectionId = `compass:${String(looker)}`;

    return targets.map((t) => {
        const alt = clamp(-90, t.altitudeDeg, 90);

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
            angleDeg: t.azimuthDeg,
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
