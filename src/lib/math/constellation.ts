import { AstroTime, RotateVector, Rotation_EQD_EQJ, Rotation_EQJ_EQD, Vector } from 'astronomy-engine';
import type {
    ConstellationMeta,
    ConstellationObj,
    ConstellationPolygonLayerId,
    ConstellationPolygonEpoch,
    ConstellationVertex,
    Obj
} from '../catalog';

export type ConstellationCatalogEntry = {
    id: ConstellationObj['id'];
    name: string;
    description?: string;
    emoji?: string;
    meta: ConstellationMeta;
};

export type ConstellationHit = {
    id: ConstellationObj['id'];
    name: string;
    description?: string;
    emoji?: string;
    abbr: string;
    band: ConstellationMeta['band'];
    polygonEpoch: ConstellationPolygonEpoch;
    polygonIndex: number;
    boundaryLayer: ConstellationPolygonLayerId;
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

type UnitVec = { x: number; y: number; z: number };

type ConstellationBoundarySegment = {
    from: UnitVec;
    to: UnitVec;
    normal: UnitVec | null;
    arcDeg: number;
};

type ConstellationPolygonPrepared = {
    segments: ConstellationBoundarySegment[];
    vertices: UnitVec[];
};

type ChartVertex = {
    raDeg: number;
    decDeg: number;
};

function toUnit(vec: Vector | UnitVec): UnitVec | null {
    const x = Number(vec.x);
    const y = Number(vec.y);
    const z = Number(vec.z);
    const m = Math.hypot(x, y, z);
    if (!(m > 0) || !Number.isFinite(m)) return null;
    return { x: x / m, y: y / m, z: z / m };
}

function dot(a: UnitVec, b: UnitVec): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: UnitVec, b: UnitVec): UnitVec {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function normalize(v: UnitVec): UnitVec | null {
    return toUnit(v);
}

function angularDeg(a: UnitVec, b: UnitVec): number {
    const c = Math.max(-1, Math.min(1, dot(a, b)));
    return (Math.acos(c) * 180) / Math.PI;
}

type PlaneBasis = {
    east: UnitVec;
    north: UnitVec;
};

function buildPlaneBasis(point: UnitVec): PlaneBasis | null {
    const up = Math.abs(point.z) < 0.99
        ? ({ x: 0, y: 0, z: 1 } as const)
        : ({ x: 0, y: 1, z: 0 } as const);
    const east = normalize(cross(up, point));
    if (!east) return null;
    const north = normalize(cross(point, east));
    if (!north) return null;
    return { east, north };
}

function preparePolygonSpherical(polygon: ConstellationVertex[]): ConstellationPolygonPrepared | null {
    if (!Array.isArray(polygon) || polygon.length < 3) return null;
    const sampled = samplePolygonChartVertices(polygon);
    if (sampled.length < 3) return null;

    const vertices: UnitVec[] = [];
    for (const v of sampled) {
        const u = toUnit(unitFromRaDecDeg(v.raDeg, v.decDeg));
        if (!u) return null;
        vertices.push(u);
    }
    if (vertices.length < 3) return null;

    const segments: ConstellationBoundarySegment[] = [];
    for (let i = 0; i < vertices.length; i++) {
        const from = vertices[i];
        const to = vertices[(i + 1) % vertices.length];
        const n = normalize(cross(from, to));
        segments.push({
            from,
            to,
            normal: n,
            arcDeg: angularDeg(from, to)
        });
    }

    return { segments, vertices };
}

function samplePolygonChartVertices(polygon: ConstellationVertex[]): ChartVertex[] {
    const unwrapped = unwrapPolygonRaContinuously(polygon);
    if (unwrapped.length < 3) return [];

    const out: ChartVertex[] = [];
    const maxStepDeg = 1;

    for (let i = 0; i < unwrapped.length; i++) {
        const a = unwrapped[i];
        const b = unwrapped[(i + 1) % unwrapped.length];
        if (out.length === 0) {
            out.push({ raDeg: a.x, decDeg: a.y });
        }

        let dra = b.x - a.x;
        if (dra > 180) dra -= 360;
        if (dra < -180) dra += 360;
        const ddec = b.y - a.y;
        const span = Math.max(Math.abs(dra), Math.abs(ddec));
        const steps = Math.max(1, Math.ceil(span / maxStepDeg));

        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            out.push({
                raDeg: a.x + dra * t,
                decDeg: a.y + ddec * t
            });
        }
    }

    if (out.length > 1) {
        const first = out[0];
        const last = out[out.length - 1];
        if (Math.abs(first.raDeg - last.raDeg) < 1e-9 && Math.abs(first.decDeg - last.decDeg) < 1e-9) {
            out.pop();
        }
    }

    return out;
}

function pointOnSphericalSegment(point: UnitVec, seg: ConstellationBoundarySegment): boolean {
    if (!seg.normal) return false;
    const EPS_EDGE_DEG = 1e-5;
    const EPS_ARC_DEG = 1e-5;

    const d = Math.abs((Math.asin(Math.max(-1, Math.min(1, dot(point, seg.normal)))) * 180) / Math.PI);
    if (d > EPS_EDGE_DEG) return false;

    const ap = angularDeg(seg.from, point);
    const pb = angularDeg(point, seg.to);
    return Math.abs((ap + pb) - seg.arcDeg) <= EPS_ARC_DEG;
}

function pointInPolygonSpherical(point: UnitVec, prepared: ConstellationPolygonPrepared): boolean | null {
    // Point on boundary counts as inside.
    for (const seg of prepared.segments) {
        if (pointOnSphericalSegment(point, seg)) return true;
    }

    const basis = buildPlaneBasis(point);
    if (!basis) return null;

    const projected: Array<{ x: number; y: number }> = [];
    for (const v of prepared.vertices) {
        // Gnomonic projection: great circles map to straight lines.
        const denom = dot(v, point);
        if (!(denom > 1e-12)) return null;
        const x = dot(v, basis.east) / denom;
        const y = dot(v, basis.north) / denom;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        projected.push({ x, y });
    }

    let inside = false;
    for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
        const a = projected[j];
        const b = projected[i];
        const crossZ = a.x * b.y - a.y * b.x;
        const dotAB = a.x * b.x + a.y * b.y;
        if (Math.abs(crossZ) <= 1e-9 && dotAB <= 1e-9) return true;

        const ay = a.y;
        const by = b.y;
        const intersects = (ay > 0) !== (by > 0);
        if (!intersects) continue;
        const t = -ay / (by - ay);
        const xAtCross = a.x + t * (b.x - a.x);
        if (xAtCross > 0) inside = !inside;
    }

    return inside;
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
    const baseRa0 = norm360(polygon[0].raDeg);
    let best: Array<{ x: number; y: number }> | null = null;
    let bestClosure = Number.POSITIVE_INFINITY;

    for (const seed of [baseRa0 - 360, baseRa0, baseRa0 + 360]) {
        const out: Array<{ x: number; y: number }> = [];
        let prevX = seed;
        out.push({ x: prevX, y: polygon[0].decDeg });

        for (let i = 1; i < polygon.length; i++) {
            let x = norm360(polygon[i].raDeg);
            while (x - prevX > 180) x -= 360;
            while (x - prevX < -180) x += 360;
            out.push({ x, y: polygon[i].decDeg });
            prevX = x;
        }

        const closure = Math.abs(out[0].x - out[out.length - 1].x);
        if (closure < bestClosure) {
            bestClosure = closure;
            best = out;
        }
    }

    return best ?? [];
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
    const nearPole = Math.abs(py) >= 85;
    if ((!nearPole && (px < minX || px > maxX)) || py < minY || py > maxY) return false;

    // Boundary inclusion in chart space.
    const EPS_ON_EDGE = 1e-9;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x;
        const yi = verts[i].y;
        const xj = verts[j].x;
        const yj = verts[j].y;
        const dx = xj - xi;
        const dy = yj - yi;
        const cross2 = (px - xi) * dy - (py - yi) * dx;
        const tol = EPS_ON_EDGE * Math.max(1, Math.abs(dx) + Math.abs(dy));
        if (Math.abs(cross2) > tol) continue;
        const minSegX = Math.min(xi, xj) - EPS_ON_EDGE;
        const maxSegX = Math.max(xi, xj) + EPS_ON_EDGE;
        const minSegY = Math.min(yi, yj) - EPS_ON_EDGE;
        const maxSegY = Math.max(yi, yj) + EPS_ON_EDGE;
        if (px >= minSegX && px <= maxSegX && py >= minSegY && py <= maxSegY) {
            return true;
        }
    }

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
        if (!Array.isArray(meta.boundaryLayers?.chart?.polygons) || meta.boundaryLayers.chart.polygons.length === 0) continue;
        out.push({
            id: obj.id,
            name: obj.name,
            description: obj.description,
            emoji: obj.emoji,
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
    boundaryLayer?: ConstellationPolygonLayerId;
    geometry?: 'chart-old' | 'spherical';
}): ConstellationHit | null {
    if (!Number.isFinite(opts.raDeg) || !Number.isFinite(opts.decDeg) || !Number.isFinite(opts.ts)) {
        return null;
    }
    const boundaryLayer: ConstellationPolygonLayerId = opts.boundaryLayer ?? 'chart';
    const geometry = opts.geometry ?? 'chart-old';

    const pointByEpoch = new Map<ConstellationPolygonEpoch, { raDeg: number; decDeg: number }>();
    const pointUnitByEpoch = new Map<ConstellationPolygonEpoch, UnitVec>();
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
    const pointUnitAt = (epoch: ConstellationPolygonEpoch) => {
        const cached = pointUnitByEpoch.get(epoch);
        if (cached) return cached;
        const p = pointAt(epoch);
        const unit = toUnit(unitFromRaDecDeg(p.raDeg, p.decDeg));
        if (!unit) return null;
        pointUnitByEpoch.set(epoch, unit);
        return unit;
    };

    for (const c of opts.constellations) {
        const meta = c.meta;
        const layer = meta.boundaryLayers?.[boundaryLayer];
        if (!layer || !Array.isArray(layer.polygons) || layer.polygons.length === 0) continue;
        const testPoint = pointAt(layer.polygonEpoch);
        const testPointUnit = pointUnitAt(layer.polygonEpoch);
        for (let polygonIndex = 0; polygonIndex < layer.polygons.length; polygonIndex++) {
            const polygon = layer.polygons[polygonIndex];
            const matched = geometry === 'chart-old'
                ? pointInPolygonRaDec(testPoint, polygon)
                : (() => {
                    const prepared = preparePolygonSpherical(polygon);
                    if (!(prepared && testPointUnit)) return false;
                    const spherical = pointInPolygonSpherical(testPointUnit, prepared);
                    if (spherical === null) {
                        // Fallback for polygons that cannot be fully projected in local gnomonic chart.
                        return pointInPolygonRaDec(testPoint, polygon);
                    }
                    return spherical;
                })();

            if (!matched) continue;
            return {
                id: c.id,
                name: c.name,
                description: c.description,
                emoji: c.emoji,
                abbr: meta.abbr,
                band: meta.band,
                polygonEpoch: layer.polygonEpoch,
                polygonIndex,
                boundaryLayer,
                raDeg: testPoint.raDeg,
                decDeg: testPoint.decDeg
            };
        }
    }

    return null;
}
