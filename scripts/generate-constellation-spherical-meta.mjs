import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AstroTime, RotateVector, Rotation_EQD_EQJ, Vector } from 'astronomy-engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const CONSTELLATIONS_DIR = path.join(repoRoot, 'src/lib/catalog/objects/constellations');

const B1875_APPROX_UTC = new Date('1875-01-01T00:00:00.000Z');
const SPHERICAL_EPOCH = 'J2000';
const SAMPLING_STEP_DEG = 1;

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

function raDecFromVector(vec) {
    const x = Number(vec.x);
    const y = Number(vec.y);
    const z = Number(vec.z);
    const raDeg = norm360((Math.atan2(y, x) * 180) / Math.PI);
    const decDeg = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
    return { raDeg, decDeg };
}

function toJ2000RaDec(raDeg, decDeg, epoch) {
    if (epoch === 'J2000') {
        return { raDeg: norm360(raDeg), decDeg };
    }

    const qSrc = unitFromRaDecDeg(raDeg, decDeg);
    const qEqj = RotateVector(Rotation_EQD_EQJ(B1875_APPROX_UTC), qSrc);
    return raDecFromVector(qEqj);
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

function samplePolygonChartVertices(polygon) {
    const unwrapped = unwrapPolygonRaContinuously(polygon);
    if (unwrapped.length < 3) return [];

    const out = [];

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
        const steps = Math.max(1, Math.ceil(span / SAMPLING_STEP_DEG));

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

function roundCoord(x) {
    return Number(x.toFixed(6));
}

function getChartLayer(meta) {
    if (meta?.boundaryLayers?.chart?.polygonEpoch && Array.isArray(meta?.boundaryLayers?.chart?.polygons)) {
        return meta.boundaryLayers.chart;
    }
    if (meta?.polygonEpoch && Array.isArray(meta?.polygons)) {
        return {
            polygonEpoch: meta.polygonEpoch,
            polygons: meta.polygons
        };
    }
    throw new Error('Cannot resolve chart polygons in constellation meta');
}

function buildSphericalPolygons(chartLayer) {
    const polygons = chartLayer.polygons.map((poly) => {
        const sampled = samplePolygonChartVertices(poly);
        return sampled.map((v) => {
            const p = toJ2000RaDec(v.raDeg, v.decDeg, chartLayer.polygonEpoch);
            return {
                raDeg: roundCoord(p.raDeg),
                decDeg: roundCoord(p.decDeg)
            };
        });
    });

    return {
        polygonEpoch: SPHERICAL_EPOCH,
        samplingStepDeg: SAMPLING_STEP_DEG,
        polygons
    };
}

function extractJsonObject(tsSource) {
    const start = tsSource.indexOf('{\n    "id"');
    const end = tsSource.lastIndexOf('};');
    if (start < 0 || end < 0) {
        throw new Error('Cannot locate constellation object literal');
    }
    const jsonText = tsSource.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    return {
        start,
        end,
        value: JSON.parse(jsonText)
    };
}

function rewriteConstellationFile(filePath) {
    const src = fs.readFileSync(filePath, 'utf8');
    const parsed = extractJsonObject(src);
    const obj = parsed.value;

    const chart = getChartLayer(obj.meta);
    obj.meta.boundaryLayers = {
        chart: {
            polygonEpoch: chart.polygonEpoch,
            polygons: chart.polygons
        },
        spherical: buildSphericalPolygons(chart)
    };
    delete obj.meta.polygonEpoch;
    delete obj.meta.polygons;
    delete obj.meta.spherical;

    const replacement = `${JSON.stringify(obj, null, 4)};`;
    const next = `${src.slice(0, parsed.start)}${replacement}${src.slice(parsed.end + 2)}`;
    fs.writeFileSync(filePath, next);
}

function main() {
    const files = fs.readdirSync(CONSTELLATIONS_DIR)
        .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
        .sort();

    for (const fileName of files) {
        rewriteConstellationFile(path.join(CONSTELLATIONS_DIR, fileName));
    }

    console.log(`Updated spherical polygons for ${files.length} constellations.`);
}

main();
