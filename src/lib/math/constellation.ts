import { AstroTime, RotateVector, Rotation_EQD_EQJ, Rotation_EQJ_EQD, Vector } from 'astronomy-engine';
import type {
    ConstellationMeta,
    ConstellationObj,
    ConstellationPolygonEpoch,
    ConstellationVertex,
    Obj
} from '../catalog';

export type ConstellationCatalogEntry = {
    id: ConstellationObj['id'];
    name: string;
    meta: ConstellationMeta;
};

export type ConstellationHit = {
    id: ConstellationObj['id'];
    name: string;
    abbr: string;
    band: ConstellationMeta['band'];
    polygonEpoch: ConstellationPolygonEpoch;
    polygonIndex: number;
    raDeg: number;
    decDeg: number;
};

// NOTE:
// Delporte constellation boundaries are historically defined for epoch B1875.
// We use a UTC approximation for B1875.0 as a practical conversion anchor.
const B1875_APPROX_UTC = new Date('1875-01-01T00:00:00.000Z');

function norm360(deg: number): number {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

function unitFromRaDecDeg(raDeg: number, decDeg: number): Vector {
    const raRad = (norm360(raDeg) * Math.PI) / 180;
    const decRad = (decDeg * Math.PI) / 180;
    const cosDec = Math.cos(decRad);
    return new Vector(
        cosDec * Math.cos(raRad),
        cosDec * Math.sin(raRad),
        Math.sin(decRad),
        new AstroTime(new Date('2000-01-01T12:00:00.000Z'))
    );
}

function raDecFromVector(vec: Vector): { raDeg: number; decDeg: number } {
    const x = Number(vec.x);
    const y = Number(vec.y);
    const z = Number(vec.z);
    const raDeg = norm360((Math.atan2(y, x) * 180) / Math.PI);
    const decDeg = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
    return { raDeg, decDeg };
}

function toPolygonEpochRaDec(opts: {
    raDeg: number;
    decDeg: number;
    ts: number;
    polygonEpoch: ConstellationPolygonEpoch;
}): { raDeg: number; decDeg: number } {
    const time = new AstroTime(new Date(opts.ts));
    const qEqd = unitFromRaDecDeg(opts.raDeg, opts.decDeg);

    // Convert observed/of-date equator into J2000 base frame.
    const eqdToEqj = Rotation_EQD_EQJ(time);
    const qEqj = RotateVector(eqdToEqj, qEqd);

    if (opts.polygonEpoch === 'J2000') {
        return raDecFromVector(qEqj);
    }

    // Convert J2000 into B1875-like equator frame for boundary matching.
    const eqjToB1875 = Rotation_EQJ_EQD(B1875_APPROX_UTC);
    const qB1875 = RotateVector(eqjToB1875, qEqj);
    return raDecFromVector(qB1875);
}

function unwrapRaAround(raDeg: number, anchorRaDeg: number): number {
    let x = raDeg;
    while (x - anchorRaDeg > 180) x -= 360;
    while (x - anchorRaDeg < -180) x += 360;
    return x;
}

function unwrapPolygonRaContinuously(polygon: ConstellationVertex[]): Array<{ x: number; y: number }> {
    if (!polygon.length) return [];
    const out: Array<{ x: number; y: number }> = [];
    let prevX = norm360(polygon[0].raDeg);
    out.push({ x: prevX, y: polygon[0].decDeg });
    for (let i = 1; i < polygon.length; i++) {
        let x = norm360(polygon[i].raDeg);
        while (x - prevX > 180) x -= 360;
        while (x - prevX < -180) x += 360;
        out.push({ x, y: polygon[i].decDeg });
        prevX = x;
    }
    return out;
}

function pointInPolygonRaDec(
    point: { raDeg: number; decDeg: number },
    polygon: ConstellationVertex[]
): boolean {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    const py = point.decDeg;
    const verts = unwrapPolygonRaContinuously(polygon);
    if (verts.length < 3) return false;

    // Fast reject by axis-aligned bounding box in unwrapped RA/Dec space.
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    const centerX = (minX + maxX) * 0.5;
    const px = unwrapRaAround(point.raDeg, centerX);
    if (px < minX || px > maxX || py < minY || py > maxY) return false;

    // Standard even-odd ray casting in the local (RA, Dec) chart.
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x;
        const yi = verts[i].y;
        const xj = verts[j].x;
        const yj = verts[j].y;
        const crosses = ((yi > py) !== (yj > py))
            && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi);
        if (crosses) inside = !inside;
    }
    return inside;
}

export function constellationEntriesFromObjects(input: Partial<Record<string, Obj>>): ConstellationCatalogEntry[] {
    const out: ConstellationCatalogEntry[] = [];
    for (const obj of Object.values(input)) {
        if (!obj || obj.kind !== 'constellation') continue;
        const meta = obj.meta as ConstellationMeta | undefined;
        if (!meta) continue;
        if (!Array.isArray(meta.polygons) || meta.polygons.length === 0) continue;
        out.push({
            id: obj.id,
            name: obj.name,
            meta
        });
    }
    return out;
}

export function findConstellationByRaDec(opts: {
    raDeg: number;
    decDeg: number;
    ts: number;
    constellations: ConstellationCatalogEntry[];
}): ConstellationHit | null {
    if (!Number.isFinite(opts.raDeg) || !Number.isFinite(opts.decDeg) || !Number.isFinite(opts.ts)) {
        return null;
    }

    const pointByEpoch = new Map<ConstellationPolygonEpoch, { raDeg: number; decDeg: number }>();
    const pointAt = (epoch: ConstellationPolygonEpoch) => {
        const cached = pointByEpoch.get(epoch);
        if (cached) return cached;
        const converted = toPolygonEpochRaDec({
            raDeg: opts.raDeg,
            decDeg: opts.decDeg,
            ts: opts.ts,
            polygonEpoch: epoch
        });
        pointByEpoch.set(epoch, converted);
        return converted;
    };

    for (const c of opts.constellations) {
        const meta = c.meta;
        const testPoint = pointAt(meta.polygonEpoch);
        for (let polygonIndex = 0; polygonIndex < meta.polygons.length; polygonIndex++) {
            const polygon = meta.polygons[polygonIndex];
            if (!pointInPolygonRaDec(testPoint, polygon)) continue;
            return {
                id: c.id,
                name: c.name,
                abbr: meta.abbr,
                band: meta.band,
                polygonEpoch: meta.polygonEpoch,
                polygonIndex,
                raDeg: testPoint.raDeg,
                decDeg: testPoint.decDeg
            };
        }
    }

    return null;
}
