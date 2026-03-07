<!-- src/components/Compass.svelte -->
<script lang="ts">
    import { slide } from 'svelte/transition';
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import { createWheelGeom, SPOKE_LABELS } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useTooltip } from '../lib/wheel/ui/useTooltip';
    import { useWheelEffectiveTs } from '../lib/wheel/ui/useEffectiveTs';

    import DocsModal from './DocsModal.svelte';
    import CompassTooltip from './CompassTooltip.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import WheelHeader from './WheelHeader.svelte';
    import CompassInfoBlock from './CompassInfoBlock.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';

    import { objects, wheels } from '../lib/catalog';
    import type { ObjId, EmojiPlacement, EmojiPlacementInput, RoleName, WheelNodeGroups, WheelSpec } from '../lib/catalog';

    import { formatLabelTitleCaseUi, formatSpokeCodeUi, formatSpokeTextUi, SPOKES_ORDER, type InfoItem, type MarkerCluster, type MarkerItem, type MomentTip } from '../lib/wheel/types';
    import { formatDateTime } from '../lib/format';
    import { formatInfoValue } from '../lib/wheel/infoFormat';
    import { compassClusters } from '../lib/wheel/ui/compassClusters';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    // unified resolver (runtime+idb, and if wheel type is excluded -> compute)
    import { resolveWheel } from '../lib/board/dispatcher';
    import type { WheelSolveResult } from '../lib/board/runtime';

    import { DEFAULT_LOCATION_ID, type Location } from '../lib/location/types';
    import type { CompassInfoConfig, CompassInfoGroupConfig, CompassInfoTagConfig, WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import { setSelectedTs } from '../lib/time/store';

    import { compassTargetsToMarkerItems } from '../lib/math/compass';
    import type { CompassTargetState } from '../lib/math/compass';
    import { norm360 } from '../lib/math/helpers';
    import { isActiveProfileLocked } from '../lib/profile/store';

    // ------------------------------------------------------------
    // Props (Board passes wheel + resolved location)
    // ------------------------------------------------------------
    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: Location;
    export let onUserActivity: () => void = () => {};
    export let dragEnabled = false;
    export let onCardDragStart: (e: DragEvent) => void = () => {};
    export let onCardDragEnd: () => void = () => {};
    $: void selectedTs;

    const dbg = debug('COMPASS', '🧭');

    function docsPathForWheelType(type: string | undefined): string {
        const wt = String(type ?? 'compass');
        return `concept/${wt}.md`;
    }

    function docsTitleForWheelType(type: string | undefined): string {
        return `${String(type ?? 'compass')} wheel`;
    }

    // docs
    const docs = useDocs(() => docsPathForWheelType(wheel?.wheelType), {
        getTitle: () => docsTitleForWheelType(wheel?.wheelType),
        dbg,
        tag: () => 'compass'
    });
    const docsState = docs.state;

    // ------------------------------------------------------------
    // Local derived state from wheel
    // ------------------------------------------------------------
    $: wheelId = wheel?.id;
    $: roles = (wheel?.roles ?? {}) as any;
    $: isCompassWheelType = wheel?.wheelType === 'compass';

    $: observer = (wheel?.observer ?? { locationId: DEFAULT_LOCATION_ID, locked: false }) as WheelObserverState;
    $: time = (wheel?.time ?? { live: true, locked: false }) as WheelTimeState;

    // prefer passed-in location (already resolved in Board)
    $: wheelLoc = location;
    $: wheelLat = wheelLoc?.lat;
    $: wheelLon = wheelLoc?.lon;

    function closeCompass() {
        if ($isActiveProfileLocked) return;
        onUserActivity();
        if (!wheelId) return;
        boardApi.removeWheelById(wheelId, 'Compass.close');
    }

    // ------------------------------------------------------------
    // Effective time (UNIFIED)
    // - effTs = what solver uses
    // - effState.globalTs/globalLive/localLiveNowTs are still available for TimePicker UI
    // ------------------------------------------------------------
    const eff = useWheelEffectiveTs(
        () => wheelId,
        () => time,
        {
            syncToBoard: true,
            onSyncTime: (next, reason) => {
                if ($isActiveProfileLocked) return;
                if (!wheelId) return;
                boardApi.updateWheelTime(wheelId, next, reason ?? 'Compass.syncWheelTime');
            },
            dbg: { warn: dbg.log }
        }
    );

    const effState = eff.state; // store
    $: effTs = $effState.ts;
    $: globalTs = $effState.globalTs;
    $: globalLive = $effState.globalLive;
    $: localLiveNowTs = $effState.localLiveNowTs;
    $: {
        void time?.live;
        void time?.locked;
        void time?.ts;
        eff.refresh('Compass.timeChanged');
    }

    // If observer isn't locked -> keep it synced to passed-in location
    $: {
        if (wheelId)
            if (!$isActiveProfileLocked && !observer?.locked && wheelLoc?.id && observer.locationId !== wheelLoc.id) {
                boardApi.updateWheelObserver(wheelId, { locationId: wheelLoc.id }, 'Compass.syncObserverLocation');
            }
    }

    // ------------------------------------------------------------
    // Geometry
    // ------------------------------------------------------------
    const geom = createWheelGeom(16, 1000);
    const labels = SPOKE_LABELS;
    const spokeCount = geom.spokeCount;

    const VB = geom.VB;
    const cx = geom.cx;
    const cy = geom.cy;
    const rOuter = geom.rOuter;
    const rLabel = geom.rLabel;

    const rHorizon = rOuter * 0.87;

    const boundaryAngleDeg = geom.boundaryAngleDeg;
    const spokeAngleDeg = geom.spokeAngleDeg;
    const polarToXY = geom.polarToXY;

    function orbitToRadiusVB(orbit: number) {
        const o = Math.max(0, orbit);
        if (o <= 1) return rHorizon * o;
        const t = Math.min(1, o - 1);
        return rHorizon + (rOuter - rHorizon) * t;
    }

    function pieSectorPath(a0: number, a1: number, r: number) {
        const p0 = polarToXY(0, a0);
        const p1 = polarToXY(r, a0);
        const p2 = polarToXY(r, a1);
        const p3 = polarToXY(0, a1);

        const largeArc = Math.abs(a1 - a0) > 180 ? 1 : 0;

        return [
            `M ${p0.x} ${p0.y}`,
            `L ${p1.x} ${p1.y}`,
            `A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
            `L ${p3.x} ${p3.y}`,
            'Z'
        ].join(' ');
    }

    // ------------------------------------------------------------
    // Marker clustering + pinning
    // ------------------------------------------------------------
    const MIN_ARC_PX = 28;
    const BODY_MARKER_HIDE_RADIUS_VB = VB * 0.028;
    const ORBIT_NODE_MERGE_RADIUS_VB = VB * 0.012;
    let markerClusters: MarkerCluster[] = [];
    let lastTargets: CompassTargetState[] = [];
    let displayTargets: Array<CompassTargetState & { hiddenDuringTween?: boolean }> = [];
    let allBodies: CompassBodyRow[] = [];
    let orbitCurves: Array<{ id: ObjId; seg: number; d: string; visible: boolean }> = [];
    type OrbitNodeUi = {
        key: string;
        x: number;
        y: number;
        tip: MomentTip;
        visible: boolean;
        bodyId: ObjId;
        code: string;
        source?: 'cycle' | 'spoke' | 'seam';
        sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
        meta?: Record<string, unknown>;
        infoItems?: CompassInfoChip[];
        ts: number;
    };
    let orbitNodes: Array<{
        key: string;
        x: number;
        y: number;
        tip: MomentTip;
        visible: boolean;
        bodyId: ObjId;
        code: string;
        source?: 'cycle' | 'spoke' | 'seam';
        sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
        meta?: Record<string, unknown>;
        infoItems?: CompassInfoChip[];
        ts: number;
    }> = [];
    let orbitNodesAll: OrbitNodeUi[] = [];
    let orbitNodesVisible: OrbitNodeUi[] = [];
    let hasPinnedNodalNodes = false;
    let showOrbits = true;
    let showOrbitNodesAny = true;
    type OrbitNodeGroup = 'regular' | 'compass' | 'horizon' | 'nodal' | 'synod' | 'bind';
    const ORBIT_NODE_GROUP_ORDER: OrbitNodeGroup[] = ['compass', 'horizon', 'nodal', 'bind', 'synod', 'regular'];
    let orbitNodeGroupVisible: Record<OrbitNodeGroup, boolean> = {
        regular: false,
        compass: true,
        horizon: true,
        nodal: true,
        synod: true,
        bind: true
    };
    let activeSpokeCode: string | null = null;
    let lastResolvedTs = NaN;
    let markerTweenRaf = 0;
    let markerTweenToken = 0;
    let pendingNodeSnap: { bodyId: ObjId; ts: number; code?: string } | null = null;
    const NEXT_CYCLE_PICK_EPS_MS = 90_000;

    let pinnedBodyId: ObjId | null = null;

    function clearPinned() {
        pinnedBodyId = null;
    }

    function toggleOrbits() {
        onUserActivity();
        showOrbits = !showOrbits;
    }

    function toggleOrbitNodesAny() {
        showOrbitNodesAny = !showOrbitNodesAny;
    }

    function toggleOrbitNodeGroup(group: OrbitNodeGroup) {
        orbitNodeGroupVisible = {
            ...orbitNodeGroupVisible,
            [group]: !orbitNodeGroupVisible[group]
        };
    }

    function isOrbitNodeGroupVisible(group: OrbitNodeGroup): boolean {
        return orbitNodeGroupVisible[group];
    }

    function nodeTagsOf(node: { tip?: MomentTip }): string[] {
        return Array.isArray(node.tip?.tags) ? node.tip!.tags!.filter((t) => typeof t === 'string') : [];
    }

    function wheelNodeGroupsFromSpec(): WheelNodeGroups | null {
        if (!spec || typeof spec !== 'object') return null;
        const raw = (spec as any).nodes;
        if (!raw || typeof raw !== 'object') return null;
        return raw as WheelNodeGroups;
    }

    function normalizeSpecNodeGroup(group: Exclude<OrbitNodeGroup, 'regular'>, input: WheelNodeGroups | null): string[] {
        const xs = input?.[group];
        if (Array.isArray(xs)) return xs;
        if (group === 'horizon' || group === 'nodal') {
            const seam = (input as { seam?: string[] } | null)?.seam;
            if (Array.isArray(seam)) {
                return wheel?.wheelType === 'system'
                    ? (group === 'nodal' ? seam : [])
                    : (group === 'horizon' ? seam : []);
            }
        }
        return [];
    }

    let orbitNodeGroupTagSets: Record<Exclude<OrbitNodeGroup, 'regular'>, Set<string>> = {
        compass: new Set(),
        horizon: new Set(),
        nodal: new Set(),
        bind: new Set(),
        synod: new Set()
    };
    $: {
        void spec;
        void wheel?.wheelType;
        const groups = wheelNodeGroupsFromSpec();
        orbitNodeGroupTagSets = {
            compass: new Set(normalizeSpecNodeGroup('compass', groups)),
            horizon: new Set(normalizeSpecNodeGroup('horizon', groups)),
            nodal: new Set(normalizeSpecNodeGroup('nodal', groups)),
            bind: new Set(normalizeSpecNodeGroup('bind', groups)),
            synod: new Set(normalizeSpecNodeGroup('synod', groups))
        };
    }

    function groupFromSpecTag(tag: string): Exclude<OrbitNodeGroup, 'regular'> | null {
        if (orbitNodeGroupTagSets.compass.has(tag)) return 'compass';
        if (orbitNodeGroupTagSets.horizon.has(tag)) return 'horizon';
        if (orbitNodeGroupTagSets.nodal.has(tag)) return 'nodal';
        if (orbitNodeGroupTagSets.bind.has(tag)) return 'bind';
        if (orbitNodeGroupTagSets.synod.has(tag)) return 'synod';
        return null;
    }

    function mainCycleSourceForActiveWheel(): 'horizon' | 'synod' | 'bind' | 'nodal' | null {
        if (!spec || typeof spec !== 'object') return null;
        const raw = (spec as { mainCycle?: unknown }).mainCycle;
        if (raw === 'horizon' || raw === 'synod' || raw === 'bind' || raw === 'nodal') return raw;
        return null;
    }

    function isMainCycleBoundaryByTags(tags: string[]): boolean {
        const mainCycle = mainCycleSourceForActiveWheel();
        if (!mainCycle) return false;
        return tags.includes(`E-${mainCycle}`) || tags.includes(`E_next-${mainCycle}`);
    }

    function isMainCycleBoundaryNode(node: { tip?: MomentTip }): boolean {
        return isMainCycleBoundaryByTags(nodeTagsOf(node));
    }

    function orbitNodeGroupFromTags(tags: string[]): OrbitNodeGroup {
        for (const group of ORBIT_NODE_GROUP_ORDER) {
            if (group === 'regular') continue;
            if (tags.some((tag) => groupFromSpecTag(tag) === group)) return group;
        }
        return 'regular';
    }

    function orbitNodeGroup(node: { tip?: MomentTip }): OrbitNodeGroup {
        return orbitNodeGroupFromTags(nodeTagsOf(node));
    }

    function tagToCssClass(tag: string): string {
        const norm = String(tag)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return norm ? `tg-${norm}` : '';
    }

    function orbitNodeTagClassList(node: { tip?: MomentTip }): string {
        const tags = nodeTagsOf(node);
        const classes = Array.from(new Set(tags.map(tagToCssClass).filter(Boolean)));
        return classes.join(' ');
    }

    function orbitNodeGroupClass(node: { tip?: MomentTip }): string {
        return `grp-${orbitNodeGroup(node)}`;
    }

    $: orbitNodesVisible = (() => {
        const nodeGroupToggles = [
            orbitNodeGroupVisible.regular,
            orbitNodeGroupVisible.compass,
            orbitNodeGroupVisible.horizon,
            orbitNodeGroupVisible.nodal,
            orbitNodeGroupVisible.synod,
            orbitNodeGroupVisible.bind
        ];
        void nodeGroupToggles;

        return orbitNodes.filter((n) => {
            if (isMainCycleBoundaryNode(n)) return true;
            const g = orbitNodeGroup(n);
            if (!showOrbitNodesAny) return false;
            return isOrbitNodeGroupVisible(g);
        });
    })();

    $: hasPinnedNodalNodes = !!pinnedBodyId && orbitNodesAll.some(
        (n) => n.bodyId === pinnedBodyId && orbitNodeGroup(n) === 'nodal'
    );

    function activateSpokeFromOrbitNode(node: { source?: 'cycle' | 'spoke' | 'seam'; code: string }) {
        activeSpokeCode = node.source === 'spoke' ? node.code : null;
    }

    function clearActiveSpoke() {
        activeSpokeCode = null;
    }

    function parseOrbitNodeDesc(desc: string | undefined): { bodyId: ObjId; code?: string } | null {
        if (typeof desc !== 'string' || !desc.startsWith('orbit-node:')) return null;
        const parts = desc.split(':');
        const bodyId = parts[1] as ObjId | undefined;
        const code = parts[2];
        if (!bodyId) return null;
        return { bodyId, code };
    }

    function stopMarkerTween() {
        if (markerTweenRaf) {
            cancelAnimationFrame(markerTweenRaf);
            markerTweenRaf = 0;
        }
        markerTweenToken++;
    }

    function easeInOut(u: number): number {
        const x = Math.max(0, Math.min(1, u));
        return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    }

    function lerp(a: number, b: number, u: number): number {
        return a + (b - a) * u;
    }

    function lerpAngleShortest(a0: number, a1: number, u: number): number {
        let d = a1 - a0;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        return a0 + d * u;
    }

    function sampleTrackAtTs(track: CompassTargetState['orbitTrack'], ts: number) {
        if (!track || track.length === 0 || !Number.isFinite(ts)) return null;
        const xs = track.slice().sort((a, b) => a.ts - b.ts);
        if (xs.length === 1) return xs[0];

        const tStart = xs[0].ts;
        const tEnd = xs[xs.length - 1].ts;
        const cycleDuration = tEnd - tStart;

        // Extend track by +/- 1 cycle so sampling across E/E+ stays continuous.
        const sampleSeq = (() => {
            if (!(cycleDuration > 0)) return xs;
            const shift = (dt: number) => xs.map((p) => ({ ...p, ts: p.ts + dt }));
            return [...shift(-cycleDuration), ...xs, ...shift(cycleDuration)];
        })();

        if (ts <= sampleSeq[0].ts) return sampleSeq[0];
        if (ts >= sampleSeq[sampleSeq.length - 1].ts) return sampleSeq[sampleSeq.length - 1];

        for (let i = 0; i < sampleSeq.length - 1; i++) {
            const a = sampleSeq[i];
            const b = sampleSeq[i + 1];
            if (!(ts >= a.ts && ts <= b.ts)) continue;

            const den = b.ts - a.ts;
            const u = den > 0 ? (ts - a.ts) / den : 0;
            const angleDeg = lerpAngleShortest(a.angleDeg, b.angleDeg, u);
            return {
                ...a,
                ts,
                angleDeg,
                orbit: lerp(a.orbit, b.orbit, u),
                azimuthDeg: lerp(a.azimuthDeg, b.azimuthDeg, u),
                altitudeDeg: lerp(a.altitudeDeg, b.altitudeDeg, u),
                visible: lerp(a.altitudeDeg, b.altitudeDeg, u) >= 0
            };
        }
        return sampleSeq[sampleSeq.length - 1];
    }

    function animateDisplayTargets(fromTs: number, toTs: number, next: CompassTargetState[]) {
        stopMarkerTween();
        const token = ++markerTweenToken;

        const prevById = new Map(displayTargets.map((t) => [t.id, t]));
        const jump = Math.abs(toTs - fromTs);
        const canAnimateBody = (n: CompassTargetState): boolean => {
            const track = n.orbitTrack;
            if (!track?.length) return false;

            const tsVals = track
                .map((p) => p.ts)
                .filter((x): x is number => Number.isFinite(x));
            if (!tsVals.length) return false;

            const start = Math.min(...tsVals);
            const end = Math.max(...tsVals);
            const duration = end - start;
            if (!(duration > 0)) return false;

            const lo = start - duration; // previous cycle start
            const hi = end + duration;   // next cycle end
            return fromTs >= lo && fromTs <= hi && toTs >= lo && toTs <= hi;
        };

        const animatableIds = new Set(next.filter(canAnimateBody).map((n) => n.id));
        const shouldAnimateSome = Number.isFinite(fromTs) && Number.isFinite(toTs) && jump > 0 && animatableIds.size > 0;

        if (!shouldAnimateSome || !displayTargets.length) {
            displayTargets = next;
            return;
        }

        const duration = Math.max(220, Math.min(520, jump / 12_000));
        const t0 = performance.now();

        const tick = (now: number) => {
            if (token !== markerTweenToken) return;
            const u = easeInOut((now - t0) / duration);
            const tsNow = lerp(fromTs, toTs, u);

            displayTargets = next.map((n) => {
                if (!animatableIds.has(n.id)) {
                    return { ...n, hiddenDuringTween: true };
                }

                const sampled = sampleTrackAtTs(n.orbitTrack, tsNow);
                if (sampled) {
                    return {
                        ...n,
                        angleDeg: sampled.angleDeg,
                        orbit: sampled.orbit,
                        azimuthDeg: sampled.azimuthDeg,
                        altitudeDeg: sampled.altitudeDeg,
                        visible: sampled.visible
                    };
                }

                const p = prevById.get(n.id);
                if (!p) return n;
                const alt = lerp(p.altitudeDeg, n.altitudeDeg, u);
                return {
                    ...n,
                    angleDeg: lerpAngleShortest(p.angleDeg, n.angleDeg, u),
                    orbit: lerp(p.orbit, n.orbit, u),
                    azimuthDeg: lerp(p.azimuthDeg, n.azimuthDeg, u),
                    altitudeDeg: alt,
                    visible: alt >= 0
                };
            });

            if (u < 1) {
                markerTweenRaf = requestAnimationFrame(tick);
            } else {
                markerTweenRaf = 0;
                displayTargets = next;
            }
        };

        markerTweenRaf = requestAnimationFrame(tick);
    }

    function trackPathD(track: NonNullable<CompassTargetState['orbitTrack']>): string {
        const nodes = track
            .slice()
            .sort((a, b) => a.ts - b.ts)
            .map((p) => ({
                angleDeg: p.angleDeg,
                orbit: p.orbit
            }));

        if (nodes.length < 2) return '';

        // Unwrap signed angles to keep angular continuity across the -180/180 seam.
        const unwrapped: Array<{ angleDeg: number; orbit: number }> = [];
        for (const n of nodes) {
            if (!unwrapped.length) {
                unwrapped.push({ ...n });
                continue;
            }

            let a = n.angleDeg;
            const prev = unwrapped[unwrapped.length - 1].angleDeg;
            while (a - prev > 180) a -= 360;
            while (a - prev < -180) a += 360;
            unwrapped.push({ angleDeg: a, orbit: n.orbit });
        }

        const pts = unwrapped.map((p) => {
            const r = orbitToRadiusVB(Math.max(0, Math.min(2, p.orbit)));
            const xy = polarToXY(r, p.angleDeg);
            return { x: xy.x, y: xy.y };
        });
        if (pts.length < 2) return '';

        const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
        const lineDist = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
            const vx = b.x - a.x;
            const vy = b.y - a.y;
            const den = Math.hypot(vx, vy);
            if (!(den > 0)) return 0;
            return Math.abs(vx * (a.y - p.y) - (a.x - p.x) * vy) / den;
        };

        const tangentAt = (i: number) => {
            const pPrev = pts[i - 1] ?? pts[i];
            const pCur = pts[i];
            const pNext = pts[i + 1] ?? pts[i];
            const vx = pNext.x - pPrev.x;
            const vy = pNext.y - pPrev.y;
            const vLen = Math.hypot(vx, vy);
            if (!(vLen > 0)) return { x: 0, y: 0 };

            const lPrev = len(pPrev, pCur);
            const lNext = len(pCur, pNext);
            const scale = Math.min(lPrev, lNext) * 0.45;
            return { x: (vx / vLen) * scale, y: (vy / vLen) * scale };
        };

        const COLLINEAR_EPS = VB * 0.0025;
        let d = `M ${pts[0].x} ${pts[0].y}`;

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const n1 = unwrapped[i];
            const n2 = unwrapped[i + 1];

            // For fully-below-horizon spans, keep interpolation in polar space.
            // This guarantees the path stays outside the horizon ring (orbit > 1)
            // and avoids cubic overshoot that can cross back over the horizon.
            if (n1.orbit > 1 && n2.orbit > 1) {
                const SUBDIV_BELOW = 8;
                const startJ = i === 0 ? 1 : 1;
                for (let j = startJ; j <= SUBDIV_BELOW; j++) {
                    const u = j / SUBDIV_BELOW;
                    const angleDeg = n1.angleDeg + (n2.angleDeg - n1.angleDeg) * u;
                    const orbit = n1.orbit + (n2.orbit - n1.orbit) * u;
                    const r = orbitToRadiusVB(Math.max(1.001, Math.min(2, orbit)));
                    const p = polarToXY(r, angleDeg);
                    d += ` L ${p.x} ${p.y}`;
                }
                continue;
            }
            const colA = i > 0 && i < pts.length - 1
                ? lineDist(pts[i], pts[i - 1], pts[i + 1]) <= COLLINEAR_EPS
                : false;
            const colB = i + 1 > 0 && i + 1 < pts.length - 1
                ? lineDist(pts[i + 1], pts[i], pts[i + 2]) <= COLLINEAR_EPS
                : false;

            if (colA && colB) {
                d += ` L ${p2.x} ${p2.y}`;
                continue;
            }

            const t1 = tangentAt(i);
            const t2 = tangentAt(i + 1);
            const cp1 = { x: p1.x + t1.x / 3, y: p1.y + t1.y / 3 };
            const cp2 = { x: p2.x - t2.x / 3, y: p2.y - t2.y / 3 };
            d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
        }

        return d;
    }

    function splitTrackByVisibility(track: NonNullable<CompassTargetState['orbitTrack']>) {
        const sorted = track.slice().sort((a, b) => a.ts - b.ts);
        if (!sorted.length) return [] as Array<{ visible: boolean; pts: typeof sorted }>;

        const out: Array<{ visible: boolean; pts: typeof sorted }> = [];
        let curVisible = !!sorted[0].visible;
        let curPts = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const p = sorted[i];
            const v = !!p.visible;
            if (v === curVisible) {
                curPts.push(p);
                continue;
            }

            // Prefer seam node provided by solver (exact style switch anchor).
            // Fallback: interpolate seam at orbit=1 between neighbors.
            let seamPoint = prev;
            const seamBase =
                (p.source === 'seam' ? p : null) ??
                (prev.source === 'seam' ? prev : null);

            if (seamBase) {
                seamPoint = { ...seamBase, visible: curVisible };
            } else {
                const o0 = prev.orbit;
                const o1 = p.orbit;
                const crossesHorizon =
                    Number.isFinite(o0) &&
                    Number.isFinite(o1) &&
                    ((o0 <= 1 && o1 > 1) || (o1 <= 1 && o0 > 1)) &&
                    o0 !== o1;

                if (crossesHorizon) {
                    const uRaw = (1 - o0) / (o1 - o0);
                    const u = Math.max(0, Math.min(1, uRaw));
                    const ts = prev.ts + (p.ts - prev.ts) * u;
                    seamPoint = {
                        ...prev,
                        ts,
                        orbit: 1,
                        angleDeg: lerpAngleShortest(prev.angleDeg, p.angleDeg, u),
                        azimuthDeg: prev.azimuthDeg + (p.azimuthDeg - prev.azimuthDeg) * u,
                        altitudeDeg: 0,
                        visible: curVisible
                    };
                }
            }

            out.push({ visible: curVisible, pts: [...curPts, seamPoint] });
            curVisible = v;
            // Keep seam continuity by repeating seam node in the next segment.
            curPts = [{ ...seamPoint, visible: v }, p];
        }

        out.push({ visible: curVisible, pts: curPts });
        return out;
    }

    function togglePin(id: ObjId) {
        pinnedBodyId = (pinnedBodyId === id) ? null : id;
    }

    function clusterContainsPinned(c: MarkerCluster): boolean {
        if (!pinnedBodyId) return false;
        return c.items?.some(it => {
            const body = String(it.baseId ?? '').replace('body:', '');
            return body === pinnedBodyId;
        }) ?? false;
    }

    function clusterSingleBodyId(c: MarkerCluster): ObjId | null {
        if (!c || c.count !== 1) return null;
        const it = c.items?.[0];
        const body = String(it?.baseId ?? '').replace('body:', '');
        return (body ? (body as ObjId) : null);
    }

    function dedupeOrbitNodesByBody(nodes: OrbitNodeUi[]): OrbitNodeUi[] {
        const byBody = new Map<ObjId, OrbitNodeUi[]>();
        for (const n of nodes) {
            const arr = byBody.get(n.bodyId);
            if (arr) arr.push(n);
            else byBody.set(n.bodyId, [n]);
        }

        const out: OrbitNodeUi[] = [];
        for (const [, bodyNodes] of byBody) {
            const regularNodes = bodyNodes.filter((n) => orbitNodeGroup(n) === 'regular');
            const boundaryNodes = bodyNodes.filter((n) => isMainCycleBoundaryNode(n));
            const otherSpecialNodes = bodyNodes.filter((n) => {
                if (isMainCycleBoundaryNode(n)) return false;
                return orbitNodeGroup(n) !== 'regular';
            });
            const mergedSpecialNodes: OrbitNodeUi[] = [];
            mergedSpecialNodes.push(...otherSpecialNodes);

            // Merge only overlapping main-cycle boundary nodes (E / E+) into one marker with both moments.
            if (boundaryNodes.length) {
                const sortedBoundary = boundaryNodes.slice().sort((a, b) => a.ts - b.ts);
                const bClusters: Array<{ rep: OrbitNodeUi; members: OrbitNodeUi[] }> = [];
                for (const n of sortedBoundary) {
                    let hit: { rep: OrbitNodeUi; members: OrbitNodeUi[] } | null = null;
                    let bestDist = Number.POSITIVE_INFINITY;
                    for (const c of bClusters) {
                        const d = Math.hypot(n.x - c.rep.x, n.y - c.rep.y);
                        if (d <= ORBIT_NODE_MERGE_RADIUS_VB && d < bestDist) {
                            hit = c;
                            bestDist = d;
                        }
                    }
                    if (!hit) {
                        bClusters.push({ rep: n, members: [n] });
                        continue;
                    }
                    hit.members.push(n);
                    if (n.ts < hit.rep.ts) hit.rep = n;
                }

                for (const c of bClusters) {
                    if (c.members.length === 1) {
                        mergedSpecialNodes.push(c.members[0]);
                        continue;
                    }
                    const tsList = Array.from(new Set(c.members.map((m) => m.ts)))
                        .filter((v) => Number.isFinite(v))
                        .sort((a, b) => a - b);
                    const tags = Array.from(new Set(c.members.flatMap((m) => m.tip.tags ?? [])));
                    const rep = c.rep;
                    mergedSpecialNodes.push({
                        ...rep,
                        key: `${rep.key}:main-cycle-boundary-merged`,
                        tip: {
                            ...rep.tip,
                            tags,
                            pickTsList: tsList.length ? tsList : [rep.ts]
                        }
                    });
                }
            }

            const remainingRegularNodes: OrbitNodeUi[] = [];
            for (const n of regularNodes) {
                let hitIndex = -1;
                let bestDist = Number.POSITIVE_INFINITY;
                for (let i = 0; i < mergedSpecialNodes.length; i++) {
                    const s = mergedSpecialNodes[i];
                    const d = Math.hypot(n.x - s.x, n.y - s.y);
                    if (d <= ORBIT_NODE_MERGE_RADIUS_VB && d < bestDist) {
                        bestDist = d;
                        hitIndex = i;
                    }
                }

                if (hitIndex < 0) {
                    remainingRegularNodes.push(n);
                    continue;
                }

                const base = mergedSpecialNodes[hitIndex];
                const mergedTags = Array.from(new Set([...(base.tip.tags ?? []), ...(n.tip.tags ?? [])]));

                mergedSpecialNodes[hitIndex] = {
                    ...base,
                    tip: {
                        ...base.tip,
                        tags: mergedTags.length ? mergedTags : undefined
                    }
                };
            }

            out.push(...mergedSpecialNodes);

            if (!remainingRegularNodes.length) continue;

            const bodyMinTs = Math.min(...remainingRegularNodes.map((n) => n.ts));
            const bodyMaxTs = Math.max(...remainingRegularNodes.map((n) => n.ts));
            const edgeTsEps = 2 * 60_000;

            const sorted = remainingRegularNodes.slice().sort((a, b) => {
                const aSpoke = a.source === 'spoke' ? 1 : 0;
                const bSpoke = b.source === 'spoke' ? 1 : 0;
                if (aSpoke !== bSpoke) return bSpoke - aSpoke;
                return a.ts - b.ts;
            });

            const clusters: Array<{ rep: OrbitNodeUi; members: OrbitNodeUi[] }> = [];
            for (const n of sorted) {
                let hit: { rep: OrbitNodeUi; members: OrbitNodeUi[] } | null = null;
                let bestDist = Number.POSITIVE_INFINITY;
                for (const c of clusters) {
                    const d = Math.hypot(n.x - c.rep.x, n.y - c.rep.y);
                    if (d <= ORBIT_NODE_MERGE_RADIUS_VB && d < bestDist) {
                        hit = c;
                        bestDist = d;
                    }
                }

                if (!hit) {
                    clusters.push({ rep: n, members: [n] });
                    continue;
                }

                hit.members.push(n);
                const rep = hit.rep;
                const repSpoke = rep.source === 'spoke';
                const nSpoke = n.source === 'spoke';
                if (!repSpoke && nSpoke) {
                    hit.rep = n;
                    continue;
                }
                if (repSpoke === nSpoke && n.ts < rep.ts) {
                    hit.rep = n;
                }
            }

            for (const c of clusters) {
                const hasStartEdge = c.members.some((m) => Math.abs(m.ts - bodyMinTs) <= edgeTsEps);
                const hasEndEdge = c.members.some((m) => Math.abs(m.ts - bodyMaxTs) <= edgeTsEps);
                const isSeamCluster = hasStartEdge && hasEndEdge;
                const tags = Array.from(new Set(c.members.flatMap((m) => m.tip.tags ?? [])));

                const pickTsList = isSeamCluster
                    ? [bodyMinTs, bodyMaxTs]
                    : [c.rep.ts];
                const rep = c.rep;
                out.push({
                    ...rep,
                    tip: {
                        ...rep.tip,
                        pickTsList,
                        tags
                    }
                });
            }
        }

        return out;
    }

    function applyPendingNodeSnap(targets: CompassTargetState[]): CompassTargetState[] {
        if (!pendingNodeSnap) return targets;
        const snap = pendingNodeSnap;
        let applied = false;

        const out = targets.map((t) => {
            if (t.id !== snap.bodyId) return t;
            const track = t.orbitTrack ?? [];
            if (!track.length) return t;

            const pool = snap.code ? track.filter((p) => p.code === snap.code) : track;
            const xs = pool.length ? pool : track;
            const nearest = xs
                .slice()
                .sort((a, b) => Math.abs(a.ts - snap.ts) - Math.abs(b.ts - snap.ts))[0];
            const p = nearest ?? sampleTrackAtTs(track, snap.ts);
            if (!p) return t;

            applied = true;
            return {
                ...t,
                angleDeg: p.angleDeg,
                orbit: p.orbit,
                azimuthDeg: p.azimuthDeg,
                altitudeDeg: p.altitudeDeg,
                visible: !!p.visible
            };
        });

        if (applied) pendingNodeSnap = null;
        return out;
    }

    function handleMarkerPick(ts0: number, bodyId?: ObjId, code?: string) {
        if (!Number.isFinite(ts0)) return;
        onUserActivity();
        const tipMoment = get(tipState).moment;
        const parsed = parseOrbitNodeDesc(tipMoment?.desc);
        const snapBody = bodyId ?? parsed?.bodyId;
        const baseCode = code ?? parsed?.code;

        const pickTsList = (tipMoment?.pickTsList ?? [])
            .filter((x): x is number => Number.isFinite(x))
            .sort((a, b) => a - b);
        const lastPickTs = pickTsList.length ? pickTsList[pickTsList.length - 1] : NaN;
        const hasCycleEndTag = Array.isArray(tipMoment?.tags) && tipMoment.tags.includes('cycle end');
        const shouldStepToNextCycle =
            baseCode === 'E_next' ||
            baseCode === 'E+' ||
            (Number.isFinite(lastPickTs) && Math.abs(ts0 - lastPickTs) <= 1_000) ||
            (pickTsList.length <= 1 && hasCycleEndTag);

        let pickedTs = shouldStepToNextCycle ? (ts0 + NEXT_CYCLE_PICK_EPS_MS) : ts0;
        const currentTs = Number.isFinite(effTs)
            ? effTs
            : (!time.live && Number.isFinite(time.ts) ? time.ts : NaN);
        if (shouldStepToNextCycle && Number.isFinite(currentTs)) {
            const minForwardTs = currentTs + NEXT_CYCLE_PICK_EPS_MS;
            if (pickedTs < minForwardTs) pickedTs = minForwardTs;
        }
        if (shouldStepToNextCycle && !time.live && Number.isFinite(time.ts) && Math.abs(time.ts - pickedTs) < 1_000) {
            pickedTs += NEXT_CYCLE_PICK_EPS_MS;
        }
        const snapCode = shouldStepToNextCycle ? 'E' : baseCode;
        if (snapBody) pendingNodeSnap = { bodyId: snapBody, ts: pickedTs, code: snapCode };

        if (time.locked) {
            if (wheelId) {
                boardApi.updateWheelTime(
                    wheelId,
                    { live: false, ts: pickedTs, locked: true },
                    'Compass.tip.goLocked'
                );
            }
        } else {
            setSelectedTs(pickedTs);
        }

        tip.closeNow();
    }

    function orbitNodeRadiusVB(node: { tip?: MomentTip }): number {
        const g = orbitNodeGroup(node);
        return g === 'regular' ? (VB * 0.005) : (VB * 0.007);
    }

    // ------------------------------------------------------------
    // Helpers: roles parsing
    // ------------------------------------------------------------
    function asBodyIdArray(v: unknown): ObjId[] {
        if (Array.isArray(v)) return v.filter(Boolean) as ObjId[];
        if (typeof v === 'string' && v) return [v as ObjId];
        return [];
    }

    function asBodyIdOrNull(v: unknown): ObjId | null {
        if (typeof v === 'string' && v) return v as ObjId;
        if (Array.isArray(v) && typeof v[0] === 'string') return (v[0] as ObjId) ?? null;
        return null;
    }

    // ------------------------------------------------------------
    // House mapping helpers
    // ------------------------------------------------------------
    function angDistDeg(a: number, b: number): number {
        const d = Math.abs(norm360(a) - norm360(b));
        return Math.min(d, 360 - d);
    }

    function nearestSpokeByAngle(angleDeg: number): number {
        let bestI = 0;
        let bestD = Infinity;
        for (let i = 0; i < spokeCount; i++) {
            const aSpoke = spokeAngleDeg(i);
            const d = angDistDeg(angleDeg, aSpoke);
            if (d < bestD) { bestD = d; bestI = i; }
        }
        return bestI;
    }

    function azimuthToWheelAngleDeg(azimuthDeg: number): number {
        let a = norm360(azimuthDeg - 90);
        if (a > 180) a -= 360;
        return a;
    }

    function houseLabelForAzimuth(azimuthDeg: number): string {
        const wheelAngle = azimuthToWheelAngleDeg(azimuthDeg);
        const i = nearestSpokeByAngle(wheelAngle);
        return labels[i] ?? '—';
    }

    function houseFromAzimuth(az: number): string {
        const wdeg = azimuthToWheelAngleDeg(az);
        const i = nearestSpokeByAngle(wdeg);
        return labels[i] ?? '—';
    }

    function fmtNodeDeg(x: number): string {
        return Number.isFinite(x) ? `${x.toFixed(1)}°` : '—';
    }

    function fmtNodeDistAu(x: number): string {
        if (!Number.isFinite(x)) return '—';
        return `${x.toFixed(3)} AU`;
    }

    function nodeInfoItemsFromSpec(
        source: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal' | undefined,
        code: string,
        meta: Record<string, unknown>
    ): CompassInfoChip[] {
        if (!source) return [];
        const specRaw = (wheels as Record<string, unknown>)[source] as { info?: InfoItem[] } | undefined;
        const defs = Array.isArray(specRaw?.info) ? specRaw.info : [];
        const out: CompassInfoChip[] = [];
        for (const def of defs) {
            const defaultLabel = String(def?.defaultLabel ?? '').trim();
            if (!defaultLabel) continue;
            const applies = !def.spokes || def.spokes === '*' || (Array.isArray(def.spokes) && def.spokes.includes(code as any));
            if (!applies) continue;
            const label = uiLabel(defaultLabel);
            if (def.metaField) {
                const rawValue = meta?.[def.metaField];
                if (rawValue == null || rawValue === '') continue;
                const formatInput = (typeof rawValue === 'number' || typeof rawValue === 'string' || rawValue == null)
                    ? rawValue
                    : String(rawValue);
                const value = def.format ? formatInfoValue(def.format, formatInput) : String(formatInput);
                out.push({
                    id: `dynamic:${tagIdFromLabel(label)}`,
                    label,
                    value,
                    modal: typeof def.modal === 'string' ? def.modal : undefined
                });
                continue;
            }
            out.push({
                id: `dynamic:${tagIdFromLabel(label)}`,
                label,
                modal: typeof def.modal === 'string' ? def.modal : undefined
            });
        }
        return out;
    }

    function normalizeBodyInfoMeta(t: CompassTargetState): CompassBodyInfoMeta {
        const raw = (t as any).infoMeta;
        if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const hasNestedSources =
                ('horizon' in obj) || ('synod' in obj) || ('bind' in obj) || ('nodal' in obj);
            if (hasNestedSources) {
                return obj as CompassBodyInfoMeta;
            }
        }
        return {};
    }

    // ------------------------------------------------------------
    // Role emoji placements (center / label / spoke)
    // ------------------------------------------------------------
    function roleEmojiById(id: ObjId | null | undefined): string | null {
        if (!id) return null;
        const b = (objects as any)[id] as { emoji?: string } | undefined;
        return b?.emoji ?? null;
    }

    type UiAnchor =
        | { kind: 'center' }
        | { kind: 'label'; spoke: string }
        | { kind: 'spoke'; spoke: string };

    function anchorKey(a: UiAnchor): string {
        if (a.kind === 'center') return 'center';
        return `${a.kind}:${a.spoke}`;
    }

    function parsePlacement(p: EmojiPlacement): UiAnchor | null {
        if (p === 'center') return { kind: 'center' };
        if (p === 'pointer') return null;
        if (p.endsWith('-spoke')) return { kind: 'spoke', spoke: p.slice(0, -'-spoke'.length) };
        return { kind: 'label', spoke: p };
    }

    function parsePlacements(p: EmojiPlacementInput | undefined): UiAnchor[] {
        if (!p) return [];
        const arr = Array.isArray(p) ? p : [p];
        return arr.map((x) => parsePlacement(x)).filter((x): x is UiAnchor => !!x);
    }

    type EmojiAt = { anchor: UiAnchor; text: string };

    let spec: WheelSpec | null = null;
    let emojiAt: EmojiAt[] = [];
    let centerEmoji: string | null = null;

    function roleTargetIds(raw: unknown): ObjId[] {
        if (Array.isArray(raw)) return raw.filter((x): x is ObjId => typeof x === 'string' && !!x);
        if (typeof raw === 'string' && raw) return [raw as ObjId];
        return [];
    }

    $: {
        spec = wheel?.wheelType ? ((wheels as any)[wheel.wheelType] as WheelSpec) : null;

        const ui = (spec as any)?.ui as Partial<Record<RoleName, EmojiPlacementInput>> | undefined;
        const draws: Array<{ anchor: UiAnchor; emoji: string }> = [];

        const focusId = (wheel?.roles as any)?.focus as ObjId | null;
        const lookerId = (wheel?.roles as any)?.looker as ObjId | null;
        const targetIds = roleTargetIds((wheel?.roles as any)?.target);

        if (ui?.focus && focusId) {
            const e = roleEmojiById(focusId);
            if (e) {
                for (const a of parsePlacements(ui.focus)) draws.push({ anchor: a, emoji: e });
            }
        }

        if (ui?.looker && lookerId) {
            const e = roleEmojiById(lookerId);
            if (e) {
                for (const a of parsePlacements(ui.looker)) draws.push({ anchor: a, emoji: e });
            }
        }

        if (ui?.target && targetIds.length) {
            const anchors = parsePlacements(ui.target);
            if (anchors.length) {
                for (const id of targetIds) {
                    const e = roleEmojiById(id);
                    if (!e) continue;
                    for (const a of anchors) draws.push({ anchor: a, emoji: e });
                }
            }
        }

        const m = new Map<string, { anchor: UiAnchor; parts: string[] }>();
        for (const d of draws) {
            const k = anchorKey(d.anchor);
            const cur = m.get(k) ?? { anchor: d.anchor, parts: [] };
            cur.parts.push(d.emoji);
            m.set(k, cur);
        }

        emojiAt = Array.from(m.values()).map((x) => ({ anchor: x.anchor, text: x.parts.join('') }));
    }

    function emojiAtCenter(): string | null {
        return emojiAt.find((x) => x.anchor.kind === 'center')?.text ?? null;
    }

    function emojiAtLabel(label: string): string | null {
        return emojiAt.find((x) => x.anchor.kind === 'label' && x.anchor.spoke === label)?.text ?? null;
    }

    function emojiAtSpoke(label: string): string | null {
        return emojiAt.find((x) => x.anchor.kind === 'spoke' && x.anchor.spoke === label)?.text ?? null;
    }

    $: {
        centerEmoji = emojiAtCenter();
    }

    // ------------------------------------------------------------
    // Solve via unified dispatcher (async, race-safe)
    // ------------------------------------------------------------
    $: solveTargetsKey = JSON.stringify(asBodyIdArray((roles as any)?.target));
    $: solveLookerKey = String(asBodyIdOrNull((roles as any)?.looker) ?? '');
    $: solveFocusKey = String(asBodyIdOrNull((roles as any)?.focus) ?? '');
    $: solveLocationKey = String(wheelLoc?.id ?? '');
    $: solveDepsKey = `${wheelId ?? ''}|${wheel?.wheelType ?? ''}|${solveLookerKey}|${solveFocusKey}|${solveTargetsKey}|${solveLocationKey}`;
    $: solveInputReady = !!wheel && !!wheelLoc && asBodyIdArray((roles as any)?.target).length > 0 && wheelLat != null && wheelLon != null;

    let ensureRunId = 0;
    let solvePending = false;
    let solveDoneForKey = false;
    let solveDoneKey = '';
    $: if (solveDoneKey !== solveDepsKey) {
        solveDoneKey = solveDepsKey;
        solveDoneForKey = false;
    }
    $: showLoadingOverlay = solveInputReady && (solvePending || !solveDoneForKey);

    async function ensureCompassForTs(ts: number) {
        const myRun = ++ensureRunId;
        solvePending = true;

        const targets = asBodyIdArray((roles as any)?.target);
        // const looker = asBodyIdOrNull((roles as any)?.looker) ?? 'Earth';

        if (!wheel || !wheelLoc || !targets.length || wheelLat == null || wheelLon == null) {
            markerClusters = [];
            lastTargets = [];
            displayTargets = [];
            solveDoneForKey = true;
            if (ensureRunId === myRun) solvePending = false;
            return;
        }

        try {
            const ctx = {
                ts,
                location: wheelLoc,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
            };

            const res: WheelSolveResult = await resolveWheel(wheel as any, ctx);

            if (ensureRunId !== myRun) return;

            if (!res || res.kind !== 'compass' || !res.ok) {
                markerClusters = [];
                lastTargets = [];
                displayTargets = [];
                solveDoneForKey = true;
                return;
            }

            const solvedTargets = (res.bodies as CompassTargetState[]) ?? [];
            lastTargets = applyPendingNodeSnap(solvedTargets);
            animateDisplayTargets(lastResolvedTs, ts, lastTargets);
            lastResolvedTs = ts;
            solveDoneForKey = true;
        } finally {
            if (ensureRunId === myRun) solvePending = false;
        }
    }

    $: {
        void solveDepsKey;
        void ensureCompassForTs(effTs);
    }

    $: {
        const looker = asBodyIdOrNull((roles as any)?.looker) ?? 'Earth';
        const visibleDisplayTargets = displayTargets.filter((t) => !t.hiddenDuringTween);
        const items: MarkerItem[] = compassTargetsToMarkerItems(effTs, visibleDisplayTargets, looker);
        markerClusters = compassClusters(items, orbitToRadiusVB, MIN_ARC_PX);
    }

    $: orbitCurves = lastTargets
        .flatMap((t) => {
            const track = t.orbitTrack;
            if (!track || track.length < 2) return [];

            const segments = splitTrackByVisibility(track);
            return segments
                .map((s, idx) => {
                    if (!s.pts || s.pts.length < 2) return null;
                    const d = trackPathD(s.pts);
                    if (!d) return null;
                    return {
                        id: t.id,
                        seg: idx,
                        d,
                        visible: s.visible
                    };
                })
                .filter((x): x is { id: ObjId; seg: number; d: string; visible: boolean } => !!x);
        })
        .filter((x): x is { id: ObjId; seg: number; d: string; visible: boolean } => !!x);

    $: orbitNodes = (() => {
        const bodyPos = new Map<ObjId, { x: number; y: number }>();
        for (const t of lastTargets) {
            const r = orbitToRadiusVB(t.orbit);
            const p = polarToXY(r, t.angleDeg);
            bodyPos.set(t.id, { x: p.x, y: p.y });
        }

        const rawNodes: OrbitNodeUi[] = lastTargets
        .flatMap((t) => {
            const b = (objects as any)[t.id] as { emoji?: string; name?: { en?: string } } | undefined;
            const emoji = b?.emoji ?? '•';
            const name = b?.name?.en ?? String(t.id);
            const isSystemWheel = wheel?.wheelType === 'system';
            const distanceLabel = typeof (t as any).distanceLabel === 'string' && (t as any).distanceLabel
                ? (t as any).distanceLabel
                : 'Dist';
            const trackTs = (t.orbitTrack ?? [])
                .map((q) => q.ts)
                .filter((v): v is number => Number.isFinite(v));
            const trackMinTs = trackTs.length ? Math.min(...trackTs) : NaN;
            const trackMaxTs = trackTs.length ? Math.max(...trackTs) : NaN;
            const nodeTrack = t.orbitTrack ?? [];
            return nodeTrack
                .map((p) => {
                const r = orbitToRadiusVB(p.orbit);
                const xy = polarToXY(r, p.angleDeg);
                const pointTags = Array.isArray(p.tags) ? p.tags.filter((x): x is string => typeof x === 'string') : [];
                const pointTechTags = nodeTechTagsFromTags(pointTags);
                const sourceWheel = p.sourceWheel;
                const pointMeta = (p.meta && typeof p.meta === 'object') ? p.meta : {};
                const infoItems = nodeInfoItemsFromSpec(sourceWheel, p.code, pointMeta);
                const nextSynodBoundaryTs = (t.orbitTrack ?? [])
                    .filter((q) => q.source === 'spoke' && q.code === 'E_next' && Number.isFinite(q.ts))
                    .map((q) => q.ts)
                    .sort((a, b) => a - b)[0];
                const isDualCycleNode =
                    wheel?.wheelType === 'system' &&
                    pointTags.includes('cycle start') &&
                    pointTags.includes('cycle end') &&
                    Number.isFinite(trackMinTs) &&
                    Number.isFinite(trackMaxTs) &&
                    trackMaxTs > trackMinTs;
                const pickTsList = isDualCycleNode
                    ? [
                        p.ts,
                        Number.isFinite(nextSynodBoundaryTs) ? (nextSynodBoundaryTs as number) : trackMaxTs
                    ]
                    : undefined;
                const primaryLabel = isSystemWheel ? 'Phase' : 'Az';
                const primaryDeg = isSystemWheel ? Number((p as any).phaseDeg ?? NaN) : p.azimuthDeg;
                const secondaryLabel = isSystemWheel ? 'Ecl' : 'Alt';
                const secondaryDeg = p.altitudeDeg;
                const distAu = Number((p as any).distanceAu);
                const metaParts = [
                    `${primaryLabel} ${fmtNodeDeg(primaryDeg)}`,
                    `${secondaryLabel} ${fmtNodeDeg(secondaryDeg)}`,
                    Number.isFinite(distAu) ? `${distanceLabel} ${fmtNodeDistAu(distAu)}` : ''
                ].filter((x) => !!x);
                const metaText = metaParts.join(' • ');
                const uiCode = formatSpokeCodeUi(p.code);
                const infoCopyParts = infoItems.map((item) =>
                    item.value ? `${item.label} - ${item.value}` : item.label
                );
                const copyParts = [
                    `${emoji} ${name} orbit node (${uiCode})`,
                    ...metaParts,
                    ...infoCopyParts,
                    ...pointTechTags.map((tag) => `Node ${tag}`),
                    `ts ${Math.round(p.ts)}`
                ];
                const keyTags = pointTags.length ? pointTags.join(',') : 'no-tags';
                return {
                    key: `orbit-node:${t.id}:${p.code}:${p.source ?? 'cycle'}:${p.index}:${p.ts}:${keyTags}`,
                    x: xy.x,
                    y: xy.y,
                    visible: p.visible,
                    bodyId: t.id,
                    code: p.code,
                    source: p.source,
                    sourceWheel,
                    meta: pointMeta,
                    infoItems,
                    ts: p.ts,
                    tip: {
                        label: `${emoji} ${name} orbit node (${uiCode})`,
                        ts: p.ts,
                        desc: `orbit-node:${t.id}:${p.code}`,
                        tags: pointTags,
                        techTags: pointTechTags,
                        pickTsList,
                        infoItems,
                        metaParts,
                        metaText,
                        copyText: copyParts.join(' | ')
                    } satisfies MomentTip
                };
            });
        })
        ;

        const mergedNodes = dedupeOrbitNodesByBody(rawNodes);
        orbitNodesAll = mergedNodes;

        return mergedNodes.filter((n) => {
            const bp = bodyPos.get(n.bodyId);
            if (!bp) return true;
            const dx = n.x - bp.x;
            const dy = n.y - bp.y;
            return Math.hypot(dx, dy) > BODY_MARKER_HIDE_RADIUS_VB;
        });
    })();

    // table rows for tooltip / pinned row
    $: allBodies = lastTargets.map(t => {
        const b = (objects as any)[t.id] as { emoji?: string; name?: { en?: string } } | undefined;
        const name = b?.name?.en ?? String(t.id);
        const emoji = b?.emoji ?? '•';
        const house = houseLabelForAzimuth(t.azimuthDeg);
        const isSystemWheel = wheel?.wheelType === 'system';
        const primaryDeg = isSystemWheel ? Number((t as any).phaseDeg ?? NaN) : t.azimuthDeg;
        const secondaryDeg = t.altitudeDeg;
        const bodyR = orbitToRadiusVB(t.orbit);
        const bodyXY = polarToXY(bodyR, t.angleDeg);

        const activeNode = orbitNodesAll
            .filter((n) => n.bodyId === t.id)
            .map((n) => ({
                node: n,
                d: Math.hypot(n.x - bodyXY.x, n.y - bodyXY.y)
            }))
            .filter((x) => x.d <= BODY_MARKER_HIDE_RADIUS_VB)
            .sort((a, b) => {
                const aSpoke = a.node.source === 'spoke' ? 1 : 0;
                const bSpoke = b.node.source === 'spoke' ? 1 : 0;
                if (aSpoke !== bSpoke) return bSpoke - aSpoke;
                if (a.d !== b.d) return a.d - b.d;
                return a.node.ts - b.node.ts;
            })[0]?.node?.tip ?? null;

        return {
            id: t.id,
            emoji,
            name,
            distanceAu: Number.isFinite((t as any).distanceAu) ? Number((t as any).distanceAu) : NaN,
            distanceLabel: typeof (t as any).distanceLabel === 'string' && (t as any).distanceLabel
                ? (t as any).distanceLabel
                : 'Dist',
            primaryDeg,
            secondaryDeg,
            primaryLabel: isSystemWheel ? 'Phase' : 'Az',
            secondaryLabel: isSystemWheel ? 'Ecl' : 'Alt',
            aboveLabel: isSystemWheel ? 'north' : 'above',
            belowLabel: isSystemWheel ? 'south' : 'below',
            house,
            visible: Number.isFinite(secondaryDeg) ? secondaryDeg >= 0 : true,
            infoMeta: normalizeBodyInfoMeta(t),
            activeNode
        };
    });

    // occupied spokes: only if at least one visible body in that house
    let occupiedSpokes: boolean[] = [];
    $: {
        const isSystemWheel = wheel?.wheelType === 'system';
        const occ = Array.from({ length: spokeCount }, () => false);
        for (const b of allBodies) {
            if (!isSystemWheel && !b.visible) continue;
            const i = labels.indexOf(b.house as any);
            if (i >= 0) occ[i] = true;
        }
        occupiedSpokes = occ;
    }

    $: pinnedRow = (() => {
        if (!pinnedBodyId) return null;
        const t = lastTargets?.find((x) => x.id === pinnedBodyId);
        if (!t) return null;

        const emoji = (objects as any)?.[pinnedBodyId]?.emoji ?? '•';
        const name = (objects as any)?.[pinnedBodyId]?.name?.en ?? String(pinnedBodyId);

        return {
            id: pinnedBodyId,
            emoji,
            name,
            distanceAu: Number.isFinite((t as any).distanceAu) ? Number((t as any).distanceAu) : NaN,
            distanceLabel: typeof (t as any).distanceLabel === 'string' && (t as any).distanceLabel
                ? (t as any).distanceLabel
                : 'Dist',
            house: houseFromAzimuth(t.azimuthDeg),
            primaryDeg: wheel?.wheelType === 'system' ? Number((t as any).phaseDeg ?? NaN) : t.azimuthDeg,
            secondaryDeg: t.altitudeDeg,
            primaryLabel: wheel?.wheelType === 'system' ? 'Phase' : 'Az',
            secondaryLabel: wheel?.wheelType === 'system' ? 'Ecl' : 'Alt',
            visible: !!t.visible
        };
    })();

    function buildHouseTip(label: string): MomentTip {
        return { label, ts: effTs, desc: `house:${label}` };
    }

    // ------------------------------------------------------------
    // Responsive + tooltip
    // ------------------------------------------------------------
    const responsive = useWheelResponsive();
    let size = 360;
    $: size = responsive.size;

    let wrapEl: HTMLDivElement | null = null;
    $: responsive.bindWrap(wrapEl);

    let isCoarsePointer = false;
    $: isCoarsePointer = responsive.isCoarsePointer;

    function handleMarkerActivate(c: MarkerCluster) {
        dbg.log('Cluster Activate', c);
    }

    function centerClickEvent(target: EventTarget | null): MouseEvent | null {
        if (!(target instanceof Element)) return null;
        const r = target.getBoundingClientRect();
        return new MouseEvent('click', {
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
        });
    }

    function handleHouseKeydown(e: KeyboardEvent, houseTip: MomentTip) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const ev = centerClickEvent(e.currentTarget);
        if (ev) tip.openMomentNow(ev, houseTip);
    }

    function handleOrbitNodeKeydown(e: KeyboardEvent, nodeTip: MomentTip) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const ev = centerClickEvent(e.currentTarget);
        if (ev) tip.openMomentNow(ev, nodeTip);
    }

    function handleSpokeDoubleClick(spokeCode: string) {
        if (!pinnedBodyId) return;

        const candidates = orbitNodes.filter((n) =>
            n.bodyId === pinnedBodyId &&
            n.code === spokeCode &&
            n.source === 'spoke' &&
            (n.tip.pickTsList?.length ?? 1) === 1
        );
        if (!candidates.length) return;

        const best = candidates.reduce((acc, cur) =>
            Math.abs(cur.ts - effTs) < Math.abs(acc.ts - effTs) ? cur : acc
        );
        handleMarkerPick(best.ts, best.bodyId, best.code);
    }

    const tip = useTooltip({
        isCoarsePointer: () => isCoarsePointer,
        onActivateCluster: (c) => handleMarkerActivate(c),
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });
    const tipState = tip.state;

    onDestroy(() => {
        stopMarkerTween();
    });

    $: showVisualSection = wheel?.view?.showVisual !== false;
    $: showInfoSection = wheel?.view?.showInfo === true;
    $: showPickersSection = wheel?.view?.showPickers === true;

    function toggleVisualSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showVisual: !showVisualSection } },
            'Compass.toggleVisualSection'
        );
    }

    function toggleInfoSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showInfo: !showInfoSection } },
            'Compass.toggleInfoSection'
        );
    }

    function togglePickersSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showPickers: !showPickersSection } },
            'Compass.togglePickersSection'
        );
    }

    type CompassInfoChip = {
        id: string;
        label: string;
        value?: string;
        modal?: string;
    };

    type CompassDynamicRow = {
        id: ObjId;
        emoji: string;
        name: string;
        houseCode: string;
        houseLabel: string;
        pinned: boolean;
        items: CompassInfoChip[];
    };

    type CompassHouseDef = {
        id: string;
        code: string;
        label: string;
    };

    type CompassBodyInfoMeta = Partial<Record<'horizon' | 'synod' | 'bind' | 'nodal', Record<string, unknown>>>;

    type CompassBodyRow = {
        id: ObjId;
        emoji: string;
        name: string;
        distanceAu: number;
        distanceLabel: string;
        primaryDeg: number;
        secondaryDeg: number;
        primaryLabel: string;
        secondaryLabel: string;
        aboveLabel: string;
        belowLabel: string;
        house: string;
        visible: boolean;
        activeNode: MomentTip | null;
        infoMeta: CompassBodyInfoMeta;
    };

    type CompassPinnedInfoRow = {
        id: string;
        bodyId: ObjId;
        emoji: string;
        name: string;
        nodes: Array<{
            id: string;
            label: string;
            ts: number;
            code: string;
            source: OrbitNodeGroup;
            disabled?: boolean;
        }>;
    };

    type CompassTagScope = 'dynamic' | 'pinned';
    type CompassTagDef = {
        id: string;
        label: string;
        scope: CompassTagScope;
        enabledByDefault: boolean;
        modal?: string;
        source?: 'horizon' | 'synod' | 'bind' | 'nodal';
        metaField?: string;
        format?: string;
        spokes?: string[] | '*';
        group?: OrbitNodeGroup;
    };

    let compassInfoConfigWheelId = '';
    let compassInfoConfigInitialized = false;
    let compassInfoConfig: CompassInfoConfig = {
        general: { enabled: false, tags: [] },
        houses: { tags: [] },
        dynamic: { enabled: true, tags: [] },
        pinned: {
            enabled: true,
            groups: {
                regular: true,
                compass: true,
                horizon: true,
                nodal: true,
                synod: true,
                bind: true
            },
            tags: []
        }
    };
    let compassTagDefs: CompassTagDef[] = [];
    let compassTagDefById: Map<string, CompassTagDef> = new Map();
    let defaultCompassInfoConfig: CompassInfoConfig = {
        general: { enabled: false, tags: [] },
        houses: { tags: [] },
        dynamic: { enabled: true, tags: [] },
        pinned: { enabled: true, groups: defaultCompassGroups(), tags: [] }
    };
    let compassDynamicRows: CompassDynamicRow[] = [];
    let compassDynamicDisabledIds = new Set<string>();
    let compassPinnedRows: CompassPinnedInfoRow[] = [];
    let compassGeneralChips: CompassInfoChip[] = [];
    let compassHouseDefs: CompassHouseDef[] = [];
    let pinnedAvailableGroups: OrbitNodeGroup[] = ['regular'];

    function normalizeCompassTag(input: CompassInfoTagConfig | null | undefined): CompassInfoTagConfig | null {
        if (!input || !input.id) return null;
        const id = String(input.id).trim();
        if (!id) return null;
        const out: CompassInfoTagConfig = {
            id,
            enabled: input.enabled !== false
        };
        if (typeof input.label === 'string' && input.label.trim()) out.label = input.label.trim();
        if (typeof input.value === 'string') out.value = input.value;
        if (typeof input.modal === 'string') out.modal = input.modal;
        if (input.isCustom === true) out.isCustom = true;
        return out;
    }

    function defaultCompassGroups(): CompassInfoGroupConfig {
        return {
            regular: true,
            compass: true,
            horizon: true,
            nodal: true,
            synod: true,
            bind: true
        };
    }

    function normalizeCompassGroups(input: CompassInfoGroupConfig | null | undefined): CompassInfoGroupConfig {
        const src = (input ?? defaultCompassGroups()) as CompassInfoGroupConfig & { seam?: boolean };
        return {
            regular: src.regular !== false,
            compass: src.compass !== false,
            horizon: (typeof src.horizon === 'boolean' ? src.horizon : src.seam) !== false,
            nodal: (typeof src.nodal === 'boolean' ? src.nodal : src.seam) !== false,
            synod: src.synod !== false,
            bind: src.bind !== false
        };
    }

    function normalizeCompassInfoConfig(defaults: CompassInfoConfig, input: unknown): CompassInfoConfig {
        const src = (input && typeof input === 'object') ? (input as Partial<CompassInfoConfig>) : {};
        return {
            general: {
                enabled: typeof src.general?.enabled === 'boolean' ? src.general.enabled : defaults.general.enabled,
                tags: Array.isArray(src.general?.tags)
                    ? src.general!.tags.map((x) => normalizeCompassTag(x)).filter((x): x is CompassInfoTagConfig => !!x)
                    : defaults.general.tags.map((x) => ({ ...x }))
            },
            houses: {
                tags: Array.isArray(src.houses?.tags)
                    ? src.houses!.tags.map((x) => normalizeCompassTag(x)).filter((x): x is CompassInfoTagConfig => !!x)
                    : defaults.houses.tags.map((x) => ({ ...x }))
            },
            dynamic: {
                enabled: typeof src.dynamic?.enabled === 'boolean' ? src.dynamic.enabled : defaults.dynamic.enabled,
                tags: Array.isArray(src.dynamic?.tags)
                    ? src.dynamic!.tags.map((x) => normalizeCompassTag(x)).filter((x): x is CompassInfoTagConfig => !!x)
                    : defaults.dynamic.tags.map((x) => ({ ...x }))
            },
            pinned: {
                enabled: typeof src.pinned?.enabled === 'boolean' ? src.pinned.enabled : defaults.pinned.enabled,
                groups: normalizeCompassGroups(src.pinned?.groups ?? defaults.pinned.groups),
                tags: Array.isArray(src.pinned?.tags)
                    ? src.pinned!.tags.map((x) => normalizeCompassTag(x)).filter((x): x is CompassInfoTagConfig => !!x)
                    : defaults.pinned.tags.map((x) => ({ ...x }))
            }
        };
    }

    function applyCompassInfoConfig(next: CompassInfoConfig) {
        if ($isActiveProfileLocked) return;
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { compassInfoConfig: next } },
            'Compass.configureInfoBlock'
        );
    }

    function handleCompassBodyPick(bodyId: ObjId) {
        togglePin(bodyId);
    }

    function handleCompassPinnedPick(ts: number, bodyId: ObjId, code?: string) {
        handleMarkerPick(ts, bodyId, code);
    }

    function uiLabel(raw: string): string {
        return formatLabelTitleCaseUi(String(raw ?? ''));
    }

    function tagIdFromLabel(label: string): string {
        const base = String(label ?? '')
            .toLowerCase()
            .replace(/\+/g, ' plus ')
            .replace(/[\s-]+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return base || 'item';
    }

    type CompassPinnedRawRow = {
        id: string;
        bodyId: ObjId;
        ts: number;
        source: OrbitNodeGroup;
        code: string;
        techName: string;
        sourceWheel: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
        disabled?: boolean;
    };

    function activeSourcesForWheelType(type: string | undefined): Array<'horizon' | 'synod' | 'bind' | 'nodal'> {
        if (type === 'compass') return ['horizon'];
        if (type === 'system') return ['synod', 'bind', 'nodal'];
        return [];
    }

    function specInfoRowsFor(source: 'horizon' | 'synod' | 'bind' | 'nodal'): InfoItem[] {
        const specRaw = (wheels as Record<string, unknown>)[source] as { info?: InfoItem[] } | undefined;
        return Array.isArray(specRaw?.info) ? specRaw.info : [];
    }

    function buildSourceTagDefs(scope: CompassTagScope, source: 'horizon' | 'synod' | 'bind' | 'nodal'): CompassTagDef[] {
        const rows = specInfoRowsFor(source);
        const out: CompassTagDef[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
            const defaultLabel = String(row?.defaultLabel ?? '').trim();
            if (!defaultLabel) continue;
            const id = `${scope}:${source}:${tagIdFromLabel(defaultLabel)}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const enabledByDefault = scope === 'dynamic'
                ? (row.enabled !== false)
                : (typeof row.enabledStatic === 'boolean' ? row.enabledStatic : row.enabled !== false);
            out.push({
                id,
                label: uiLabel(defaultLabel),
                scope,
                enabledByDefault,
                modal: typeof row.modal === 'string' ? row.modal : undefined,
                source,
                metaField: typeof row.metaField === 'string' ? row.metaField : undefined,
                format: typeof row.format === 'string' ? row.format : undefined,
                spokes: row.spokes
            });
        }
        return out;
    }

    function dedupeTagDefsByLabel(defs: CompassTagDef[]): CompassTagDef[] {
        const out: CompassTagDef[] = [];
        const seen = new Set<string>();
        for (const def of defs) {
            const key = chipLabelKey(def.label);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(def);
        }
        return out;
    }

    function houseTypeForWheel(specValue: WheelSpec | null | undefined): 'horizon' | 'synod' | 'bind' | 'nodal' | 'compass' {
        const fromSpec = (specValue as any)?.houseType;
        if (fromSpec === 'horizon' || fromSpec === 'synod' || fromSpec === 'bind' || fromSpec === 'nodal' || fromSpec === 'compass') {
            return fromSpec;
        }
        const type = (specValue as any)?.type;
        if (type === 'compass') return 'compass';
        if (type === 'system') return 'synod';
        return 'horizon';
    }

    function buildHouseDefsForWheel(specValue: WheelSpec | null | undefined): CompassHouseDef[] {
        const houseType = houseTypeForWheel(specValue);
        return SPOKES_ORDER.map((code) => {
            const id = `house:${code}`;
            return {
                id,
                code,
                label: formatLabelTitleCaseUi(`${formatSpokeCodeUi(code)}-${houseType}`)
            };
        });
    }

    function nodeTechTag(node: OrbitNodeUi): string {
        const source = node.sourceWheel ?? (wheel?.wheelType === 'compass' ? 'horizon' : 'node');
        return formatLabelTitleCaseUi(`${formatSpokeCodeUi(node.code)}-${source}`);
    }

    function isSpokeCode(value: string): boolean {
        const normalized = value === 'E+' ? 'E_next' : value;
        return SPOKES_ORDER.includes(normalized as any);
    }

    function nodeTechTagsFromTags(tags: string[]): string[] {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const rawTag of tags) {
            const tag = String(rawTag ?? '').trim();
            const dashAt = tag.lastIndexOf('-');
            if (dashAt <= 0 || dashAt >= tag.length - 1) continue;

            const spokeRaw = tag.slice(0, dashAt);
            const source = tag.slice(dashAt + 1).toLowerCase();
            if (source !== 'compass' && source !== 'horizon' && source !== 'nodal' && source !== 'synod' && source !== 'bind') {
                continue;
            }
            const spokeCode = spokeRaw === 'E+' ? 'E_next' : spokeRaw;
            if (!isSpokeCode(spokeCode)) continue;

            const label = formatLabelTitleCaseUi(`${spokeCode}-${source}`);
            if (!label || seen.has(label)) continue;
            seen.add(label);
            out.push(label);
        }
        return out;
    }

    function groupFromNodeTag(tag: string): OrbitNodeGroup {
        return groupFromSpecTag(tag) ?? 'regular';
    }

    type NodeTechEntry = {
        label: string;
        code: string;
        group: OrbitNodeGroup;
        sourceWheel: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
    };

    function entryTsFromNode(node: OrbitNodeUi, entry: NodeTechEntry): number {
        const fallbackTs = Number.isFinite(node.ts) ? node.ts : NaN;
        const picks = Array.isArray(node.tip.pickTsList)
            ? node.tip.pickTsList.filter((x): x is number => Number.isFinite(x)).sort((a, b) => a - b)
            : [];
        if (picks.length < 2) return fallbackTs;
        if (entry.code === 'E') return picks[0];
        if (entry.code === 'E_next') return picks[picks.length - 1];
        return fallbackTs;
    }

    function nodeTechEntries(node: OrbitNodeUi): NodeTechEntry[] {
        const tags = nodeTagsOf(node);
        const out: NodeTechEntry[] = [];
        const seen = new Set<string>();

        for (const rawTag of tags) {
            const tag = String(rawTag ?? '').trim();
            const dashAt = tag.lastIndexOf('-');
            if (dashAt <= 0 || dashAt >= tag.length - 1) continue;

            const spokeRaw = tag.slice(0, dashAt);
            const source = tag.slice(dashAt + 1).toLowerCase();
            const spokeCode = spokeRaw === 'E+' ? 'E_next' : spokeRaw;
            if (!isSpokeCode(spokeCode)) continue;

            const group = groupFromNodeTag(tag);

            const label = formatLabelTitleCaseUi(`${spokeCode}-${source}`);
            const key = `${label}|${group}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ label, code: spokeCode, group, sourceWheel: source as 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal' });
        }

        if (out.length) return out;
        const group = pinnedGroupFromNode(node);
        const fallbackSource = node.sourceWheel;
        if (fallbackSource !== 'compass' && fallbackSource !== 'horizon' && fallbackSource !== 'synod' && fallbackSource !== 'bind' && fallbackSource !== 'nodal') {
            return [];
        }
        return [{
            label: nodeTechTag(node),
            code: node.code === 'E+' ? 'E_next' : node.code,
            group,
            sourceWheel: fallbackSource
        }];
    }

    function applyMainCycleWindow<T extends CompassPinnedRawRow>(rows: T[], nowTs: number): T[] {
        const mainCycle = mainCycleSourceForActiveWheel();
        if (!mainCycle) return rows.slice().sort((a, b) => a.ts - b.ts);

        const sorted = rows
            .filter((row) => Number.isFinite(row.ts))
            .slice()
            .sort((a, b) => a.ts - b.ts);
        if (!sorted.length) return [];

        const starts = sorted.filter((row) => row.sourceWheel === mainCycle && row.code === 'E');
        const ends = sorted.filter((row) => row.sourceWheel === mainCycle && row.code === 'E_next');
        if (!starts.length || !ends.length) return sorted;

        let best: { start: T; end: T } | null = null;
        let bestInside = Number.POSITIVE_INFINITY;
        let bestDist = Number.POSITIVE_INFINITY;
        let bestSpan = Number.POSITIVE_INFINITY;

        for (const start of starts) {
            const end = ends.find((candidate) => candidate.ts > start.ts);
            if (!end) continue;
            const insidePenalty = (start.ts <= nowTs && nowTs < end.ts) ? 0 : 1;
            const distPenalty = insidePenalty === 0
                ? Math.abs(nowTs - start.ts)
                : Math.min(Math.abs(nowTs - start.ts), Math.abs(nowTs - end.ts));
            const span = end.ts - start.ts;
            if (
                insidePenalty < bestInside ||
                (insidePenalty === bestInside && distPenalty < bestDist) ||
                (insidePenalty === bestInside && distPenalty === bestDist && span < bestSpan)
            ) {
                best = { start, end };
                bestInside = insidePenalty;
                bestDist = distPenalty;
                bestSpan = span;
            }
        }

        if (!best) return sorted;

        const inWindow = sorted.filter((row) => row.ts >= best.start.ts && row.ts <= best.end.ts);
        const startKey = `${best.start.techName}:${best.start.ts}:${best.start.sourceWheel}`;
        const endKey = `${best.end.techName}:${best.end.ts}:${best.end.sourceWheel}`;
        const keyed = new Set(inWindow.map((row) => `${row.techName}:${row.ts}:${row.sourceWheel}`));
        if (!keyed.has(startKey)) inWindow.unshift(best.start);
        if (!keyed.has(endKey)) inWindow.push(best.end);

        return inWindow.sort((a, b) => {
            if (a.ts !== b.ts) return a.ts - b.ts;
            const aStart = a.sourceWheel === mainCycle && a.code === 'E';
            const bStart = b.sourceWheel === mainCycle && b.code === 'E';
            if (aStart !== bStart) return aStart ? -1 : 1;
            const aEnd = a.sourceWheel === mainCycle && a.code === 'E_next';
            const bEnd = b.sourceWheel === mainCycle && b.code === 'E_next';
            if (aEnd !== bEnd) return aEnd ? 1 : -1;
            return a.techName.localeCompare(b.techName);
        });
    }

    function isMainCycleBoundaryRow(row: { sourceWheel: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal'; code: string }): boolean {
        const mainCycle = mainCycleSourceForActiveWheel();
        if (!mainCycle) return false;
        if (row.sourceWheel !== mainCycle) return false;
        return row.code === 'E' || row.code === 'E_next';
    }

    function buildPinnedNodeDefs(): CompassTagDef[] {
        const byId = new Map<string, { def: CompassTagDef; ts: number }>();
        for (const node of orbitNodesAll) {
            for (const entry of nodeTechEntries(node)) {
                const id = `pinned-node:${tagIdFromLabel(entry.label)}`;
                const prev = byId.get(id);
                const ts = Number.isFinite(node.ts) ? node.ts : Number.POSITIVE_INFINITY;
                if (prev && prev.ts <= ts) continue;
                byId.set(id, {
                    ts,
                    def: {
                        id,
                        label: entry.label,
                        scope: 'pinned',
                        enabledByDefault: true,
                        group: entry.group
                    }
                });
            }
        }
        return Array.from(byId.values())
            .sort((a, b) => a.ts - b.ts)
            .map((x) => x.def);
    }

    function tagAppliesToCode(def: CompassTagDef, code: string): boolean {
        if (!def.spokes || def.spokes === '*') return true;
        return Array.isArray(def.spokes) ? def.spokes.includes(code as any) : true;
    }

    function tagValueFromMeta(def: CompassTagDef, meta: Record<string, unknown>, code?: string): string | undefined {
        if (code && !tagAppliesToCode(def, code)) return undefined;
        if (!def.metaField) return undefined;
        const rawValue = meta?.[def.metaField];
        if (def.format) {
            const formatInput = (typeof rawValue === 'number' || typeof rawValue === 'string' || rawValue == null)
                ? rawValue
                : String(rawValue);
            const formatted = formatInfoValue(def.format, formatInput);
            return formatted === '—' ? undefined : formatted;
        }
        if (rawValue == null) return undefined;
        const text = String(rawValue).trim();
        return text || undefined;
    }

    function dynamicTagValue(def: CompassTagDef, row: CompassBodyRow): string | undefined {
        if (!def.source) return undefined;
        if (!tagAppliesToCode(def, row.house)) return undefined;
        if (!def.metaField) return '';
        const meta = row.infoMeta[def.source] ?? {};
        return tagValueFromMeta(def, meta, row.house);
    }

    function chipLabelKey(label: string): string {
        return String(label ?? '').trim().toLowerCase();
    }

    function chipHasValue(value: string | undefined): boolean {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function groupEnabledByNodeToggles(group: OrbitNodeGroup): boolean {
        return showOrbitNodesAny && isOrbitNodeGroupVisible(group);
    }

    function pinnedGroupFromNode(node: OrbitNodeUi): OrbitNodeGroup {
        return orbitNodeGroup(node);
    }

    $: compassHouseDefs = buildHouseDefsForWheel(spec);
    $: pinnedAvailableGroups = (() => {
        const out: OrbitNodeGroup[] = ['regular'];
        const rawNodes = (spec as { nodes?: unknown } | null | undefined)?.nodes;
        if (!rawNodes || typeof rawNodes !== 'object') return out;
        const groups: Array<Exclude<OrbitNodeGroup, 'regular'>> = ['compass', 'horizon', 'nodal', 'synod', 'bind'];
        for (const group of groups) {
            const values = (rawNodes as Record<string, unknown>)[group];
            if (Array.isArray(values) && values.length > 0) out.push(group);
        }
        return out;
    })();

    $: compassTagDefs = (() => {
        const activeSources = activeSourcesForWheelType(wheel?.wheelType);
        const dynamicDefs = dedupeTagDefsByLabel(activeSources.flatMap((source) => buildSourceTagDefs('dynamic', source)))
            .map((def) => ({
                ...def,
                id: `dynamic:${tagIdFromLabel(def.label)}`
            }));
        const pinnedDefs = buildPinnedNodeDefs();
        return [
            ...dynamicDefs,
            ...pinnedDefs
        ] satisfies CompassTagDef[];
    })();
    $: compassTagDefById = new Map(compassTagDefs.map((d) => [d.id, d]));

    $: defaultCompassInfoConfig = {
        general: { enabled: false, tags: [] },
        houses: {
            tags: compassHouseDefs.map((d) => ({ id: d.id }))
        },
        dynamic: {
            enabled: true,
            tags: compassTagDefs
                .filter((d) => d.scope === 'dynamic')
                .map((d) => ({ id: d.id, enabled: d.enabledByDefault, modal: d.modal }))
        },
        pinned: {
            enabled: true,
            groups: defaultCompassGroups(),
            tags: compassTagDefs
                .filter((d) => d.scope === 'pinned')
                .map((d) => ({ id: d.id, enabled: d.enabledByDefault, modal: d.modal }))
        }
    } satisfies CompassInfoConfig;

    $: if (wheelId && wheelId !== compassInfoConfigWheelId) {
        compassInfoConfigWheelId = wheelId;
        compassInfoConfigInitialized = false;
    }

    $: compassInfoConfig = normalizeCompassInfoConfig(defaultCompassInfoConfig, wheel?.view?.compassInfoConfig ?? null);
    $: compassDynamicDisabledIds = new Set(
        compassInfoConfig.dynamic.tags
            .filter((t) => t.enabled === false)
            .map((t) => t.id)
    );
    $: if (!compassInfoConfigInitialized && wheelId && wheel?.view && !wheel.view.compassInfoConfig) {
        compassInfoConfigInitialized = true;
        applyCompassInfoConfig(defaultCompassInfoConfig);
    }

    $: compassGeneralChips = (() => {
        if (!compassInfoConfig.general.enabled) return [];
        return compassInfoConfig.general.tags
            .filter((t) => t.enabled !== false)
            .map((t) => ({
                id: t.id,
                label: (t.label && t.label.trim()) ? t.label.trim() : uiLabel(t.id),
                value: (t.value && t.value.trim()) ? t.value.trim() : '—',
                modal: (t.modal && t.modal.trim()) ? t.modal.trim() : undefined
            }));
    })();

    $: compassDynamicRows = (() => {
        const out: CompassDynamicRow[] = [];
        const houseCfgById = new Map(compassInfoConfig.houses.tags.map((t) => [t.id, t]));
        if (!compassInfoConfig.dynamic.enabled) return out;
        for (const b of allBodies) {
            const items: CompassInfoChip[] = [];
            const itemIdxByLabel = new Map<string, number>();
            for (const tag of compassInfoConfig.dynamic.tags) {
                if (tag.enabled === false) continue;
                const def = compassTagDefById.get(tag.id);
                if (!def || def.scope !== 'dynamic') continue;
                const value = dynamicTagValue(def, b);
                if (value == null) continue;
                const chip: CompassInfoChip = {
                    id: def.id,
                    label: (tag.label && tag.label.trim()) ? tag.label.trim() : def.label,
                    value,
                    modal: (tag.modal && tag.modal.trim()) ? tag.modal.trim() : def.modal
                };

                const key = chipLabelKey(chip.label);
                const hitIdx = itemIdxByLabel.get(key);
                if (hitIdx == null) {
                    itemIdxByLabel.set(key, items.length);
                    items.push(chip);
                    continue;
                }

                const prev = items[hitIdx];
                if (!chipHasValue(prev.value) && chipHasValue(chip.value)) {
                    items[hitIdx] = chip;
                }
            }
            const houseCode = b.house;
            const houseId = `house:${houseCode}`;
            const houseCfg = houseCfgById.get(houseId);
            const houseDef = compassHouseDefs.find((d) => d.id === houseId);
            const houseLabel = (houseCfg?.label && houseCfg.label.trim())
                ? houseCfg.label.trim()
                : (houseDef?.label ?? formatLabelTitleCaseUi(houseCode));
            out.push({
                id: b.id,
                emoji: b.emoji,
                name: b.name,
                houseCode,
                houseLabel,
                pinned: pinnedBodyId === b.id,
                items
            });
        }
        return out;
    })();

    $: compassPinnedRows = (() => {
        const out: CompassPinnedInfoRow[] = [];
        if (!pinnedBodyId || !compassInfoConfig.pinned.enabled) return out;
        const nodeToggles = [
            showOrbitNodesAny,
            orbitNodeGroupVisible.regular,
            orbitNodeGroupVisible.compass,
            orbitNodeGroupVisible.horizon,
            orbitNodeGroupVisible.nodal,
            orbitNodeGroupVisible.synod,
            orbitNodeGroupVisible.bind
        ];
        void nodeToggles;

        const pinnedTarget = lastTargets.find((t) => t.id === pinnedBodyId) ?? null;
        const pinnedBodyXY = pinnedTarget
            ? polarToXY(orbitToRadiusVB(pinnedTarget.orbit), pinnedTarget.angleDeg)
            : null;
        const overlappedNodeKeys = new Set(
            orbitNodesAll
                .filter((n) => n.bodyId === pinnedBodyId)
                .filter((n) => {
                    if (!pinnedBodyXY) return false;
                    const dx = n.x - pinnedBodyXY.x;
                    const dy = n.y - pinnedBodyXY.y;
                    return Math.hypot(dx, dy) <= BODY_MARKER_HIDE_RADIUS_VB;
                })
                .map((n) => n.key)
        );

        const rawRows: Array<CompassPinnedRawRow & { visualKey: string; overlapped: boolean }> = orbitNodesAll
            .filter((n) => n.bodyId === pinnedBodyId)
            .flatMap((n) => {
                const overlapped = overlappedNodeKeys.has(n.key);
                return nodeTechEntries(n).map((entry) => ({
                    id: `${n.key}:${entry.label}`,
                    bodyId: n.bodyId,
                    ts: entryTsFromNode(n, entry),
                    source: entry.group,
                    code: entry.code,
                    techName: entry.label,
                    sourceWheel: entry.sourceWheel,
                    visualKey: n.key,
                    overlapped
                }));
            })
            .filter((row) => {
                if (isMainCycleBoundaryRow(row)) return true;
                const groupEnabled = compassInfoConfig.pinned.groups[row.source] !== false;
                return groupEnabled && groupEnabledByNodeToggles(row.source);
            })
            .sort((a, b) => a.ts - b.ts);
        const windowRows = applyMainCycleWindow(rawRows, effTs);
        const activeOverlappedRowIds = (() => {
            const byVisual = new Map<string, Array<(typeof windowRows)[number]>>();
            for (const row of windowRows) {
                if (!row.overlapped) continue;
                const list = byVisual.get(row.visualKey);
                if (list) list.push(row);
                else byVisual.set(row.visualKey, [row]);
            }

            const chosen = new Set<string>();
            for (const [, rows] of byVisual) {
                if (!rows.length) continue;
                const best = rows
                    .slice()
                    .sort((a, b) => {
                        const da = Math.abs(a.ts - effTs);
                        const db = Math.abs(b.ts - effTs);
                        if (da !== db) return da - db;
                        const aIsE = a.code === 'E' ? 1 : 0;
                        const bIsE = b.code === 'E' ? 1 : 0;
                        if (aIsE !== bIsE) return bIsE - aIsE;
                        return a.ts - b.ts;
                    })[0];
                if (best) chosen.add(best.id);
            }
            return chosen;
        })();
        const body = allBodies.find((b) => b.id === pinnedBodyId);
        const nodeDefs = new Map(compassInfoConfig.pinned.tags.map((t) => [t.id, t]));
        const nodes: CompassPinnedInfoRow['nodes'] = windowRows
            .flatMap((row) => {
                const id = `pinned-node:${tagIdFromLabel(row.techName)}`;
                const cfg = nodeDefs.get(id);
                if (cfg && cfg.enabled === false) return [];
                const label = (cfg?.label && cfg.label.trim()) ? cfg.label.trim() : row.techName;
                return [{
                    id,
                    label,
                    ts: row.ts,
                    code: row.code,
                    source: row.source,
                    disabled: activeOverlappedRowIds.has(row.id)
                }];
            });

        out.push({
            id: `pinned:${pinnedBodyId}`,
            bodyId: pinnedBodyId,
            emoji: body?.emoji ?? '•',
            name: body?.name ?? String(pinnedBodyId),
            nodes
        });
        return out;
    })();
</script>

<section class="panel">
    <WheelHeader
            wheel={wheel}
            onDocs={docs.openDocs}
            onClose={closeCompass}
            dragEnabled={dragEnabled}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
            visualOpen={showVisualSection}
            infoOpen={showInfoSection}
            pickersOpen={showPickersSection}
            profileLocked={$isActiveProfileLocked}
            onToggleVisual={toggleVisualSection}
            onToggleInfo={toggleInfoSection}
            onTogglePickers={togglePickersSection}
    />

    {#if showPickersSection}
    <section class="pickersBlock" aria-label="Wheel pickers" transition:slide|local>
    <div class="sectionSep headerSep" aria-hidden="true"></div>
    <div class="headerBottom" class:twoCols={isCompassWheelType} class:lockedPickers={$isActiveProfileLocked}>
            <div class="pickerRow">
                <div class="rowFill">
                    <TimePicker
                            value={time}
                            locked={time.locked}
                            liveNowTs={time.live ? (time.locked ? localLiveNowTs : globalTs) : null}
                            onChange={(next, meta) => {
                              if ($isActiveProfileLocked) return;
                              onUserActivity();

                              const patch: Partial<WheelTimeState> =
                                next.live
                                  ? { live: true, locked: meta.lockOnApply ? true : time.locked }
                                  : { live: false, ts: next.ts ?? Date.now(), locked: meta.lockOnApply ? true : time.locked };

                              boardApi.updateWheelTime(wheelId, patch, 'Compass.time.apply');
                            }}
                            onToggleLock={(next) => {
                              if ($isActiveProfileLocked) return;
                              onUserActivity();
                              const patch: Partial<WheelTimeState> = next
                                  ? { locked: true }
                                  : (globalLive
                                      ? { locked: false, live: true }
                                      : { locked: false, live: false, ts: globalTs });
                              boardApi.updateWheelTime(wheelId, patch, 'Compass.time.lock');
                            }}/>
                </div>
            </div>

            {#if isCompassWheelType}
            <div class="pickerRow">
                <div class="rowFill">
                    <LocationPicker
                            value={wheelLoc}
                            locked={observer.locked}
                            onChange={(loc) => {
                              if ($isActiveProfileLocked) return;
                              onUserActivity();

                              const patch: Partial<WheelObserverState> = {
                                locationId: loc.id,
                                locked: true
                              };

                              dbg.log?.('Compass.location.apply', { patch });
                              boardApi.updateWheelObserver(wheelId, patch, 'Compass.location.apply');
                            }}
                            onToggleLock={(next) => {
                              if ($isActiveProfileLocked) return;
                              onUserActivity();
                              boardApi.updateWheelObserver(wheelId, { locked: next }, 'Compass.location.lock');
                            }}/>
                </div>
            </div>
            {/if}
    </div>
    </section>
    {/if}

    {#if showVisualSection || showInfoSection}
        <div class="sectionSep" aria-hidden="true"></div>
    {/if}

    <!-- WHEEL SVG -->
    {#if showVisualSection}
        <div class="wrap" bind:this={wrapEl} transition:slide|local>
            <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}
                     role="button"
                     tabindex="0"
                     on:click={(e) => {
                      const t = e.target;
                      if (!(t instanceof Element)) return clearPinned();
                      if (t.closest('[data-marker], [data-tooltip-root], [data-keep-pin]')) return;
                      clearPinned();
                    }}
                     on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        clearPinned();
                      }
                     }}
                     aria-label="Compass Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rHorizon} fill="none" class="horizon" />

                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}

                        <g class="tick" aria-hidden="true">
                            <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} class="tickLine" />
                            <circle cx={pHit.x} cy={pHit.y} r={VB * 0.03} fill="transparent" />
                        </g>
                    {/each}

                    <g class="quadrants" aria-hidden="true" transform={`rotate(90 ${cx} ${cy})`}>
                        <path d={pieSectorPath(-45,  -135, rHorizon)} class="q q-red" />
                        <path d={pieSectorPath(-135, -225, rHorizon)} class="q q-white" />
                        <path d={pieSectorPath(-225, -315, rHorizon)} class="q q-blue" />
                        <path d={pieSectorPath(-315, -405, rHorizon)} class="q q-gold" />
                    </g>

                    {#each labels as label, i (label)}
                        {@const a = spokeAngleDeg(i)}
                        {@const p1 = { x: cx, y: cy }}
                        {@const p2 = polarToXY(rOuter, a)}
                        {@const pt = polarToXY(rLabel, a)}
                        {@const midPt = polarToXY(rOuter * 0.56, a)}
                        {@const houseTip = buildHouseTip(label)}
                        {@const houseKey = `house:${label}`}
                        {@const labelEmoji = emojiAtLabel(label)}
                        {@const spokeEmoji = emojiAtSpoke(label)}

                        <g
                                class="spoke"
                                class:hot={activeSpokeCode === label}
                                data-keep-pin="1"
                                role="button"
                                tabindex="0"
                                aria-label={`House ${label}`}
                                on:click={(e) => tip.openMomentNow(e, houseTip)}
                                on:dblclick={() => handleSpokeDoubleClick(label)}
                                on:mouseenter={(e) => tip.hoverMomentEnter(e, houseTip, houseKey)}
                                on:mouseleave={() => tip.hoverLeave(houseKey)}
                                on:keydown={(e) => handleHouseKeydown(e, houseTip)}
                        >
                            <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke="currentColor"
                                    stroke-opacity={0.35}
                                    stroke-width={i % 4 === 0 ? 4 : 2}
                                    stroke-linecap="round"
                            />

                            {#if spokeEmoji}
                                <text
                                        class="roleEmoji roleEmojiOnSpoke"
                                        x={midPt.x}
                                        y={midPt.y}
                                        text-anchor="middle"
                                        dominant-baseline="middle"
                                >
                                    {spokeEmoji}
                                </text>
                            {/if}

                            <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={VB * 0.046}
                                    fill="transparent"
                                    stroke="currentColor"
                                    class="spokeHalo"
                                    class:occupied={occupiedSpokes[i]}
                            />

                            {#if labelEmoji}
                                <text
                                        class="roleEmoji roleEmojiOnLabel"
                                        x={pt.x}
                                        y={pt.y}
                                        text-anchor="middle"
                                        dominant-baseline="middle"
                                >
                                    {labelEmoji}
                                </text>
                            {:else}
                                <text
                                        class="spokeLabel"
                                        x={pt.x} y={pt.y}
                                        text-anchor="middle"
                                        dominant-baseline="middle"
                                        font-size={VB * 0.035}
                                        fill="currentColor"
                                        fill-opacity={0.65}
                                >
                                    {label}
                                </text>
                            {/if}

                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    {#each orbitCurves as c (`orbit:${c.id}:${c.seg}`)}
                        {#if showOrbits || pinnedBodyId === c.id}
                            <path
                                    class="orbitCurve"
                                    class:dim={!c.visible}
                                    class:pinnedCurve={pinnedBodyId === c.id}
                                    d={c.d}
                            />
                        {/if}
                    {/each}

                    {#if pinnedBodyId}
                        {#each orbitNodesVisible as n (n.key)}
                            {#if n.bodyId === pinnedBodyId}
                                <circle
                                        class={`orbitNode ${orbitNodeTagClassList(n)} ${orbitNodeGroupClass(n)}`}
                                        class:dim={!n.visible}
                                        class:pinnedNode={pinnedBodyId === n.bodyId}
                                        data-marker="1"
                                        role="button"
                                        tabindex="0"
                                        aria-label={n.tip.label}
                                        cx={n.x}
                                        cy={n.y}
                                        r={orbitNodeRadiusVB(n)}
                                        on:click={(e) => tip.openMomentNow(e, n.tip)}
                                        on:dblclick={(e) => {
                                            if ((n.tip.pickTsList?.length ?? 0) > 1) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMarkerPick(n.tip.ts, n.bodyId, n.code);
                                        }}
                                        on:mouseenter={(e) => {
                                            activateSpokeFromOrbitNode(n);
                                            tip.hoverMomentEnter(e, n.tip, n.key);
                                        }}
                                        on:mouseleave={() => {
                                            clearActiveSpoke();
                                            tip.hoverLeave(n.key);
                                        }}
                                        on:focus={() => activateSpokeFromOrbitNode(n)}
                                        on:blur={clearActiveSpoke}
                                        on:keydown={(e) => handleOrbitNodeKeydown(e, n.tip)}
                                />
                            {/if}
                        {/each}
                    {/if}

                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = orbitToRadiusVB(c.orbit)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}
                        {@const isCluster = c.count > 1}
                        {@const o = c.opacity ?? 1}

                        <g class="marker"
                           role="button"
                           tabindex="0"
                           class:pinnedMark={clusterContainsPinned(c)}
                           data-marker="1"
                           transform={`translate(${p.x} ${p.y})`}
                           style={`opacity:${c.opacity ?? 1}`}
                           on:click={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  const id = clusterSingleBodyId(c);
                                  if (id) {
                                    togglePin(id);
                                    tip.openClusterNow(e, c);
                                  } else {
                                   tip.openClusterNow(e, c);
                                  }
                                }}
                           on:keydown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   const id = clusterSingleBodyId(c);
                                   if (id) togglePin(id);
                               }
                           }}
                           on:mouseenter={(e) => { if (!isCoarsePointer) tip.hoverClusterEnter(e, c, markerKey); }}
                           on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                           on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}
                        >
                            <circle r={VB * 0.035} fill="transparent" />

                            <circle
                                    r={VB * 0.02}
                                    fill="transparent"
                                    stroke="currentColor"
                                    stroke-opacity={0.28}/>
                            <text
                                    class="markerGlyph"
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={VB * (isCluster ? 0.022 : 0.035)}
                                    font-weight={isCluster ? 900 : 850}
                                    letter-spacing={c.count === 1 ? 0 : 0.6}
                                    fill="currentColor"
                                    fill-opacity={Math.max(0.92, o)}
                                    stroke="currentColor"
                                    stroke-opacity={isCluster ? 0.35 : 0.55}
                                    stroke-width={isCluster ? 2.5 : 2}
                                    style="pointer-events:none"
                            >
                                {c.count === 1 ? c.emoji : c.label}
                            </text>
                        </g>
                    {/each}

                    {#if centerEmoji}
                        <text
                                class="roleEmoji roleEmojiCenter"
                                x={cx}
                                y={cy}
                                text-anchor="middle"
                                dominant-baseline="middle"
                        >
                            {centerEmoji}
                        </text>
                    {/if}
                    <circle cx={cx} cy={cy} r={VB * 0.006} class="zenith" />
                </svg>

                <div class="compassNav">
                    <button
                            class="orbitToggle navBtn"
                            class:off={!showOrbits}
                            type="button"
                            title={showOrbits ? 'Hide orbits' : 'Show orbits'}
                            aria-label={showOrbits ? 'Hide orbits' : 'Show orbits'}
                            aria-pressed={showOrbits}
                            on:click={toggleOrbits}
                    >
                        ≋
                    </button>

                    {#if pinnedBodyId}
                        <button
                                class="nodeToggle navBtn nodeAll"
                                class:off={!showOrbitNodesAny}
                                type="button"
                                title={showOrbitNodesAny ? 'Hide all nodes (except main cycle E/E+)' : 'Show nodes'}
                                aria-label={showOrbitNodesAny ? 'Hide all nodes (except main cycle E/E+)' : 'Show nodes'}
                                aria-pressed={showOrbitNodesAny}
                                on:click|stopPropagation={toggleOrbitNodesAny}
                        >
                            {showOrbitNodesAny ? '◉' : '○'}
                        </button>
                    {/if}
                </div>

                {#if pinnedBodyId}
                    {#if wheel?.wheelType === 'compass'}
                        <div class="nodeNav nodeNavCompass">
                            <button
                                    class="nodeToggle navBtn nodeHorizon"
                                    class:off={!orbitNodeGroupVisible.horizon}
                                    type="button"
                                    title="Toggle horizon nodes"
                                    aria-label="Toggle horizon nodes"
                                    aria-pressed={orbitNodeGroupVisible.horizon}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('horizon')}
                            >
                                H
                            </button>
                            <button
                                    class="nodeToggle navBtn nodeCompass"
                                    class:off={!orbitNodeGroupVisible.compass}
                                    type="button"
                                    title="Toggle compass nodes"
                                    aria-label="Toggle compass nodes"
                                    aria-pressed={orbitNodeGroupVisible.compass}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('compass')}
                            >
                                C
                            </button>
                            <button
                                    class="nodeToggle navBtn nodeRegular"
                                    class:off={!orbitNodeGroupVisible.regular}
                                    type="button"
                                    title="Toggle regular nodes"
                                    aria-label="Toggle regular nodes"
                                    aria-pressed={orbitNodeGroupVisible.regular}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('regular')}
                            >
                                .
                            </button>
                        </div>
                    {:else}
                        <div class="nodeNav">
                            {#if hasPinnedNodalNodes}
                                <button
                                        class="nodeToggle navBtn nodeNodal"
                                        class:off={!orbitNodeGroupVisible.nodal}
                                        type="button"
                                        title="Toggle nodals"
                                        aria-label="Toggle nodals"
                                        aria-pressed={orbitNodeGroupVisible.nodal}
                                        on:click|stopPropagation={() => toggleOrbitNodeGroup('nodal')}
                                >
                                    N
                                </button>
                            {/if}
                            <button
                                    class="nodeToggle navBtn nodeRegular"
                                    class:off={!orbitNodeGroupVisible.regular}
                                    type="button"
                                    title="Toggle regular nodes"
                                    aria-label="Toggle regular nodes"
                                    aria-pressed={orbitNodeGroupVisible.regular}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('regular')}
                            >
                                .
                            </button>
                            {#if wheel?.wheelType === 'system'}
                                <button
                                        class="nodeToggle navBtn nodeSynod"
                                        class:off={!orbitNodeGroupVisible.synod}
                                        type="button"
                                        title="Toggle synod nodes"
                                        aria-label="Toggle synod nodes"
                                        aria-pressed={orbitNodeGroupVisible.synod}
                                        on:click|stopPropagation={() => toggleOrbitNodeGroup('synod')}
                                >
                                    S
                                </button>
                                <button
                                        class="nodeToggle navBtn nodeBind"
                                        class:off={!orbitNodeGroupVisible.bind}
                                        type="button"
                                        title="Toggle bind nodes"
                                        aria-label="Toggle bind nodes"
                                        aria-pressed={orbitNodeGroupVisible.bind}
                                        on:click|stopPropagation={() => toggleOrbitNodeGroup('bind')}
                                >
                                    B
                                </button>
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>

            {#if $tipState.open && ($tipState.cluster || $tipState.moment)}
                <CompassTooltip
                        x={$tipState.x}
                        y={$tipState.y}
                        cluster={$tipState.cluster}
                        moment={$tipState.moment}
                        allBodies={allBodies}
                        dynamicRows={compassDynamicRows}
                        dynamicDisabledIds={compassDynamicDisabledIds}
                        pinnedBodyId={pinnedBodyId}
                        onTogglePin={togglePin}
                        onPickTs={handleMarkerPick}
                        onAddRelatedWheel={(input) => {
                          if ($isActiveProfileLocked) return;
                          onUserActivity();
                          if (wheelId) {
                            boardApi.addWheelBefore(wheelId, input, 'Compass.related.addBefore');
                          } else {
                            boardApi.addWheel(input, 'Compass.related.add');
                          }
                        }}
                        onMouseEnter={tip.keepOpen}
                        onMouseLeave={tip.scheduleClose}
                        onClose={tip.closeNow}
                />
            {/if}
            </section>
        </div>
    {/if}

    {#if showVisualSection && showInfoSection}
        <div class="sectionSep" aria-hidden="true"></div>
    {/if}

    <!-- INFO -->
    {#if showInfoSection}
        <div transition:slide|local>
            <CompassInfoBlock
                    config={compassInfoConfig}
                    tagDefs={compassTagDefs}
                    houseDefs={compassHouseDefs}
                    pinnedAvailableGroups={pinnedAvailableGroups}
                    generalChips={compassGeneralChips}
                    dynamicRows={compassDynamicRows}
                    pinnedRows={compassPinnedRows}
                    referenceTs={localLiveNowTs}
                    onBodyPick={handleCompassBodyPick}
                    onPinnedPick={handleCompassPinnedPick}
                    onConfigure={applyCompassInfoConfig}
                    locked={$isActiveProfileLocked}
            />
        </div>
    {/if}

    {#if showLoadingOverlay}
        <div class="wheel-loading-overlay" aria-live="polite" aria-busy="true">
            <div class="wheel-loading-spinner" aria-hidden="true"></div>
        </div>
    {/if}
</section>

<DocsModal
        open={$docsState.open}
        title={$docsState.title}
        md={$docsState.loading ? '# Loading…' : $docsState.md}
        url={$docsState.url}
        onClose={docs.closeDocs}
/>

<style>
    .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        padding: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
        position: relative;
    }
    .wrap {
        width: 100%;
        max-width: 100%;
        flex: 0 0 auto;
        min-height: 0;
        padding-block: 10px;
        box-sizing: border-box;
    }
    .headerBottom {
        display: grid;
        gap: 6px;
        margin-top: 0;
        margin-bottom: 10px;
    }
    .headerBottom.lockedPickers {
        pointer-events: none;
        opacity: 0.7;
    }
    .pickersBlock {
        display: grid;
        gap: 0;
    }
    .headerBottom.twoCols {
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        align-items: stretch;
    }
    .sectionSep {
        height: 1px;
        margin: 6px 0 12px;
        background: color-mix(in oklab, var(--fg), transparent 84%);
    }
    .sectionSep.headerSep {
        margin: 4px 0 8px;
    }
    .wheelPanel {
        display: grid;
        gap: 10px;
        width: 100%;
        justify-items: center;
        padding-inline: 8px;
        box-sizing: border-box;
    }
    .wheelBox { width: 100%; aspect-ratio: 1 / 1; display: grid; place-items: stretch; overflow: visible; position: relative; }
    .wheelBox svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
        position: relative;
        z-index: 1;
    }
    svg { display: block; width: 100%; height: 100%; max-width: none; max-height: none; overflow: visible; }
    svg:focus,
    svg:focus-visible {
        outline: none;
    }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .tickLine{ stroke: currentColor; stroke-opacity: 0.32; stroke-width: 5; stroke-linecap: round; }
    .spokeLabel {
        pointer-events: auto;
        cursor: pointer;
        transition: fill-opacity 120ms ease, font-weight 120ms ease;
    }
    .spoke:hover .spokeLabel {
        fill-opacity: 1;
        font-weight: 800;
    }
    .spoke:focus {
        outline: none;
    }

    .spoke:focus-visible {
        outline: none;
    }
    .info {
        width: 100%;
        max-width: 100%;
        font-size: 18px;
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: 2px;
        margin-top: auto;   /* вот это магия “прилипни вниз” */
        min-height: 0;
        overflow: auto;
    }
    .infoRow { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 4px 6px; border-radius: 10px; }

    .infoRow{
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 90%);
    }

    .horizon { stroke: currentColor; stroke-opacity: 0.28; stroke-width: 6; }
    .zenith { fill: currentColor; opacity: 0.85; }

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }
    .marker:focus,
    .marker:focus-visible {
        outline: none;
    }

    .spoke { cursor: pointer; user-select: none; }

    .marker.pinnedMark circle {
        stroke-opacity: 1;
        stroke-width: 5;
    }
    .marker.pinnedMark {
        filter:
                drop-shadow(0 0 14px color-mix(in oklab, var(--accent-live), transparent 35%))
                drop-shadow(0 0 22px color-mix(in oklab, var(--fg), transparent 70%));
        z-index: 2;
    }
    .marker.pinnedMark text {
        fill-opacity: 1;
        font-weight: 900;
    }
    .infoRow.pinnedRow{
        border: 0;
        background: color-mix(in oklab, var(--panel), var(--fg) 4%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 84%);
    }

    .infoRow.pinnedRow.emptyPinned {
        opacity: 0.55;
    }

    .pinnedLine {
        display: grid !important;
        grid-template-columns: auto 1fr auto auto auto;
        align-items: center;
        gap: 14px;
    }

    .pE{ font-size:20px; width:24px; text-align:center; }
    .pN{ font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pH{ font-weight:900; opacity:0.9; padding:2px 8px; border-radius:10px;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%); }
    .pA, .pAlt{ opacity:0.85; font-variant-numeric: tabular-nums; white-space:nowrap; }
    .rowFill{
        min-width: 0;
        width: 100%;
        display: block;
    }

    .pickerRow {
        display: grid;
        grid-template-columns: 1fr;
        align-items: stretch;
        gap: 0;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
    }
    @media (max-width: 980px) {
        .headerBottom.twoCols {
            grid-template-columns: 1fr;
        }
    }

    /* ключевой момент: тянем корневой DOM-элемент компонента */
    .rowFill :global(> *) {
        width: 100%;
        min-width: 0;
        display: block;
    }
    .rowFill :global(> *) { margin: 0; }
    /* Убираем "внутреннюю карточку" у пикеров */
    /*noinspection CssUnusedSymbol*/
    .pickerRow :global(.face) { margin: 0; }
    /* круг всегда есть, но по умолчанию “почти нет” */
    .spokeHalo {
        stroke-opacity: 0.12;
        stroke-width: 2.5;
        filter: none;
        transition: stroke-opacity 120ms ease, filter 120ms ease;
    }

    /* если в доме есть хотя бы одно тело над горизонтом — держим заметнее */
    .spokeHalo.occupied {
        stroke-opacity: 0.75;     /* было 0.55 */
        stroke-width: 4.5;        /* было 3 в разметке */
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }

    /* hover: подсветить круг (и для occupied, и для пустых) */
    .spoke:hover .spokeHalo {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .spoke.hot .spokeHalo {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .spoke.hot .spokeLabel {
        fill-opacity: 1;
        font-weight: 800;
    }
    .roleEmoji {
        user-select: none;
        pointer-events: none;
        font-variant-emoji: emoji;
        fill: currentColor;
        opacity: 0.95;
    }
    .roleEmojiCenter {
        font-size: 40px;
        font-weight: 400;
    }
    .roleEmojiOnLabel {
        font-size: 62px;
        font-weight: 900;
    }
    .roleEmojiOnSpoke {
        font-size: 34px;
        font-weight: 900;
        opacity: 0.9;
    }
    .spoke:hover .roleEmojiOnLabel,
    .spoke.hot .roleEmojiOnLabel {
        opacity: 1;
    }
    .markerGlyph {
        paint-order: stroke;
        filter:
                drop-shadow(0 0 2px color-mix(in oklab, var(--bg), transparent 0%))
                drop-shadow(0 0 5px color-mix(in oklab, var(--fg), transparent 60%));
    }
    .compassNav {
        position: absolute;
        top: 4px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: end;
        z-index: 3;
        pointer-events: auto;
    }
    .nodeNav {
        position: absolute;
        right: 0;
        bottom: 18px;
        display: grid;
        grid-template-columns: repeat(2, 30px);
        gap: 6px;
        z-index: 3;
        pointer-events: auto;
    }
    .nodeNavCompass {
        right: -2px;
        bottom: 20px;
    }
    .orbitToggle {
        width: 34px;
        height: 34px;
        font-size: 17px;
        line-height: 1;
    }
    .orbitToggle.off {
        opacity: 0.5;
    }
    .nodeToggle {
        width: 30px;
        height: 30px;
        font-size: 13px;
        line-height: 1;
    }
    .nodeToggle.off {
        opacity: 0.5;
    }
    .nodeToggle.nodeAll {
        color: color-mix(in oklab, var(--fg), white 8%);
    }
    .nodeToggle.nodeRegular {
        color: color-mix(in oklab, var(--fg), white 8%);
    }
    .nodeToggle.nodeCompass {
        color: color-mix(in oklab, #ff9f40, white 8%);
    }
    .nodeToggle.nodeHorizon {
        color: color-mix(in oklab, #ff5a6e, white 8%);
    }
    .nodeToggle.nodeNodal {
        color: color-mix(in oklab, #ff5a6e, white 8%);
    }
    .nodeToggle.nodeSynod {
        color: color-mix(in oklab, #b991ff, white 8%);
    }
    .nodeToggle.nodeBind {
        color: color-mix(in oklab, #40a8ff, white 8%);
    }
    .orbitCurve {
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-opacity: 0.24;
        pointer-events: none;
    }
    .orbitCurve.dim {
        stroke-opacity: 0.12;
        stroke-dasharray: 8 7;
    }
    .orbitCurve.pinnedCurve {
        stroke-opacity: 0.42;
        stroke-width: 2.8;
        filter: drop-shadow(0 0 3px color-mix(in oklab, var(--fg), transparent 70%));
    }

    /*noinspection CssUnusedSymbol*/
    .orbitNode {
        fill: color-mix(in oklab, var(--fg), var(--bg) 20%);
        fill-opacity: 0.9;
        stroke: color-mix(in oklab, var(--bg), var(--fg) 30%);
        stroke-width: 1.5;
        cursor: pointer;
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode:focus,
    .orbitNode:focus-visible {
        outline: none;
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.dim {
        fill-opacity: 0.55;
        stroke-opacity: 0.55;
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.pinnedNode {
        fill-opacity: 0.92;
        stroke-opacity: 0.85;
        stroke-width: 1.7;
        filter: drop-shadow(0 0 3px color-mix(in oklab, var(--fg), transparent 70%));
    }
    .orbitNode.grp-compass {
        fill: color-mix(in oklab, #ff9f40, white 16%);
        stroke: color-mix(in oklab, #ff9f40, black 36%);
    }
    .orbitNode.grp-horizon,
    .orbitNode.grp-nodal {
        fill: color-mix(in oklab, #ff5a6e, white 16%);
        stroke: color-mix(in oklab, #ff5a6e, black 36%);
    }
    .orbitNode.grp-synod {
        fill: color-mix(in oklab, #b991ff, white 18%);
        stroke: color-mix(in oklab, #b991ff, black 35%);
    }
    .orbitNode.grp-bind {
        fill: color-mix(in oklab, #40a8ff, white 22%);
        stroke: color-mix(in oklab, #40a8ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-max-distance {
        fill: color-mix(in oklab, #40a8ff, white 22%);
        stroke: color-mix(in oklab, #40a8ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-min-distance {
        fill: color-mix(in oklab, #e0a600, white 20%);
        stroke: color-mix(in oklab, #e0a600, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-mid-distance {
        fill: color-mix(in oklab, #63c3ff, white 18%);
        stroke: color-mix(in oklab, #63c3ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-zenith {
        fill: color-mix(in oklab, #e0a600, white 20%);
        stroke: color-mix(in oklab, #e0a600, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-nadir {
        fill: color-mix(in oklab, #40a8ff, white 22%);
        stroke: color-mix(in oklab, #40a8ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-cycle-start,
    .orbitNode.tg-cycle-end {
        fill: color-mix(in oklab, #61d87a, white 20%);
        stroke: color-mix(in oklab, #61d87a, black 32%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-e-nodal,
    .orbitNode.tg-w-nodal,
    .orbitNode.tg-n-nodal,
    .orbitNode.tg-s-nodal,
    .orbitNode.tg-e-compass,
    .orbitNode.tg-e-next-compass,
    .orbitNode.tg-w-compass,
    .orbitNode.tg-n-compass,
    .orbitNode.tg-s-compass,
    .orbitNode.tg-e-horizon,
    .orbitNode.tg-e-next-horizon,
    .orbitNode.tg-w-horizon,
    .orbitNode.tg-n-horizon,
    .orbitNode.tg-s-horizon {
        fill: color-mix(in oklab, #ff9f40, white 16%);
        stroke: color-mix(in oklab, #ff9f40, black 36%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-e-horizon,
    .orbitNode.tg-e-next-horizon,
    .orbitNode.tg-w-horizon,
    .orbitNode.tg-n-horizon,
    .orbitNode.tg-s-horizon,
    .orbitNode.tg-e-nodal,
    .orbitNode.tg-e-next-nodal,
    .orbitNode.tg-w-nodal,
    .orbitNode.tg-n-nodal,
    .orbitNode.tg-s-nodal {
        fill: color-mix(in oklab, #ff5a6e, white 16%);
        stroke: color-mix(in oklab, #ff5a6e, black 36%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-n-synod {
        fill: color-mix(in oklab, #b991ff, white 18%);
        stroke: color-mix(in oklab, #b991ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-w-synod {
        fill: color-mix(in oklab, #b991ff, white 18%);
        stroke: color-mix(in oklab, #b991ff, black 35%);
    }
    /*noinspection CssUnusedSymbol*/
    .orbitNode.tg-s-synod {
        fill: color-mix(in oklab, #b991ff, white 18%);
        stroke: color-mix(in oklab, #b991ff, black 35%);
    }
    .padding-right {
        padding-right: 2px;
    }
</style>
