// src/lib/wheel/geom.ts
export const SPOKE_LABELS = [
    'E','ENE','NE','NNE','N','NNW','NW','WNW','W','WSW','SW','SSW','S','SSE','SE','ESE'
] as const;

export function createWheelGeom(spokeCount = 16, VB = 1000) {
    const stepDeg = 360 / spokeCount;
    const cx = VB / 2;
    const cy = VB / 2;

    const rOuter = VB * 0.42;
    const rInner = VB * 0.18;
    const rLabel = VB * 0.47;

    const boundaryAngleDeg = (i: number) => -(i + 0.5) * stepDeg;
    const spokeAngleDeg = (i: number) => -stepDeg * i;

    const polarToXY = (r: number, deg: number) => {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const ringSectorPath = (a0: number, a1: number) => {
        const o0 = polarToXY(rOuter, a0);
        const o1 = polarToXY(rOuter, a1);
        const i1 = polarToXY(rInner, a1);
        const i0 = polarToXY(rInner, a0);

        const largeArc = 0;
        const sweepOuter = a1 >= a0 ? 1 : 0;
        const sweepInner = sweepOuter ? 0 : 1;

        return [
            `M ${o0.x} ${o0.y}`,
            `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweepOuter} ${o1.x} ${o1.y}`,
            `L ${i1.x} ${i1.y}`,
            `A ${rInner} ${rInner} 0 ${largeArc} ${sweepInner} ${i0.x} ${i0.y}`,
            'Z'
        ].join(' ');
    };

    return { VB, spokeCount, stepDeg, cx, cy, rOuter, rInner, rLabel, boundaryAngleDeg, spokeAngleDeg, polarToXY, ringSectorPath };
}

export function safeAngle(x: unknown, fallback: number) {
    return (typeof x === 'number' && Number.isFinite(x)) ? x : fallback;
}
