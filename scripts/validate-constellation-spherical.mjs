import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AstroTime,
    RotateVector,
    Rotation_EQD_EQJ,
    Rotation_EQJ_EQD,
    Vector
} from 'astronomy-engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const CONSTELLATIONS_DIR = path.join(repoRoot, 'src/lib/catalog/objects/constellations');
const STARS_DIR = path.join(repoRoot, 'src/lib/catalog/objects/stars');
const B1875_APPROX_UTC = new Date('1875-01-01T00:00:00.000Z');
const FIXED_TEST_TS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
const layerArg = process.argv.find((x) => x.startsWith('--layer='))?.slice('--layer='.length);
const algoArg = process.argv.find((x) => x.startsWith('--algo='))?.slice('--algo='.length);
const TEST_LAYER = layerArg === 'chart' ? 'chart' : 'spherical';
const TEST_ALGO = algoArg === 'chart-old' ? 'chart-old' : (TEST_LAYER === 'chart' ? 'chart-old' : 'spherical');

function norm360(deg) {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

function unitFromRaDecDeg(raDeg, decDeg) {
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

function toUnit(vec) {
    const x = Number(vec.x);
    const y = Number(vec.y);
    const z = Number(vec.z);
    const m = Math.hypot(x, y, z);
    if (!(m > 0) || !Number.isFinite(m)) return null;
    return { x: x / m, y: y / m, z: z / m };
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function normalize(v) {
    return toUnit(v);
}

function angularDeg(a, b) {
    const c = Math.max(-1, Math.min(1, dot(a, b)));
    return (Math.acos(c) * 180) / Math.PI;
}

function raDecFromVector(vec) {
    const x = Number(vec.x);
    const y = Number(vec.y);
    const z = Number(vec.z);
    const raDeg = norm360((Math.atan2(y, x) * 180) / Math.PI);
    const decDeg = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
    return { raDeg, decDeg };
}

function toPolygonEpochRaDec({ raDeg, decDeg, ts, polygonEpoch }) {
    const time = new AstroTime(new Date(ts));
    const qEqd = unitFromRaDecDeg(raDeg, decDeg);
    const eqdToEqj = Rotation_EQD_EQJ(time);
    const qEqj = RotateVector(eqdToEqj, qEqd);

    if (polygonEpoch === 'J2000') {
        return raDecFromVector(qEqj);
    }

    const eqjToB1875 = Rotation_EQJ_EQD(B1875_APPROX_UTC);
    const qB1875 = RotateVector(eqjToB1875, qEqj);
    return raDecFromVector(qB1875);
}

function buildPlaneBasis(point) {
    const up = Math.abs(point.z) < 0.99
        ? { x: 0, y: 0, z: 1 }
        : { x: 0, y: 1, z: 0 };
    const east = normalize(cross(up, point));
    if (!east) return null;
    const north = normalize(cross(point, east));
    if (!north) return null;
    return { east, north };
}

function unwrapPolygonRaContinuously(polygon) {
    if (!polygon.length) return [];
    const baseRa0 = norm360(polygon[0].raDeg);
    let best = null;
    let bestClosure = Number.POSITIVE_INFINITY;

    for (const seed of [baseRa0 - 360, baseRa0, baseRa0 + 360]) {
        const out = [];
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

function unwrapRaAround(raDeg, anchorRaDeg) {
    let x = raDeg;
    while (x - anchorRaDeg > 180) x -= 360;
    while (x - anchorRaDeg < -180) x += 360;
    return x;
}

function pointInPolygonRaDec(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    const py = point.decDeg;
    const verts = unwrapPolygonRaContinuously(polygon);
    if (verts.length < 3) return false;

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

    const epsOnEdge = 1e-9;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x;
        const yi = verts[i].y;
        const xj = verts[j].x;
        const yj = verts[j].y;
        const dx = xj - xi;
        const dy = yj - yi;
        const cross2 = (px - xi) * dy - (py - yi) * dx;
        const tol = epsOnEdge * Math.max(1, Math.abs(dx) + Math.abs(dy));
        if (Math.abs(cross2) > tol) continue;
        const minSegX = Math.min(xi, xj) - epsOnEdge;
        const maxSegX = Math.max(xi, xj) + epsOnEdge;
        const minSegY = Math.min(yi, yj) - epsOnEdge;
        const maxSegY = Math.max(yi, yj) + epsOnEdge;
        if (px >= minSegX && px <= maxSegX && py >= minSegY && py <= maxSegY) {
            return true;
        }
    }

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

function samplePolygonChartVertices(polygon) {
    const unwrapped = unwrapPolygonRaContinuously(polygon);
    if (unwrapped.length < 3) return [];

    const out = [];
    const maxStepDeg = 1;
    for (let i = 0; i < unwrapped.length; i++) {
        const a = unwrapped[i];
        const b = unwrapped[(i + 1) % unwrapped.length];
        if (out.length === 0) out.push({ raDeg: a.x, decDeg: a.y });

        let dra = b.x - a.x;
        if (dra > 180) dra -= 360;
        if (dra < -180) dra += 360;
        const ddec = b.y - a.y;
        const span = Math.max(Math.abs(dra), Math.abs(ddec));
        const steps = Math.max(1, Math.ceil(span / maxStepDeg));
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            out.push({ raDeg: a.x + dra * t, decDeg: a.y + ddec * t });
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

function preparePolygonSpherical(polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return null;
    const sampled = samplePolygonChartVertices(polygon);
    if (sampled.length < 3) return null;

    const vertices = [];
    for (const v of sampled) {
        const u = toUnit(unitFromRaDecDeg(v.raDeg, v.decDeg));
        if (!u) return null;
        vertices.push(u);
    }
    if (vertices.length < 3) return null;

    const segments = [];
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
    return { vertices, segments };
}

function pointOnSphericalSegment(point, seg) {
    if (!seg.normal) return false;
    const epsEdgeDeg = 1e-5;
    const epsArcDeg = 1e-5;

    const d = Math.abs((Math.asin(Math.max(-1, Math.min(1, dot(point, seg.normal)))) * 180) / Math.PI);
    if (d > epsEdgeDeg) return false;

    const ap = angularDeg(seg.from, point);
    const pb = angularDeg(point, seg.to);
    return Math.abs((ap + pb) - seg.arcDeg) <= epsArcDeg;
}

function pointInPolygonSpherical(point, prepared) {
    for (const seg of prepared.segments) {
        if (pointOnSphericalSegment(point, seg)) return true;
    }

    const basis = buildPlaneBasis(point);
    if (!basis) return null;

    const projected = [];
    for (const v of prepared.vertices) {
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

function extractJsonObject(tsSource) {
    const start = tsSource.indexOf('{\n    "id"');
    const end = tsSource.lastIndexOf('};');
    if (start < 0 || end < 0) return null;
    let jsonText = tsSource.slice(start, end + 1);
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(jsonText);
}

function parseConstellations() {
    const files = fs.readdirSync(CONSTELLATIONS_DIR).filter((name) => name.endsWith('.ts') && name !== 'index.ts');
    return files.map((fileName) => {
        const fullPath = path.join(CONSTELLATIONS_DIR, fileName);
        const src = fs.readFileSync(fullPath, 'utf8');
        const obj = extractJsonObject(src);
        return {
            id: obj.id,
            name: obj.name,
            meta: obj.meta
        };
    });
}

function parseStars() {
    const files = fs.readdirSync(STARS_DIR).filter((name) => name.endsWith('.ts'));
    return files.map((fileName) => {
        const fullPath = path.join(STARS_DIR, fileName);
        const src = fs.readFileSync(fullPath, 'utf8');
        const id = src.match(/id:\s*'([^']+)'/)?.[1];
        const name = src.match(/name:\s*'((?:\\'|[^'])*)'/)?.[1]?.replace(/\\'/g, "'");
        const constellationId = src.match(/constellationId:\s*'([^']+)'/)?.[1];
        const hms = src.match(/hmsToDeg\(([^)]+)\)/)?.[1];
        const dms = src.match(/dmsToDeg\(([^)]+)\)/)?.[1];
        if (!id || !name || !constellationId || !hms || !dms) {
            throw new Error(`Cannot parse star file: ${fileName}`);
        }

        const [h, m, s] = hms.split(',').map((x) => Number(x.trim()));
        const [sign, d, dm, ds] = dms.split(',').map((x) => Number(x.trim()));
        const raEqjDeg = (h + m / 60 + s / 3600) * 15;
        const decEqjDeg = sign * (d + dm / 60 + ds / 3600);
        const qEqj = unitFromRaDecDeg(raEqjDeg, decEqjDeg);
        const qEqd = RotateVector(Rotation_EQJ_EQD(new AstroTime(new Date(FIXED_TEST_TS))), qEqj);
        const { raDeg, decDeg } = raDecFromVector(qEqd);

        return {
            id,
            name,
            constellationId,
            raDeg,
            decDeg
        };
    });
}

function findConstellationSpherical({ raDeg, decDeg, ts, constellations }) {
    for (const c of constellations) {
        const layer = c.meta?.boundaryLayers?.[TEST_LAYER];
        if (!layer || !Array.isArray(layer.polygons) || layer.polygons.length === 0) continue;
        const testPoint = toPolygonEpochRaDec({
            raDeg,
            decDeg,
            ts,
            polygonEpoch: layer.polygonEpoch
        });
        const testPointUnit = toUnit(unitFromRaDecDeg(testPoint.raDeg, testPoint.decDeg));
        if (!testPointUnit) continue;
        for (const polygon of layer.polygons) {
            const prepared = preparePolygonSpherical(polygon);
            if (!prepared) continue;
            const spherical = pointInPolygonSpherical(testPointUnit, prepared);
            const matched = spherical === null
                ? pointInPolygonRaDec(testPoint, polygon)
                : spherical;
            if (matched) {
                return c.id;
            }
        }
    }
    return null;
}

function findConstellationChartOld({ raDeg, decDeg, ts, constellations }) {
    for (const c of constellations) {
        const layer = c.meta?.boundaryLayers?.[TEST_LAYER];
        if (!layer || !Array.isArray(layer.polygons) || layer.polygons.length === 0) continue;
        const testPoint = toPolygonEpochRaDec({
            raDeg,
            decDeg,
            ts,
            polygonEpoch: layer.polygonEpoch
        });
        for (const polygon of layer.polygons) {
            if (pointInPolygonRaDec(testPoint, polygon)) {
                return c.id;
            }
        }
    }
    return null;
}

function validateStars(constellations, stars) {
    const mismatches = [];
    const unresolved = [];

    for (const star of stars) {
        const hitId = TEST_ALGO === 'chart-old'
            ? findConstellationChartOld({
                raDeg: star.raDeg,
                decDeg: star.decDeg,
                ts: FIXED_TEST_TS,
                constellations
            })
            : findConstellationSpherical({
                raDeg: star.raDeg,
                decDeg: star.decDeg,
                ts: FIXED_TEST_TS,
                constellations
            });
        if (!hitId) {
            unresolved.push({
                id: star.id,
                name: star.name
            });
            continue;
        }
        if (hitId !== star.constellationId) {
            mismatches.push({
                id: star.id,
                name: star.name,
                expected: star.constellationId,
                got: hitId
            });
        }
    }

    return {
        unresolved,
        mismatches
    };
}

function validateConstellationPolygons(constellations) {
    if (TEST_ALGO !== 'spherical') return [];
    const failures = [];
    for (const c of constellations) {
        const layer = c.meta?.boundaryLayers?.[TEST_LAYER];
        if (!layer || !Array.isArray(layer.polygons) || layer.polygons.length === 0) continue;
        for (let i = 0; i < layer.polygons.length; i++) {
            const prepared = preparePolygonSpherical(layer.polygons[i]);
            if (!prepared) {
                failures.push({ id: c.id, polygonIndex: i, reason: 'prepare failed' });
                continue;
            }

            const mean = normalize(
                prepared.vertices.reduce(
                    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
                    { x: 0, y: 0, z: 0 }
                )
            );
            if (!mean) {
                failures.push({ id: c.id, polygonIndex: i, reason: 'centroid failed' });
                continue;
            }

            if (!pointInPolygonSpherical(mean, prepared)) {
                failures.push({ id: c.id, polygonIndex: i, reason: 'centroid outside' });
            }
        }
    }
    return failures;
}

function main() {
    const constellations = parseConstellations();
    const stars = parseStars();

    const starValidation = validateStars(constellations, stars);
    const polygonFailures = validateConstellationPolygons(constellations);

    console.log(`Constellations: ${constellations.length}`);
    console.log(`Stars: ${stars.length}`);
    console.log(`Fixed epoch: ${new Date(FIXED_TEST_TS).toISOString()}`);
    console.log(`Layer: ${TEST_LAYER}`);
    console.log(`Algorithm: ${TEST_ALGO}`);
    console.log(`Star unresolved hits: ${starValidation.unresolved.length}`);
    console.log(`Star mismatches: ${starValidation.mismatches.length}`);
    console.log(`Polygon sanity failures: ${polygonFailures.length}`);

    if (starValidation.unresolved.length > 0) {
        console.log('\nStar unresolved hits (first 20):');
        for (const row of starValidation.unresolved.slice(0, 20)) {
            console.log(`- ${row.name} (${row.id}): no hit`);
        }
    }

    if (starValidation.mismatches.length > 0) {
        console.log('\nStar mismatches (first 20):');
        for (const row of starValidation.mismatches.slice(0, 20)) {
            console.log(`- ${row.name} (${row.id}): catalog=${row.expected}, spherical=${row.got}`);
        }
    }

    if (polygonFailures.length > 0) {
        console.log('\nPolygon sanity warnings (first 20):');
        for (const row of polygonFailures.slice(0, 20)) {
            console.log(`- ${row.id} polygon #${row.polygonIndex}: ${row.reason}`);
        }
    }

    if (starValidation.unresolved.length > 0 || starValidation.mismatches.length > 0) {
        process.exitCode = 1;
    }
}

main();
