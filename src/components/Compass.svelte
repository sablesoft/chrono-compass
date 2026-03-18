<!-- src/components/Compass.svelte -->
<script lang="ts">
    import { slide } from 'svelte/transition';
    import { onDestroy, onMount } from 'svelte';
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
    import BodyInfoEditor from './BodyInfoEditor.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';

    import { objects, wheels } from '../lib/catalog';
    import type { ObjId, EmojiPlacement, EmojiPlacementInput, RoleName, WheelNodeGroups, WheelSpec } from '../lib/catalog';

    import { formatLabelTitleCaseUi, formatSpokeCodeUi, SPOKES_ORDER, type InfoItem, type MarkerCluster, type MarkerItem, type MomentTip } from '../lib/wheel/types';
    import { formatInfoValue } from '../lib/wheel/infoFormat';
    import { compassClusters } from '../lib/wheel/ui/compassClusters';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';
    import {
        CARD_INFO_BOTTOM_HEIGHT_DEFAULT,
        CARD_INFO_SIDE_COLS_MAX,
        CARD_INFO_SIDE_COLS_MIN,
        CARD_INFO_SIDE_COLS_DEFAULT,
        CARD_VISUAL_COLS_MAX,
        CARD_VISUAL_COLS_MIN,
        CARD_VISUAL_COLS_DEFAULT,
        clampBottomHeight,
        clampCols,
        normalizeInfoPosition,
        resizeColsDelta,
        totalCardCols,
        visualPaneCols
    } from '../lib/wheel/ui/cardLayout';

    // unified resolver (runtime+idb, and if wheel type is excluded -> compute)
    import { resolveWheel } from '../lib/board/dispatcher';
    import type { WheelSolveResult } from '../lib/board/runtime';

    import { DEFAULT_LOCATION_ID, type Location } from '../lib/location/types';
    import type { CompassInfoConfig, CompassInfoGroupConfig, CompassInfoTagConfig, WheelObserverState, WheelTimeState } from '../lib/wheel/types';
    import { setSelectedTs } from '../lib/time/store';

    import {
        buildCompassAstroFrameLayer,
        buildCompassConstellationBoundaryLayer,
        compassTargetsToMarkerItems
    } from '../lib/math/compass';
    import type { CompassAstroFrameLayer, CompassAstroFrameNode, CompassTargetState } from '../lib/math/compass';
    import { constellationEntriesFromObjects, findConstellationByRaDec } from '../lib/math/constellation';
    import { AU_PER_LY, norm360 } from '../lib/math/helpers';
    import { projectSystemSideCoordinates, systemLookerSideDirection, systemSynodSpokeConstellationsAt } from '../lib/math/system';
    import { formatCycleDurationFromSpokes, WHEEL_LOADING_OVERLAY_DELAY_MS } from '../lib/wheel/control';
    import { activeProfile, isActiveProfileLocked } from '../lib/profile/store';
    import {
        DEFAULT_EMOJI_SCALE,
        resolveBodyColor,
        resolveBodyDistancePc,
        resolveBodyEmoji,
        resolveBodyEmojiScale,
        resolveBodyInfoItems,
        resolveBodyName
    } from '../lib/profile/bodyInfo';
    import { STAR_INFO_ITEMS } from '../lib/catalog/starInfoItems';
    import type { BodyUserOverride } from '../lib/profile/types';

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
    const systemReferenceRingOrbit = 1.5;
    const SIDE_AXIS_HALF = rOuter * 0.92;
    const SIDE_LABEL_OFFSET = VB * 0.045;
    const SIDE_LOOKER_OFFSET = SIDE_AXIS_HALF + VB * 0.05;

    const boundaryAngleDeg = geom.boundaryAngleDeg;
    const spokeAngleDeg = geom.spokeAngleDeg;
    const polarToXY = geom.polarToXY;

    type VisualPaneMode = 'top' | 'side';
    type CompassInfoPosition = 'bottom' | 'left' | 'right';
    type VisualMarkerCluster = MarkerCluster & {
        x: number;
        y: number;
    };

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
    const BODY_MARKER_HIDE_RADIUS_VB = VB * 0.022;
    const ORBIT_NODE_MERGE_RADIUS_VB = VB * 0.012;
    let markerClusters: MarkerCluster[] = [];
    let sideMarkerClusters: VisualMarkerCluster[] = [];
    let hideZenithTop = false;
    let hideZenithSide = false;
    let lastTargets: CompassTargetState[] = [];
    let displayTargets: Array<CompassTargetState & { hiddenDuringTween?: boolean }> = [];
    let allBodies: CompassBodyRow[] = [];
    let astroFrameLayerDisplay: CompassAstroFrameLayer | null = null;
    let orbitCurves: Array<{ id: ObjId; seg: number; d: string; visible: boolean }> = [];
    let astroFrameCurves: Array<{ id: 'equator' | 'ecliptic'; seg: number; d: string; visible: boolean }> = [];
    let constellationBoundaryCurves: Array<{ id: string; seg: number; d: string; visible: boolean; title: string }> = [];
    let astroFrameNodes: Array<{
        id: string;
        kind: 'intersection' | 'pole';
        x: number;
        y: number;
        visible: boolean;
        node: CompassAstroFrameNode;
        tip: MomentTip;
    }> = [];
    let sideOrbitCurves: Array<{ id: ObjId; seg: number; d: string; visible: boolean }> = [];
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
    type RawOrbitNodeUi = Omit<OrbitNodeUi, 'x' | 'y' | 'visible'> & {
        trackPoint: NonNullable<CompassTargetState['orbitTrack']>[number];
    };
    let rawOrbitNodes: RawOrbitNodeUi[] = [];
    let orbitNodes: OrbitNodeUi[] = [];
    let orbitNodesAll: OrbitNodeUi[] = [];
    let orbitNodesSide: OrbitNodeUi[] = [];
    let orbitNodesSideAll: OrbitNodeUi[] = [];
    const MARKER_STYLE = {
        // Transparent hit circle radius in px (interaction target).
        hitPx: 18,
        // Marker ring radius in px (visual outline).
        ringPx: 10,
        // Emoji font size in px for single-body markers.
        fontSinglePx: 18,
        // Emoji font size in px for reference objects (stars).
        fontReferencePx: 14,
        // Font size in px for clustered markers (count label).
        fontClusterPx: 12
    };
    const NODE_STYLE = {
        // Track node radius for regular groups in px.
        regularPx: 1.6,
        // Track node radius for special groups in px.
        specialPx: 1.8
    };
    const MARKER_SCALE_MIN = 0.2;
    const MARKER_SCALE_MAX = 3;
    const MARKER_SCALE_STEP = 0.1;
    function clampMarkerScale(value: number): number {
        if (!Number.isFinite(value)) return 1;
        return Math.min(MARKER_SCALE_MAX, Math.max(MARKER_SCALE_MIN, value));
    }

    function clampCompassVisualCols(value: unknown): number {
        return clampCols(value, CARD_VISUAL_COLS_DEFAULT, CARD_VISUAL_COLS_MIN, CARD_VISUAL_COLS_MAX);
    }

    function clampCompassInfoSideCols(value: unknown): number {
        return clampCols(value, CARD_INFO_SIDE_COLS_DEFAULT, CARD_INFO_SIDE_COLS_MIN, CARD_INFO_SIDE_COLS_MAX);
    }

    function clampCompassInfoBottomHeight(value: number): number {
        return clampBottomHeight(value, CARD_INFO_BOTTOM_HEIGHT_DEFAULT);
    }

    function normalizeCompassInfoPosition(value: unknown, canPlaceSide: boolean): CompassInfoPosition {
        return normalizeInfoPosition(value, canPlaceSide);
    }

    function stepMarkerScale(value: number): number {
        return Math.round(value / MARKER_SCALE_STEP) * MARKER_SCALE_STEP;
    }

    let markerScaleBias = 1;

    $: markerScaleBias = stepMarkerScale(
        clampMarkerScale((wheel?.view?.markerScaleBias ?? 1) as number)
    );

    function setMarkerScaleBias(next: number) {
        if (!wheelId) return;
        const value = stepMarkerScale(clampMarkerScale(next));
        boardApi.updateWheelById(
            wheelId,
            { view: { markerScaleBias: value } },
            'Compass.markerScale'
        );
    }

    function incMarkerScale() {
        setMarkerScaleBias(markerScaleBias + MARKER_SCALE_STEP);
    }

    function decMarkerScale() {
        setMarkerScaleBias(markerScaleBias - MARKER_SCALE_STEP);
    }

    let primarySvgEl: SVGSVGElement | null = null;
    let secondarySvgEl: SVGSVGElement | null = null;
    let svgPx = 0;
    let svgRo: ResizeObserver | null = null;

    function updateSvgPx() {
        const widths = [primarySvgEl, secondarySvgEl]
            .map((el) => el?.getBoundingClientRect().width ?? 0)
            .filter((w) => w > 0);
        svgPx = widths[0] ?? size;
    }

    function pxToVb(px: number): number {
        const base = svgPx > 0 ? svgPx : size;
        return base > 0 ? (px / base) * VB : px;
    }
    function vbToPx(vb: number): number {
        const base = svgPx > 0 ? svgPx : size;
        return base > 0 ? (vb / VB) * base : vb;
    }

    $: markerSizes = {
        hit: pxToVb(MARKER_STYLE.hitPx * markerScaleBias),
        ring: pxToVb(MARKER_STYLE.ringPx * markerScaleBias),
        fontSingle: pxToVb(MARKER_STYLE.fontSinglePx * markerScaleBias),
        fontReference: pxToVb(MARKER_STYLE.fontReferencePx * markerScaleBias),
        fontCluster: pxToVb(MARKER_STYLE.fontClusterPx * markerScaleBias),
        dbg: { size, svgPx, markerScaleBias }
    };

    $: nodeSizes = {
        regular: pxToVb(NODE_STYLE.regularPx * markerScaleBias),
        special: pxToVb(NODE_STYLE.specialPx * markerScaleBias)
    };

    function overlapsWheelCenter(x: number, y: number): boolean {
        return Math.hypot(x - cx, y - cy) <= markerSizes.hit;
    }

    function orbitNodeRadiusVB(node: { tip?: MomentTip }): number {
        const g = orbitNodeGroup(node);
        return g === 'regular' ? nodeSizes.regular : nodeSizes.special;
    }

    onMount(() => {
        updateSvgPx();
        if (typeof ResizeObserver !== 'undefined') {
            svgRo = new ResizeObserver(() => updateSvgPx());
        }
        return () => svgRo?.disconnect();
    });

    $: if (svgRo) {
        svgRo.disconnect();
        if (primarySvgEl) svgRo.observe(primarySvgEl);
        if (secondarySvgEl) svgRo.observe(secondarySvgEl);
        updateSvgPx();
    }

    $: if (primarySvgEl || secondarySvgEl) {
        void size;
        updateSvgPx();
    }

    $: activeBodyOverrides = (($activeProfile?.data?.bodies ?? {}) as Partial<Record<ObjId, BodyUserOverride>>);
    $: activeBodyDescriptionLabel = $activeProfile?.data?.bodyDescriptionLabel;
    $: activeStarInfoItems = $activeProfile?.data?.starInfoItems ?? [];

    let orbitNodesVisible: OrbitNodeUi[] = [];
    let hasPinnedAnyOrbitNodes = false;
    let hasPinnedNodalNodes = false;
    let showOrbits = true;
    let showAstroFrame = false;
    let showConstellationBoundaries = false;
    type LiveNorthPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';
    let liveNorthEnabled = false;
    let liveNorthHeadingDeg: number | null = null;
    let liveNorthPermission: LiveNorthPermissionState = 'unknown';
    let liveNorthError = '';
    let liveNorthSupported = false;
    let liveNorthListening = false;
    let liveNorthButtonTitle = 'Enable live true north direction';
    const LIVE_NORTH_SMOOTHING = 0.28;
    let showOrbitNodesAny = true;
    let lastShowOrbitsWheelType: string | undefined;
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
    let editingBodyId: ObjId | null = null;

    function clearPinned() {
        pinnedBodyId = null;
        editingBodyId = null;
    }

    $: {
        const wheelType = wheel?.wheelType;
        if (wheelType !== lastShowOrbitsWheelType) {
            showOrbits = wheelType === 'compass' ? false : true;
            lastShowOrbitsWheelType = wheelType;
        }
        if (wheelType !== 'compass') {
            showAstroFrame = false;
            showConstellationBoundaries = false;
        }
    }

    function toggleOrbits() {
        onUserActivity();
        showOrbits = !showOrbits;
    }

    function toggleAstroFrame() {
        onUserActivity();
        showAstroFrame = !showAstroFrame;
    }

    function toggleConstellationBoundaries() {
        onUserActivity();
        showConstellationBoundaries = !showConstellationBoundaries;
    }

    function shortestSignedAngleDeg(fromDeg: number, toDeg: number): number {
        return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
    }

    function extractDeviceHeadingDeg(event: DeviceOrientationEvent): number | null {
        const withWebkit = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
        if (Number.isFinite(withWebkit.webkitCompassHeading)) {
            return norm360(Number(withWebkit.webkitCompassHeading));
        }
        if (Number.isFinite(event.alpha)) {
            return norm360(360 - Number(event.alpha));
        }
        return null;
    }

    function handleLiveNorthOrientation(event: Event) {
        const orientationEvent = event as DeviceOrientationEvent;
        const nextHeading = extractDeviceHeadingDeg(orientationEvent);
        const stableNextHeading = Number(nextHeading);
        if (!Number.isFinite(stableNextHeading)) return;
        const currentHeading = liveNorthHeadingDeg;
        if (currentHeading == null) {
            liveNorthHeadingDeg = stableNextHeading;
            return;
        }
        const stableHeading = Number(currentHeading);
        const delta = shortestSignedAngleDeg(stableHeading, stableNextHeading);
        liveNorthHeadingDeg = norm360(stableHeading + (delta * LIVE_NORTH_SMOOTHING));
    }

    function startLiveNorthStream(): boolean {
        if (typeof window === 'undefined') return false;
        if (!('DeviceOrientationEvent' in window)) return false;
        if (liveNorthListening) return true;
        window.addEventListener('deviceorientation', handleLiveNorthOrientation, true);
        window.addEventListener('deviceorientationabsolute', handleLiveNorthOrientation, true);
        liveNorthListening = true;
        return true;
    }

    function stopLiveNorthStream() {
        if (typeof window !== 'undefined' && liveNorthListening) {
            window.removeEventListener('deviceorientation', handleLiveNorthOrientation, true);
            window.removeEventListener('deviceorientationabsolute', handleLiveNorthOrientation, true);
        }
        liveNorthListening = false;
        liveNorthEnabled = false;
        liveNorthHeadingDeg = null;
    }

    async function readOrientationPermissions(): Promise<LiveNorthPermissionState> {
        if (typeof navigator === 'undefined' || !('permissions' in navigator)) return 'unknown';
        const names = ['accelerometer', 'gyroscope', 'magnetometer'] as const;
        let hasGranted = false;
        let hasPrompt = false;
        for (const name of names) {
            try {
                const status = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
                if (status.state === 'denied') return 'denied';
                if (status.state === 'prompt') hasPrompt = true;
                if (status.state === 'granted') hasGranted = true;
            } catch {
                // ignore unsupported permission descriptors
            }
        }
        if (hasPrompt) return 'prompt';
        if (hasGranted) return 'granted';
        return 'unknown';
    }

    async function ensureLiveNorthPermission(): Promise<LiveNorthPermissionState> {
        if (typeof window === 'undefined') return 'unsupported';
        if (!('DeviceOrientationEvent' in window)) return 'unsupported';
        const deviceOrientationCtor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
        if (typeof deviceOrientationCtor.requestPermission === 'function') {
            try {
                const result = await deviceOrientationCtor.requestPermission();
                return result === 'granted' ? 'granted' : 'denied';
            } catch {
                return 'denied';
            }
        }
        const sensorsPermission = await readOrientationPermissions();
        if (sensorsPermission === 'denied') return 'denied';
        if (sensorsPermission === 'prompt') return 'prompt';
        return 'granted';
    }

    async function toggleLiveNorth() {
        onUserActivity();
        if (liveNorthEnabled) {
            stopLiveNorthStream();
            return;
        }
        liveNorthError = '';
        const permission = await ensureLiveNorthPermission();
        liveNorthPermission = permission;
        if (permission === 'unsupported') {
            liveNorthError = 'Orientation sensor is unavailable on this device.';
            return;
        }
        if (permission === 'denied') {
            liveNorthError = 'Orientation permission was denied.';
            return;
        }
        if (!startLiveNorthStream()) {
            liveNorthPermission = 'unsupported';
            liveNorthError = 'Unable to start orientation listener.';
            return;
        }
        liveNorthEnabled = true;
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

    function filterVisibleOrbitNodes(nodes: OrbitNodeUi[]): OrbitNodeUi[] {
        return nodes.filter((n) => {
            if (isMainCycleBoundaryNode(n)) return true;
            const g = orbitNodeGroup(n);
            if (!showOrbitNodesAny) return false;
            return isOrbitNodeGroupVisible(g);
        });
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
        return filterVisibleOrbitNodes(orbitNodes);
    })();

    let orbitNodesSideVisible: OrbitNodeUi[] = [];
    $: orbitNodesSideVisible = (() => {
        const nodeGroupToggles = [
            orbitNodeGroupVisible.regular,
            orbitNodeGroupVisible.compass,
            orbitNodeGroupVisible.horizon,
            orbitNodeGroupVisible.nodal,
            orbitNodeGroupVisible.synod,
            orbitNodeGroupVisible.bind
        ];
        void nodeGroupToggles;
        return filterVisibleOrbitNodes(orbitNodesSide);
    })();

    $: hasPinnedAnyOrbitNodes = !!pinnedBodyId && orbitNodesAll.some((n) => n.bodyId === pinnedBodyId);
    $: hasPinnedNodalNodes = !!pinnedBodyId && orbitNodesAll.some(
        (n) => n.bodyId === pinnedBodyId && orbitNodeGroup(n) === 'nodal'
    );

    function activateSpokeFromOrbitNode(node: { source?: 'cycle' | 'spoke' | 'seam'; code: string }) {
        activeSpokeCode = node.source === 'spoke' ? node.code : null;
    }

    function buildAstroFrameAtTs(ts: number): CompassAstroFrameLayer | null {
        if (wheel?.wheelType !== 'compass') return null;
        return buildCompassAstroFrameLayer({
            ts,
            location: wheelLoc
        });
    }

    const CONSTELLATION_ENTRIES = constellationEntriesFromObjects(objects);

    function formatConstellationLabel(abbr: string | undefined, name: string | undefined): string {
        const abbrText = typeof abbr === 'string' ? abbr.trim() : '';
        const nameText = typeof name === 'string' ? name.trim() : '';
        if (abbrText && nameText) return `${abbrText} — ${nameText}`;
        return abbrText || nameText;
    }

    function astroConstellationText(meta: CompassAstroFrameNode['meta']): string {
        return formatConstellationLabel(meta?.constellationAbbr, meta?.constellationName);
    }

    function bodyConstellationInfoItem(body: CompassTargetState, ts: number): CompassInfoChip | null {
        const raHours = Number(body.raHours);
        const decDeg = Number(body.decDeg);
        if (!Number.isFinite(ts) || !Number.isFinite(raHours) || !Number.isFinite(decDeg)) return null;
        const hit = findConstellationByRaDec({
            raDeg: raHours * 15,
            decDeg,
            ts,
            constellations: CONSTELLATION_ENTRIES,
            boundaryLayer: 'spherical',
            geometry: 'spherical'
        });
        const value = formatConstellationLabel(hit?.abbr, hit?.name);
        if (!value) return null;
        return {
            id: `body:constellation:${body.id}`,
            label: 'Constellation',
            value,
            modal: hit?.description,
            emoji: hit?.emoji
        };
    }

    function bodyEclipticConstellationInfoItem(body: CompassTargetState, spokeCode?: string): CompassInfoChip | null {
        if (wheel?.wheelType !== 'system') return null;
        const synodCode = typeof spokeCode === 'string' && spokeCode.trim()
            ? spokeCode.trim()
            : normalizeBodyCurrentHouses(body).synod;
        if (!synodCode) return null;
        const hit = systemSpokeConstellation(synodCode);
        if (!hit?.value) return null;
        return {
            id: `body:ecliptic-constellation:${body.id}`,
            label: 'Synod Constellation',
            value: hit.value,
            modal: hit.modal,
            emoji: hit.emoji
        };
    }

    function bodyCurrentConstellationInfoItem(body: CompassTargetState): CompassInfoChip | null {
        if (wheel?.wheelType !== 'system') return null;
        const infoMeta = normalizeBodyInfoMeta(body);
        const synodMeta = infoMeta.synod;
        const value = typeof synodMeta?.currentConstellation === 'string' ? synodMeta.currentConstellation.trim() : '';
        if (!value) return null;
        const modal = typeof synodMeta?.currentConstellationDescription === 'string'
            ? synodMeta.currentConstellationDescription.trim()
            : '';
        return {
            id: `body:current-constellation:${body.id}`,
            label: 'Current Constellation',
            value,
            modal: modal || undefined,
            emoji: typeof synodMeta?.currentConstellationEmoji === 'string' ? synodMeta.currentConstellationEmoji : undefined
        };
    }

    function astroFrameNodeTip(node: CompassAstroFrameNode): MomentTip {
        const kindLabel = node.kind === 'pole' ? 'Pole' : 'Intersection';
        const label = `${node.emoji} ${node.label}`;
        const constellation = node.kind === 'pole' ? '' : astroConstellationText(node.meta);
        const constellationDescription = (() => {
            if (node.kind === 'pole') return undefined;
            const raHours = Number(node.meta?.raHours);
            const decDeg = Number(node.meta?.decDeg);
            if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) return undefined;
            return findConstellationByRaDec({
                raDeg: raHours * 15,
                decDeg,
                ts: node.ts,
                constellations: CONSTELLATION_ENTRIES,
                boundaryLayer: 'spherical',
                geometry: 'spherical'
            })?.description;
        })();
        const infoItems: MomentTip['infoItems'] = [];
        if (constellation) {
            infoItems.push({
                id: `astro:constellation:${node.id}`,
                label: 'Constellation',
                value: constellation,
                modal: constellationDescription,
                emoji: typeof node.meta?.constellationEmoji === 'string' ? node.meta.constellationEmoji : undefined
            });
        }
        const metaParts = [
            constellation ? `Constellation ${constellation}` : '',
            `Az ${fmtNodeDeg(node.azimuthDeg)}`,
            `Alt ${fmtNodeDeg(node.altitudeDeg)}`,
            Number.isFinite(node.meta?.raHours) ? `RA ${Number(node.meta?.raHours).toFixed(3)} h` : '',
            Number.isFinite(node.meta?.decDeg) ? `Dec ${fmtNodeDeg(Number(node.meta?.decDeg))}` : ''
        ].filter((x) => !!x);
        return {
            label,
            ts: node.ts,
            desc: `astro-frame:${node.kind}:${node.id}`,
            tags: [`astro-frame`, node.kind],
            infoItems,
            metaParts,
            metaText: `${kindLabel} • ${metaParts.join(' • ')}`,
            copyText: `${label} | ${metaParts.join(' | ')} | ts ${Math.round(node.ts)}`
        };
    }

    function handleAstroNodeKeydown(e: KeyboardEvent, tipData: MomentTip, key: string) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const ev = centerClickEvent(e.currentTarget);
            if (ev) tip.openMomentNow(ev, tipData);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            tip.hoverLeave(key);
        }
    }

    function astroOverlapInfoItemsForBody(bodyXY: { x: number; y: number }): CompassInfoChip[] {
        const out: CompassInfoChip[] = [];
        for (const astroNode of astroFrameNodes) {
            const d = Math.hypot(astroNode.x - bodyXY.x, astroNode.y - bodyXY.y);
            if (d > BODY_MARKER_HIDE_RADIUS_VB) continue;
            const constellation = astroNode.node.kind === 'pole' ? '' : astroConstellationText(astroNode.node.meta);
            out.push({
                id: `astro:overlap:${astroNode.id}`,
                label: astroNode.node.label,
                value: constellation || undefined,
                modal: astroNode.node.kind === 'pole'
                    ? 'Celestial pole marker from Astro Frame.'
                    : 'Seasonal Astro Frame marker (equinox/solstice).'
            });
        }
        return out;
    }

    function clearActiveSpoke() {
        activeSpokeCode = null;
    }

    let systemSpokeConstellations: Partial<Record<string, { value: string; description?: string; emoji?: string; ts: number }>> = {};
    $: systemSpokeConstellations = (() => {
        if (wheel?.wheelType !== 'system') return {};
        const looker = roles?.looker as ObjId | undefined;
        const focus = roles?.focus as ObjId | undefined;
        if (!looker || !focus || !Number.isFinite(effTs)) return {};
        return systemSynodSpokeConstellationsAt({ looker, focus, ts: effTs });
    })();

    function systemSpokeConstellation(spokeCode: string): { value: string; modal?: string; emoji?: string; ts: number } | null {
        const hit = systemSpokeConstellations[spokeCode];
        if (!hit?.value) return null;
        return {
            value: hit.value,
            modal: hit.description,
            emoji: hit.emoji,
            ts: hit.ts
        };
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

    function interpolateAstroFrameLayers(
        from: CompassAstroFrameLayer | null,
        to: CompassAstroFrameLayer | null,
        u: number
    ): CompassAstroFrameLayer | null {
        if (!from || !to) return to ?? from;

        const toCurveById = new Map(to.curves.map((c) => [c.id, c] as const));
        const curves = from.curves
            .map((curveFrom) => {
                const curveTo = toCurveById.get(curveFrom.id);
                if (!curveTo) return null;
                const n = Math.min(curveFrom.track.length, curveTo.track.length);
                if (n < 2) return null;
                const track = Array.from({ length: n }, (_, idx) => {
                    const a = curveFrom.track[idx];
                    const b = curveTo.track[idx];
                    const altitudeDeg = lerp(a.altitudeDeg, b.altitudeDeg, u);
                    const azimuthDeg = norm360(lerpAngleShortest(a.azimuthDeg, b.azimuthDeg, u));
                    return {
                        ...b,
                        ts: lerp(a.ts, b.ts, u),
                        index: b.index,
                        azimuthDeg,
                        altitudeDeg,
                        angleDeg: lerpAngleShortest(a.angleDeg, b.angleDeg, u),
                        orbit: lerp(a.orbit, b.orbit, u),
                        visible: altitudeDeg >= 0
                    };
                });
                return {
                    ...curveTo,
                    track
                };
            })
            .filter((x): x is CompassAstroFrameLayer['curves'][number] => !!x);

        const toNodeById = new Map(to.nodes.map((n) => [n.id, n] as const));
        const nodes = from.nodes
            .map((nodeFrom) => {
                const nodeTo = toNodeById.get(nodeFrom.id);
                if (!nodeTo) return null;
                const altitudeDeg = lerp(nodeFrom.altitudeDeg, nodeTo.altitudeDeg, u);
                return {
                    ...nodeTo,
                    ts: lerp(nodeFrom.ts, nodeTo.ts, u),
                    azimuthDeg: norm360(lerpAngleShortest(nodeFrom.azimuthDeg, nodeTo.azimuthDeg, u)),
                    altitudeDeg,
                    angleDeg: lerpAngleShortest(nodeFrom.angleDeg, nodeTo.angleDeg, u),
                    orbit: lerp(nodeFrom.orbit, nodeTo.orbit, u),
                    visible: altitudeDeg >= 0
                };
            })
            .filter((x): x is CompassAstroFrameLayer['nodes'][number] => !!x);

        return {
            curves,
            nodes
        };
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
        const fromAstroFrame = buildAstroFrameAtTs(fromTs);
        const toAstroFrame = buildAstroFrameAtTs(toTs);

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
            astroFrameLayerDisplay = toAstroFrame;
            return;
        }

        const duration = Math.max(220, Math.min(520, jump / 12_000));
        const t0 = performance.now();

        const tick = (now: number) => {
            if (token !== markerTweenToken) return;
            const u = easeInOut((now - t0) / duration);
            const tsNow = lerp(fromTs, toTs, u);
            astroFrameLayerDisplay = interpolateAstroFrameLayers(fromAstroFrame, toAstroFrame, u) ?? toAstroFrame;

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
                astroFrameLayerDisplay = toAstroFrame;
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

    function projectTargetPoint(
        target: Pick<CompassTargetState, 'angleDeg' | 'orbit' | 'altitudeDeg' | 'visible'> & {
            kind?: 'engine_body' | 'reference' | 'star' | 'pole';
            planeDistanceAu?: number;
            planeDistanceRatio?: number;
        },
        mode: VisualPaneMode
    ) {
        if (mode === 'top') {
            const r = orbitToRadiusVB(target.orbit);
            const xy = polarToXY(r, target.angleDeg);
            return { x: xy.x, y: xy.y, visible: !!target.visible };
        }

        if (target.kind === 'reference' || target.kind === 'star' || target.kind === 'pole') {
            const r = orbitToRadiusVB(target.orbit);
            const xy = polarToXY(r, target.angleDeg);
            return { x: xy.x, y: xy.y, visible: !!target.visible };
        }

        const angleDeg = Number.isFinite(target.angleDeg) ? Number(target.angleDeg) : 0;
        const distanceRatio = Number.isFinite(target.orbit) ? Number(target.orbit) : 0;
        const planeDistanceRatioRaw = target.planeDistanceRatio;
        const planeDistanceRatio = Number.isFinite(planeDistanceRatioRaw)
            ? Number(planeDistanceRatioRaw)
            : 0;
        const projected = projectSystemSideCoordinates(angleDeg, distanceRatio, planeDistanceRatio);
        return {
            x: cx + projected.x * rHorizon,
            y: cy - projected.y * rHorizon,
            visible: projected.visible
        };
    }

    function projectTrackPoint(point: NonNullable<CompassTargetState['orbitTrack']>[number], mode: VisualPaneMode) {
        return projectTargetPoint(point, mode);
    }

    function projectReferenceRingPoint(targetId: ObjId) {
        const target = lastTargets.find((t) => t.id === targetId);
        if (!target) return null;
        const r = orbitToRadiusVB(systemReferenceRingOrbit);
        const topPoint = polarToXY(r, target.angleDeg);
        const dx = topPoint.x - cx;
        const x = cx + dx;
        const yOffset = Math.sqrt(Math.max(0, (r * r) - (dx * dx)));
        const north = Number.isFinite(target.altitudeDeg) ? target.altitudeDeg >= 0 : true;
        return {
            x,
            y: north ? (cy - yOffset) : (cy + yOffset),
            visible: north
        };
    }

    function filterOrbitNodesNearBodies(
        nodes: OrbitNodeUi[],
        targets: CompassTargetState[],
        mode: VisualPaneMode
    ): OrbitNodeUi[] {
        const bodyPos = new Map<ObjId, { x: number; y: number }>();
        for (const t of targets) {
            const projected = projectTargetPoint(t, mode);
            bodyPos.set(t.id, { x: projected.x, y: projected.y });
        }

        return nodes.filter((n) => {
            const bp = bodyPos.get(n.bodyId);
            if (!bp) return true;
            const dx = n.x - bp.x;
            const dy = n.y - bp.y;
            return Math.hypot(dx, dy) > BODY_MARKER_HIDE_RADIUS_VB;
        });
    }

    function clusterProjectedMarkers(
        items: MarkerItem[],
        getPoint: (item: MarkerItem) => { x: number; y: number } | null,
        markerRadiusPx: number
    ): VisualMarkerCluster[] {
        if (!items.length) return [];

        const thresholdPx = 0.8 * markerRadiusPx;
        const pts = items
            .map((it) => {
                const point = getPoint(it);
                if (!point) return null;
                return { it, x: vbToPx(point.x - cx), y: vbToPx(point.y - cy) };
            })
            .filter((row): row is { it: MarkerItem; x: number; y: number } => !!row);

        if (!pts.length) return [];

        pts.sort((a, b) => a.y - b.y || a.x - b.x || a.it.ts - b.it.ts);

        const parent = Array.from({ length: pts.length }, (_, i) => i);
        const find = (i: number): number => {
            while (parent[i] !== i) {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            return i;
        };
        const union = (a: number, b: number) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent[rb] = ra;
        };

        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x;
                const dy = pts[i].y - pts[j].y;
                if (Math.hypot(dx, dy) < thresholdPx) union(i, j);
            }
        }

        const groups = new Map<number, MarkerItem[]>();
        for (let i = 0; i < pts.length; i++) {
            const root = find(i);
            const rows = groups.get(root);
            if (rows) rows.push(pts[i].it);
            else groups.set(root, [pts[i].it]);
        }

        const out: VisualMarkerCluster[] = [];
        for (const group of groups.values()) {
            const itemsSortedByTs = group.slice().sort((a, b) => a.ts - b.ts);
            const head = itemsSortedByTs[0];
            let sx = 0;
            let sy = 0;
            for (const it of itemsSortedByTs) {
                const point = getPoint(it);
                if (!point) continue;
                sx += point.x;
                sy += point.y;
            }
            sx /= itemsSortedByTs.length;
            sy /= itemsSortedByTs.length;

            const opacityValues = itemsSortedByTs
                .map((it) => it.opacity)
                .filter((v): v is number => Number.isFinite(v));
            const opacity = opacityValues.length ? Math.min(...opacityValues) : head.opacity;
            const count = itemsSortedByTs.length;
            const id = count === 1
                ? head.id
                : `cluster:${head.collectionId}:${head.ts}:${Math.round(sx)}:${Math.round(sy)}:${count}`;

            out.push({
                id,
                ts: head.ts,
                angleDeg: head.angleDeg,
                orbit: head.orbit,
                bg: head.bg,
                count,
                emoji: count === 1 ? head.emoji : undefined,
                color: count === 1 ? head.color : undefined,
                label: count > 1 ? String(count) : undefined,
                items: itemsSortedByTs,
                opacity,
                x: sx,
                y: sy
            });
        }

        out.sort((a, b) => a.y - b.y || a.x - b.x || a.ts - b.ts);
        const seen = new Map<string, number>();
        return out.map((row) => {
            const n = seen.get(row.id) ?? 0;
            seen.set(row.id, n + 1);
            if (n === 0) return row;
            return {
                ...row,
                id: `${row.id}:dup${n}`
            };
        });
    }

    function sideTrackPathD(track: NonNullable<CompassTargetState['orbitTrack']>): string {
        const pts = track
            .slice()
            .sort((a, b) => a.ts - b.ts)
            .map((p) => projectTrackPoint(p, 'side'));
        if (pts.length < 2) return '';
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x} ${pts[i].y}`;
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
        if (pinnedBodyId !== id) editingBodyId = null;
    }

    function openPinnedBodyEditor(bodyId: ObjId) {
        if ($isActiveProfileLocked) return;
        editingBodyId = bodyId;
    }

    function closePinnedBodyEditor() {
        editingBodyId = null;
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

    function handleMarkerPick(
        ts0: number,
        bodyId?: ObjId,
        code?: string,
        sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal'
    ) {
        if (!Number.isFinite(ts0)) return;
        onUserActivity();
        const tipMoment = get(tipState).moment;
        const parsed = parseOrbitNodeDesc(tipMoment?.desc);
        const snapBody = bodyId ?? parsed?.bodyId;
        const baseCode = code ?? parsed?.code;
        const mainCycle = mainCycleSourceForActiveWheel();

        const pickTsList = (tipMoment?.pickTsList ?? [])
            .filter((x): x is number => Number.isFinite(x))
            .sort((a, b) => a - b);
        const lastPickTs = pickTsList.length ? pickTsList[pickTsList.length - 1] : NaN;
        const hasMainCycleEndTag = !!mainCycle && Array.isArray(tipMoment?.tags) && tipMoment.tags.includes(`E_next-${mainCycle}`);
        const isMainCycleEndBySource = !!mainCycle && (baseCode === 'E_next' || baseCode === 'E+') && sourceWheel === mainCycle;
        const isMainCycleEndByPickList = hasMainCycleEndTag && Number.isFinite(lastPickTs) && Math.abs(ts0 - lastPickTs) <= 1_000;
        const shouldStepToNextCycle =
            isMainCycleEndBySource ||
            isMainCycleEndByPickList ||
            (hasMainCycleEndTag && pickTsList.length <= 1 && (baseCode === 'E_next' || baseCode === 'E+'));

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

    const LY_PER_PC = 3.26156;
    const AU_PER_PC = AU_PER_LY * LY_PER_PC;

    function isReferenceStarDistance(id: ObjId): boolean {
        const distancePc = resolveBodyDistancePc(id);
        return Number.isFinite(distancePc) && distancePc > 0;
    }

    function fmtNodeDistForBody(id: ObjId, au: number): string {
        if (!Number.isFinite(au)) return '—';
        if (isReferenceStarDistance(id)) {
            return `${(au / AU_PER_PC).toFixed(3)} pc`;
        }
        return fmtNodeDistAu(au);
    }

    function formatDistAuValue3(au: number): string | undefined {
        if (!Number.isFinite(au)) return undefined;
        return au.toFixed(3);
    }

    function normalizeCompassBodyInfoItems(bodyId: ObjId, items: CompassInfoChip[]): CompassInfoChip[] {
        if (!isReferenceStarDistance(bodyId)) return items;
        return items.filter((item) => item.id === 'system:dist-ps' || item.id === 'system:dist-ly' || !item.id.startsWith('system:dist-'));
    }

    function starInfoDefsForMetaField(metaField: string | undefined): InfoItem[] {
        if (!metaField) return [];
        return STAR_INFO_ITEMS.filter((row) => row.metaField === metaField);
    }

    function nodeInfoItemsFromSpec(
        source: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal' | undefined,
        code: string,
        meta: Record<string, unknown>,
        bodyId?: ObjId
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
            const id = `dynamic:${tagIdFromLabel(label)}`;
            const cfg = dynamicTagConfigById.get(id);
            const resolvedLabel = (cfg?.label && cfg.label.trim()) ? cfg.label.trim() : label;
            const resolvedModal = (cfg?.modal && cfg.modal.trim())
                ? cfg.modal.trim()
                : (typeof def.modal === 'string' ? def.modal : undefined);
            if (def.metaField) {
                const rawValue = meta?.[def.metaField];
                if (rawValue == null || rawValue === '') continue;
                const rawNumber = Number(rawValue);
                const formatInput = (typeof rawValue === 'number' || typeof rawValue === 'string' || rawValue == null)
                    ? rawValue
                    : String(rawValue);
                const isStar = !!(bodyId && isReferenceStarDistance(bodyId));
                const starDefs = isStar ? starInfoDefsForMetaField(def.metaField) : [];
                if (starDefs.length > 0) {
                    for (const starDef of starDefs) {
                        const starLabel = String(starDef.defaultLabel ?? starDef.label ?? '').trim();
                        if (!starLabel) continue;
                        const starFormatInput = starDef.metaField === def.metaField ? formatInput : rawNumber;
                        const starValue = formatInfoValue(starDef.format, starFormatInput);
                        if (!starValue || starValue === '—') continue;
                        out.push({
                            id: `dynamic:${tagIdFromLabel(starLabel)}`,
                            label: uiLabel(starLabel),
                            value: starValue,
                            modal: typeof starDef.modal === 'string' ? starDef.modal : resolvedModal
                        });
                    }
                    continue;
                }

                const value = def.metaField === 'distanceAu'
                    ? (formatDistAuValue3(rawNumber) ?? '—')
                    : (def.format ? formatInfoValue(def.format, formatInput) : String(formatInput));
                const dynamicModal = (() => {
                    if (def.metaField === 'constellation') {
                        return (typeof meta?.constellationDescription === 'string' && meta.constellationDescription.trim())
                            ? meta.constellationDescription.trim()
                            : resolvedModal;
                    }
                    if (def.metaField === 'currentConstellation') {
                        return (typeof meta?.currentConstellationDescription === 'string' && meta.currentConstellationDescription.trim())
                            ? meta.currentConstellationDescription.trim()
                            : resolvedModal;
                    }
                    return resolvedModal;
                })();
                const dynamicEmoji = (() => {
                    if (def.metaField === 'constellation') {
                        return (typeof meta?.constellationEmoji === 'string' && meta.constellationEmoji.trim())
                            ? meta.constellationEmoji.trim()
                            : undefined;
                    }
                    if (def.metaField === 'currentConstellation') {
                        return (typeof meta?.currentConstellationEmoji === 'string' && meta.currentConstellationEmoji.trim())
                            ? meta.currentConstellationEmoji.trim()
                            : undefined;
                    }
                    return undefined;
                })();
                out.push({
                    id,
                    label: resolvedLabel,
                    value,
                    modal: dynamicModal,
                    emoji: dynamicEmoji
                });

                continue;
            }
            out.push({
                id,
                label: resolvedLabel,
                modal: resolvedModal
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

    function normalizeBodyCurrentHouses(t: CompassTargetState): CompassBodyCurrentHouses {
        const raw = (t as any).currentHouses;
        if (!raw || typeof raw !== 'object') return {};
        const obj = raw as Record<string, unknown>;
        const out: CompassBodyCurrentHouses = {};
        for (const source of ['compass', 'horizon', 'synod', 'bind', 'nodal'] as const) {
            const value = obj[source];
            if (typeof value !== 'string') continue;
            const code = value.trim();
            if (!code) continue;
            out[source] = code;
        }
        return out;
    }

    function moonPhaseInfoItem(t: CompassTargetState): CompassInfoChip | null {
        if (t.id !== 'Moon') return null;
        const phaseName = typeof (t as any).moonPhaseName === 'string' ? (t as any).moonPhaseName.trim() : '';
        const phaseEmoji = typeof (t as any).moonPhaseEmoji === 'string' ? (t as any).moonPhaseEmoji.trim() : '';
        const fraction = Number((t as any).moonPhaseFraction);
        if (!phaseName && !Number.isFinite(fraction) && !phaseEmoji) return null;
        const illum = Number.isFinite(fraction) ? `${(fraction * 100).toFixed(1)}%` : '';
        const value = phaseName && illum ? `${phaseName} (${illum})` : (phaseName || illum || '');
        return {
            id: 'moon-phase',
            label: 'Moon Phase',
            value: value || undefined,
            modal: 'Geocentric lunar phase for the current timestamp, with illuminated fraction.',
            emoji: phaseEmoji || '🌙'
        };
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
    let lookerEmoji: string | null = null;
    let templateUiOverride: Partial<Record<RoleName, EmojiPlacementInput>> | null = null;

    function roleTargetIds(raw: unknown): ObjId[] {
        if (Array.isArray(raw)) return raw.filter((x): x is ObjId => typeof x === 'string' && !!x);
        if (typeof raw === 'string' && raw) return [raw as ObjId];
        return [];
    }

    function applyTemplateConfigFromResponse(res: WheelSolveResult | null | undefined) {
        const updater = (res as any)?.templateConfigUpdater;
        if (typeof updater !== 'function') {
            templateUiOverride = null;
            return;
        }
        const patch = updater();
        templateUiOverride = (patch && typeof patch === 'object' && patch.ui && typeof patch.ui === 'object')
            ? (patch.ui as Partial<Record<RoleName, EmojiPlacementInput>>)
            : null;
    }

    $: {
        spec = wheel?.wheelType ? ((wheels as any)[wheel.wheelType] as WheelSpec) : null;

        const baseUi = (spec as any)?.ui as Partial<Record<RoleName, EmojiPlacementInput>> | undefined;
        const ui = templateUiOverride ? { ...(baseUi ?? {}), ...templateUiOverride } : baseUi;
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

        lookerEmoji = roleEmojiById(lookerId);

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

    function sideEmojiAtLabel(label: string): string | null {
        return emojiAtLabel(label);
    }

    function sideEmojiAtSpoke(label: string): string | null {
        if (wheel?.wheelType === 'system' && label === 'S') return null;
        return emojiAtSpoke(label);
    }

    $: {
        centerEmoji = emojiAtCenter();
    }
    $: hideZenithTop = !!centerEmoji || markerClusters.some((c) => {
        if ((c.opacity ?? 1) <= 0.05) return false;
        const p = polarToXY(orbitToRadiusVB(c.orbit), c.angleDeg);
        return overlapsWheelCenter(p.x, p.y);
    });
    $: hideZenithSide = !!centerEmoji || sideMarkerClusters.some((c) => {
        if ((c.opacity ?? 1) <= 0.05) return false;
        return overlapsWheelCenter(c.x, c.y);
    });

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
    let solveReason = '';
    let solveDoneForKey = false;
    let solveDoneKey = '';
    let showLoadingOverlay = false;
    let showLoadingOverlayBase = false;
    let loadingOverlayTimer: ReturnType<typeof setTimeout> | null = null;
    $: if (solveDoneKey !== solveDepsKey) {
        solveDoneKey = solveDepsKey;
        solveDoneForKey = false;
    }
    $: showLoadingOverlayBase = solveInputReady && (solvePending || !solveDoneForKey);
    $: {
        if (showLoadingOverlayBase) {
            if (!showLoadingOverlay && !loadingOverlayTimer) {
                loadingOverlayTimer = setTimeout(() => {
                    showLoadingOverlay = true;
                    loadingOverlayTimer = null;
                }, WHEEL_LOADING_OVERLAY_DELAY_MS);
            }
        } else {
            if (loadingOverlayTimer) {
                clearTimeout(loadingOverlayTimer);
                loadingOverlayTimer = null;
            }
            showLoadingOverlay = false;
        }
    }

    async function ensureCompassForTs(ts: number) {
        const myRun = ++ensureRunId;
        solvePending = true;
        solveReason = '';

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
            applyTemplateConfigFromResponse(res);

            if (!res || res.kind !== 'compass' || !res.ok) {
                solveReason = (res && (res as any)?.kind === 'compass')
                    ? (String((res as any)?.reason ?? 'Solve failed'))
                    : 'Not a compass result';
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
        } catch (e: any) {
            if (ensureRunId !== myRun) return;
            solveReason = e?.message ? String(e.message) : 'Solve failed';
            markerClusters = [];
            lastTargets = [];
            displayTargets = [];
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
        const markerClusterRadiusPx = MARKER_STYLE.ringPx * markerScaleBias;
        const orbitToRadiusPx = (orbit: number) => vbToPx(orbitToRadiusVB(orbit));
        markerClusters = compassClusters(items, orbitToRadiusPx, markerClusterRadiusPx);
        const targetByBaseId = new Map<string, (CompassTargetState & { hiddenDuringTween?: boolean })>(
            visibleDisplayTargets.map((t) => [`body:${String(t.id)}`, t])
        );
        sideMarkerClusters = supportsSecondaryVisual
            ? clusterProjectedMarkers(
                items,
                (item) => {
                    const target = targetByBaseId.get(item.baseId);
                    if (!target) return null;
                    if (objects?.[target.id]?.kind === 'reference' || objects?.[target.id]?.kind === 'star' || objects?.[target.id]?.kind === 'pole') {
                        return projectReferenceRingPoint(target.id);
                    }
                    return projectTargetPoint(target, 'side');
                },
                markerClusterRadiusPx
            )
            : [];
    }

    $: {
        if (wheel?.wheelType !== 'compass') {
            astroFrameLayerDisplay = null;
            astroFrameCurves = [];
            astroFrameNodes = [];
        } else {
            if (!astroFrameLayerDisplay) {
                astroFrameLayerDisplay = buildAstroFrameAtTs(effTs);
            }
            const layer = astroFrameLayerDisplay;
            if (!layer) {
                astroFrameCurves = [];
                astroFrameNodes = [];
            } else {
                astroFrameCurves = layer.curves
                    .flatMap((curve) => {
                        if (!curve.track || curve.track.length < 2) return [];
                        const segments = splitTrackByVisibility(curve.track);
                        return segments.flatMap((s, idx) => {
                            if (!s.visible) return [];
                            if (!s.pts || s.pts.length < 2) return [];
                            const d = trackPathD(s.pts);
                            if (!d) return [];
                            return [{
                                id: curve.id,
                                seg: idx,
                                d,
                                visible: true
                            }];
                        });
                    })
                    ;

                astroFrameNodes = layer.nodes.flatMap((node) => {
                    if (!node.visible) return [];
                    const p = polarToXY(orbitToRadiusVB(node.orbit), node.angleDeg);
                    return [{
                        id: node.id,
                        kind: node.kind,
                        x: p.x,
                        y: p.y,
                        visible: true,
                        node,
                        tip: astroFrameNodeTip(node)
                    }];
                });
            }
        }
    }

    $: {
        if (wheel?.wheelType !== 'compass' || !showConstellationBoundaries) {
            constellationBoundaryCurves = [];
        } else {
            const layer = buildCompassConstellationBoundaryLayer({
                ts: effTs,
                location: wheelLoc,
                constellations: CONSTELLATION_ENTRIES
            });
            if (!layer) {
                constellationBoundaryCurves = [];
            } else {
                constellationBoundaryCurves = layer.curves
                    .flatMap((curve) => {
                        if (!curve.track || curve.track.length < 2) return [];
                        const segments = splitTrackByVisibility(curve.track);
                        return segments.flatMap((s, idx) => {
                            if (!s.visible || !s.pts || s.pts.length < 2) return [];
                            const d = trackPathD(s.pts);
                            if (!d) return [];
                            return [{
                                id: curve.id,
                                seg: idx,
                                d,
                                visible: true,
                                title: curve.constellationName
                            }];
                        });
                    });
            }
        }
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

    $: sideOrbitCurves = supportsSecondaryVisual
        ? lastTargets
            .flatMap((t) => {
                const track = t.orbitTrack;
                if (!track || track.length < 2) return [];

                const segments = splitTrackByVisibility(track);
                return segments
                    .map((s, idx) => {
                        if (!s.pts || s.pts.length < 2) return null;
                        const d = sideTrackPathD(s.pts);
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
            .filter((x): x is { id: ObjId; seg: number; d: string; visible: boolean } => !!x)
        : [];

    $: rawOrbitNodes = lastTargets
        .flatMap((t) => {
            const emoji = resolveBodyEmoji(t.id, activeBodyOverrides);
            const name = resolveBodyName(t.id, activeBodyOverrides);
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
                const pointTags = Array.isArray(p.tags) ? p.tags.filter((x): x is string => typeof x === 'string') : [];
                const pointTechTags = nodeTechTagsFromTags(pointTags);
                const pointTechTagsUi = pointTechTags.map((tag) => resolvePinnedTechTagLabel(tag));
                const sourceWheel = p.sourceWheel;
                const pointMeta = (p.meta && typeof p.meta === 'object') ? p.meta : {};
                const infoItems = nodeInfoItemsFromSpec(sourceWheel, p.code, pointMeta, t.id);
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
                    Number.isFinite(distAu) ? `${distanceLabel} ${fmtNodeDistForBody(t.id, distAu)}` : ''
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
                    ...pointTechTagsUi.map((tag) => `Node ${tag}`),
                    `ts ${Math.round(p.ts)}`
                ];
                const keyTags = pointTags.length ? pointTags.join(',') : 'no-tags';
                return {
                    key: `orbit-node:${t.id}:${p.code}:${p.source ?? 'cycle'}:${p.index}:${p.ts}:${keyTags}`,
                    bodyId: t.id,
                    code: p.code,
                    source: p.source,
                    sourceWheel,
                    meta: pointMeta,
                    infoItems,
                    ts: p.ts,
                    trackPoint: p,
                    tip: {
                        label: `${emoji} ${name} orbit node (${uiCode})`,
                        ts: p.ts,
                        desc: `orbit-node:${t.id}:${p.code}`,
                        tags: pointTags,
                        techTags: pointTechTagsUi,
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

    $: {
        const projectedTop = dedupeOrbitNodesByBody(
            rawOrbitNodes.map((node) => {
                const projected = projectTrackPoint(node.trackPoint, 'top');
                return {
                    ...node,
                    x: projected.x,
                    y: projected.y,
                    visible: projected.visible
                };
            })
        );
        orbitNodesAll = projectedTop;
        orbitNodes = filterOrbitNodesNearBodies(projectedTop, lastTargets, 'top');

        const projectedSide = dedupeOrbitNodesByBody(
            rawOrbitNodes.map((node) => {
                const projected = projectTrackPoint(node.trackPoint, 'side');
                return {
                    ...node,
                    x: projected.x,
                    y: projected.y,
                    visible: projected.visible
                };
            })
        );
        orbitNodesSideAll = projectedSide;
        orbitNodesSide = filterOrbitNodesNearBodies(projectedSide, lastTargets, 'side');
    }

    // table rows for tooltip / pinned row
    $: allBodies = lastTargets.map(t => {
        const name = resolveBodyName(t.id, activeBodyOverrides);
        const moonPhaseEmoji = (t.id === 'Moon' && typeof (t as any).moonPhaseEmoji === 'string')
            ? String((t as any).moonPhaseEmoji).trim()
            : '';
        const emoji = moonPhaseEmoji || resolveBodyEmoji(t.id, activeBodyOverrides);
        const color = resolveBodyColor(t.id);
        const house = houseLabelForAzimuth(t.azimuthDeg);
        const isSystemWheel = wheel?.wheelType === 'system';
        const primaryDeg = isSystemWheel ? Number((t as any).phaseDeg ?? NaN) : t.azimuthDeg;
        const secondaryDeg = t.altitudeDeg;
        const bodyR = orbitToRadiusVB(t.orbit);
        const bodyXY = polarToXY(bodyR, t.angleDeg);
        const astroOverlapItems = astroOverlapInfoItemsForBody(bodyXY);
        const constellationItem = bodyConstellationInfoItem(t, effTs);
        const eclipticConstellationItem = bodyEclipticConstellationInfoItem(t, house);
        const currentConstellationItem = bodyCurrentConstellationInfoItem(t);
        const moonPhaseItem = moonPhaseInfoItem(t);

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
            color,
            distanceAu: Number.isFinite((t as any).distanceAu) ? Number((t as any).distanceAu) : NaN,
            distanceLabel: Number.isFinite((t as any).distanceAu) && typeof (t as any).distanceLabel === 'string' && (t as any).distanceLabel
                ? (t as any).distanceLabel
                : '',
            primaryDeg,
            secondaryDeg,
            primaryLabel: isSystemWheel ? 'Phase' : 'Az',
            secondaryLabel: isSystemWheel ? 'Ecl' : 'Alt',
            aboveLabel: isSystemWheel ? 'north' : 'above',
            belowLabel: isSystemWheel ? 'south' : 'below',
            house,
            visible: Number.isFinite(secondaryDeg) ? secondaryDeg >= 0 : true,
            infoMeta: normalizeBodyInfoMeta(t),
            currentHouses: normalizeBodyCurrentHouses(t),
            bodyInfoItems: normalizeCompassBodyInfoItems(
                t.id,
                [
                    ...(moonPhaseItem ? [moonPhaseItem] : []),
                    ...(currentConstellationItem ? [currentConstellationItem] : []),
                    ...(eclipticConstellationItem ? [eclipticConstellationItem] : []),
                    ...(constellationItem ? [constellationItem] : []),
                    ...resolveBodyInfoItems(t.id, activeBodyOverrides, 'en', activeStarInfoItems, activeBodyDescriptionLabel),
                    ...astroOverlapItems
                ]
            ),
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

        const moonPhaseEmoji = (t.id === 'Moon' && typeof (t as any).moonPhaseEmoji === 'string')
            ? String((t as any).moonPhaseEmoji).trim()
            : '';
        const emoji = moonPhaseEmoji || resolveBodyEmoji(pinnedBodyId, activeBodyOverrides);
        const name = resolveBodyName(pinnedBodyId, activeBodyOverrides);
        const color = resolveBodyColor(pinnedBodyId);

        return {
            id: pinnedBodyId,
            emoji,
            name,
            color,
            distanceAu: Number.isFinite((t as any).distanceAu) ? Number((t as any).distanceAu) : NaN,
            distanceLabel: Number.isFinite((t as any).distanceAu) && typeof (t as any).distanceLabel === 'string' && (t as any).distanceLabel
                ? (t as any).distanceLabel
                : '',
            house: houseFromAzimuth(t.azimuthDeg),
            primaryDeg: wheel?.wheelType === 'system' ? Number((t as any).phaseDeg ?? NaN) : t.azimuthDeg,
            secondaryDeg: t.altitudeDeg,
            primaryLabel: wheel?.wheelType === 'system' ? 'Phase' : 'Az',
            secondaryLabel: wheel?.wheelType === 'system' ? 'Ecl' : 'Alt',
            visible: !!t.visible
        };
    })();

    $: tooltipSeparatorLabel = wheel?.wheelType === 'system' ? 'PLANE' : 'HORIZON';

    function buildHouseTip(label: string): MomentTip {
        const base: MomentTip = { label, ts: effTs, desc: `house:${label}` };
        const systemConstellation = systemSpokeConstellation(label);
        if (!systemConstellation) return base;
        const constellationText = `Synod Constellation ${systemConstellation.value}`;
        return {
            ...base,
            infoItems: [{
                id: `house:${label}:constellation`,
                label: 'Synod Constellation',
                value: systemConstellation.value,
                modal: systemConstellation.modal,
                emoji: systemConstellation.emoji
            }],
            metaParts: [constellationText],
            metaText: `Spoke ${label} • ${constellationText}`,
            copyText: `Spoke ${label} | ${constellationText} | ts ${Math.round(systemConstellation.ts)}`
        };
    }

    // ------------------------------------------------------------
    // Responsive + tooltip
    // ------------------------------------------------------------
    const responsive = useWheelResponsive();
    let size = 360;
    $: size = responsive.size;

    let wrapEl: HTMLDivElement | null = null;
    $: responsive.bindWrap(wrapEl);
    let panelEl: HTMLElement | null = null;
    let visualPaneEl: HTMLDivElement | null = null;
    let visualPaneHeight = 0;
    let visualPaneResizeObserver: ResizeObserver | null = null;

    let isCoarsePointer = false;
    $: isCoarsePointer = responsive.isCoarsePointer;
    let isPhoneLayout = false;
    $: isPhoneLayout = responsive.isPhoneLayout;
    $: liveNorthSupported = isPhoneLayout && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    $: if (!liveNorthSupported && liveNorthEnabled) {
        stopLiveNorthStream();
    }
    $: if (wheel?.wheelType !== 'compass' && liveNorthEnabled) {
        stopLiveNorthStream();
    }
    $: liveNorthButtonTitle = (() => {
        if (!liveNorthEnabled) {
            if (liveNorthError) return liveNorthError;
            return 'Enable live true north direction';
        }
        if (!Number.isFinite(liveNorthHeadingDeg)) return 'Live true north: waiting for sensor data';
        return `Live true north: ${Math.round(Number(liveNorthHeadingDeg))}°`;
    })();
    let paneResizeState:
        | { kind: 'visual'; startX: number; startY: number; startColsValue: number; startCardCols: number; startPanelWidth: number }
        | { kind: 'info'; startX: number; startColsValue: number; position: 'left' | 'right'; startCardCols: number; startPanelWidth: number }
        | { kind: 'info-bottom-height'; startY: number; startValue: number }
        | null = null;

    function handleMarkerActivate(c: MarkerCluster) {
        dbg.log('Cluster Activate', c);
    }

    function updateVisualPaneHeight() {
        visualPaneHeight = Math.max(0, Math.round(visualPaneEl?.getBoundingClientRect().height ?? 0));
    }

    let observedVisualPaneEl: HTMLDivElement | null = null;

    $: {
        if (visualPaneResizeObserver && observedVisualPaneEl && observedVisualPaneEl !== visualPaneEl) {
            visualPaneResizeObserver.unobserve(observedVisualPaneEl);
            observedVisualPaneEl = null;
        }
        if (!visualPaneEl || typeof ResizeObserver === 'undefined') {
            updateVisualPaneHeight();
        } else {
            if (!visualPaneResizeObserver) {
                visualPaneResizeObserver = new ResizeObserver(() => updateVisualPaneHeight());
            }
            if (observedVisualPaneEl !== visualPaneEl) {
                visualPaneResizeObserver.observe(visualPaneEl);
                observedVisualPaneEl = visualPaneEl;
            }
            queueMicrotask(updateVisualPaneHeight);
        }
    }

    function currentLayoutCols(): number {
        const cols = Number(wheel?.layout?.w);
        if (!Number.isFinite(cols) || cols <= 0) return 1;
        return Math.max(1, Math.round(cols));
    }

    function finishPaneResize() {
        paneResizeState = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', handlePaneResizeMove);
        window.removeEventListener('pointerup', handlePaneResizeEnd);
        window.removeEventListener('pointercancel', handlePaneResizeEnd);
    }

    function handlePaneResizeMove(e: PointerEvent) {
        if (!paneResizeState || !wheelId) return;

        if (paneResizeState.kind === 'visual') {
            const dx = e.clientX - paneResizeState.startX;
            const dy = e.clientY - paneResizeState.startY;
            const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
            const deltaCols = resizeColsDelta(delta, paneResizeState.startPanelWidth, paneResizeState.startCardCols);
            const nextVisualCols = clampCompassVisualCols(paneResizeState.startColsValue + deltaCols);
            const nextCols = totalCardCols(compassInfoPosition, nextVisualCols, compassInfoSideCols, showDualVisualRow);
            boardApi.updateWheelById(
                wheelId,
                {
                    view: { compassVisualCols: nextVisualCols },
                    layout: { w: nextCols }
                },
                'Compass.resizeVisual'
            );
            return;
        }

        if (paneResizeState.kind === 'info-bottom-height') {
            const dy = e.clientY - paneResizeState.startY;
            boardApi.updateWheelById(
                wheelId,
                { view: { compassInfoBottomHeight: clampCompassInfoBottomHeight(paneResizeState.startValue + dy) } },
                'Compass.resizeInfoBottomHeight'
            );
            return;
        }

        const dx = e.clientX - paneResizeState.startX;
        const deltaCols = resizeColsDelta(dx, paneResizeState.startPanelWidth, paneResizeState.startCardCols);
        const nextInfoCols = clampCompassInfoSideCols(paneResizeState.startColsValue + deltaCols);
        const nextCols = totalCardCols(compassInfoPosition, compassVisualCols, nextInfoCols, showDualVisualRow);
        boardApi.updateWheelById(
            wheelId,
            {
                view: { compassInfoSideCols: nextInfoCols },
                layout: { w: nextCols }
            },
            'Compass.resizeInfoSideWidth'
        );
    }

    function handlePaneResizeEnd() {
        finishPaneResize();
    }

    function startVisualResize(e: PointerEvent) {
        if (!wheelId || !panelEl) return;
        e.preventDefault();
        e.stopPropagation();
        paneResizeState = {
            kind: 'visual',
            startX: e.clientX,
            startY: e.clientY,
            startColsValue: compassVisualCols,
            startPanelWidth: panelEl.getBoundingClientRect().width,
            startCardCols: currentLayoutCols()
        };
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePaneResizeMove);
        window.addEventListener('pointerup', handlePaneResizeEnd);
        window.addEventListener('pointercancel', handlePaneResizeEnd);
    }

    function startInfoWidthResize(e: PointerEvent) {
        if (!wheelId || !panelEl || !showInfoWidthResizeHandle || compassInfoPosition === 'bottom') return;
        e.preventDefault();
        e.stopPropagation();
        paneResizeState = {
            kind: 'info',
            startX: e.clientX,
            startColsValue: compassInfoSideCols,
            position: compassInfoPosition,
            startPanelWidth: panelEl.getBoundingClientRect().width,
            startCardCols: currentLayoutCols()
        };
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePaneResizeMove);
        window.addEventListener('pointerup', handlePaneResizeEnd);
        window.addEventListener('pointercancel', handlePaneResizeEnd);
    }

    function startInfoBottomHeightResize(e: PointerEvent) {
        if (!wheelId || !showInfoHeightResizeHandle) return;
        e.preventDefault();
        e.stopPropagation();
        paneResizeState = {
            kind: 'info-bottom-height',
            startY: e.clientY,
            startValue: compassInfoBottomHeight
        };
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePaneResizeMove);
        window.addEventListener('pointerup', handlePaneResizeEnd);
        window.addEventListener('pointercancel', handlePaneResizeEnd);
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

    function handleHouseTap(e: MouseEvent, houseTip: MomentTip, spokeCode: string) {
        if (isPhoneLayout) {
            handleSpokeDoubleClick(spokeCode);
            return;
        }
        tip.openMomentNow(e, houseTip);
    }

    function handleHouseLongPress(e: MouseEvent, houseTip: MomentTip) {
        if (!isPhoneLayout) return;
        e.preventDefault();
        e.stopPropagation();
        tip.openMomentNow(e, houseTip);
    }

    function handleOrbitNodeTap(
        e: MouseEvent,
        node: {
            tip: MomentTip;
            ts: number;
            bodyId: ObjId;
            code: string;
            sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
        }
    ) {
        if (isPhoneLayout) {
            if ((node.tip.pickTsList?.length ?? 0) > 1) return;
            e.preventDefault();
            e.stopPropagation();
            handleMarkerPick(node.ts, node.bodyId, node.code, node.sourceWheel);
            return;
        }
        tip.openMomentNow(e, node.tip);
    }

    function handleOrbitNodeLongPress(e: MouseEvent, nodeTip: MomentTip) {
        if (!isPhoneLayout) return;
        e.preventDefault();
        e.stopPropagation();
        tip.openMomentNow(e, nodeTip);
    }

    function handleClusterTap(e: MouseEvent, c: MarkerCluster) {
        e.preventDefault();
        e.stopPropagation();

        const id = clusterSingleBodyId(c);
        if (id) togglePin(id);
        if (!isPhoneLayout) tip.openClusterNow(e, c);
    }

    function handleClusterLongPress(e: MouseEvent, c: MarkerCluster) {
        if (!isPhoneLayout) return;
        e.preventDefault();
        e.stopPropagation();
        tip.openClusterNow(e, c);
    }

    const tip = useTooltip({
        isCoarsePointer: () => isCoarsePointer,
        isDoubleTapRequired: () => isPhoneLayout,
        onActivateCluster: (c) => handleMarkerActivate(c),
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });
    const tipState = tip.state;

    onDestroy(() => {
        stopMarkerTween();
        stopLiveNorthStream();
        finishPaneResize();
        if (visualPaneResizeObserver && observedVisualPaneEl) visualPaneResizeObserver.unobserve(observedVisualPaneEl);
        visualPaneResizeObserver?.disconnect();
        if (loadingOverlayTimer) {
            clearTimeout(loadingOverlayTimer);
            loadingOverlayTimer = null;
        }
    });

    $: supportsSecondaryVisual = wheel?.wheelType === 'system';
    $: showVisualSection = wheel?.view?.showVisual !== false;
    $: showSecondaryVisualSection = supportsSecondaryVisual && wheel?.view?.showSecondaryVisual === true;
    $: showInfoSection = ((wheel?.view?.showInfo ?? (isPhoneLayout ? true : false)) === true);
    $: showPickersSection = wheel?.view?.showPickers === true;
    $: hasVisualSection = showVisualSection || showSecondaryVisualSection;
    $: showDualVisualRow = hasVisualSection && showVisualSection && showSecondaryVisualSection && wheel?.view?.visualLayout === 'row';
    $: visualRowSide = wheel?.view?.visualRowSide === 'left' ? 'left' : 'right';
    $: visualColumnOrder = wheel?.view?.visualColumnOrder === 'side-first' ? 'side-first' : 'top-first';
    $: compassInfoPosition = normalizeCompassInfoPosition(wheel?.view?.compassInfoPosition, hasVisualSection);
    $: showInfoSide = showInfoSection && hasVisualSection && compassInfoPosition !== 'bottom';
    $: showInfoWidthResizeHandle = showInfoSection && showInfoSide;
    $: showInfoHeightResizeHandle = showInfoSection && !showInfoSide;
    $: compassVisualCols = clampCompassVisualCols((wheel?.view?.compassVisualCols ?? CARD_VISUAL_COLS_DEFAULT) as number);
    $: compassInfoSideCols = clampCompassInfoSideCols((wheel?.view?.compassInfoSideCols ?? CARD_INFO_SIDE_COLS_DEFAULT) as number);
    $: compassInfoBottomHeight = clampCompassInfoBottomHeight((wheel?.view?.compassInfoBottomHeight ?? CARD_INFO_BOTTOM_HEIGHT_DEFAULT) as number);
    $: visualPaneColsValue = visualPaneCols(compassVisualCols, showDualVisualRow);
    $: desiredCardCols = showInfoSide ? (visualPaneColsValue + compassInfoSideCols) : visualPaneColsValue;
    $: contentLayoutStyle = showInfoSide
        ? (compassInfoPosition === 'left'
            ? `grid-template-columns:minmax(0, ${compassInfoSideCols}fr) minmax(0, ${visualPaneColsValue}fr);`
            : `grid-template-columns:minmax(0, ${visualPaneColsValue}fr) minmax(0, ${compassInfoSideCols}fr);`)
        : '';
    $: controlsPaneMode = showVisualSection ? 'top' : 'side';
    $: systemSideLookerDirection = (() => {
        if (wheel?.wheelType !== 'system') return 'S';
        const looker = asBodyIdOrNull((roles as any)?.looker);
        const focus = asBodyIdOrNull((roles as any)?.focus);
        if (!looker || !focus) return 'S';
        return systemLookerSideDirection(looker, focus, effTs);
    })();

    function toggleVisualSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showVisual: !showVisualSection } },
            'Compass.toggleVisualSection'
        );
    }

    function toggleSecondaryVisualSection() {
        onUserActivity();
        if (!wheelId || !supportsSecondaryVisual) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showSecondaryVisual: !showSecondaryVisualSection } },
            'Compass.toggleSecondaryVisualSection'
        );
    }

    function toggleVisualLayout() {
        onUserActivity();
        if (!wheelId || !supportsSecondaryVisual || !showSecondaryVisualSection) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { visualLayout: showDualVisualRow ? 'column' : 'row' } },
            'Compass.toggleVisualLayout'
        );
    }

    function toggleVisualRowSide() {
        onUserActivity();
        if (!wheelId || !supportsSecondaryVisual || !showDualVisualRow) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { visualRowSide: visualRowSide === 'left' ? 'right' : 'left' } },
            'Compass.toggleVisualRowSide'
        );
    }

    function toggleVisualColumnOrder() {
        onUserActivity();
        if (!wheelId || !supportsSecondaryVisual || showDualVisualRow || !showSecondaryVisualSection) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { visualColumnOrder: visualColumnOrder === 'side-first' ? 'top-first' : 'side-first' } },
            'Compass.toggleVisualColumnOrder'
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

    function setCompassInfoPosition(position: CompassInfoPosition) {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            {
                view: { compassInfoPosition: hasVisualSection ? position : 'bottom' },
                layout: { w: position === 'bottom' ? visualPaneColsValue : (visualPaneColsValue + compassInfoSideCols) }
            },
            'Compass.setInfoPosition'
        );
    }

    $: {
        if (wheelId && hasVisualSection && !paneResizeState) {
            const currentCols = currentLayoutCols();
            if (currentCols !== desiredCardCols) {
                boardApi.updateWheelById(wheelId, { layout: { w: desiredCardCols } }, 'Compass.syncCardCols');
            }
        }
    }

    type CompassInfoChip = {
        id: string;
        label: string;
        value?: string;
        modal?: string;
        emoji?: string;
    };

    type CompassDynamicRow = {
        id: ObjId;
        emoji: string;
        name: string;
        color?: string;
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
    type CompassBodyCurrentHouses = Partial<Record<'compass' | 'horizon' | 'synod' | 'bind' | 'nodal', string>>;

    type CompassBodyRow = {
        id: ObjId;
        emoji: string;
        name: string;
        color?: string;
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
        currentHouses: CompassBodyCurrentHouses;
        bodyInfoItems: CompassInfoChip[];
    };

    type CompassPinnedInfoRow = {
        id: string;
        bodyId: ObjId;
        emoji: string;
        name: string;
        color?: string;
        items: CompassInfoChip[];
        durationItem?: {
            id: string;
            label: string;
            value: string;
            modal?: string;
        };
        nodes: Array<{
            id: string;
            label: string;
            ts: number;
            code: string;
            source: OrbitNodeGroup;
            sourceWheel: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal';
            disabled?: boolean;
        }>;
    };

    type CompassTagScope = 'dynamic' | 'pinned';
    type PinnedEditorGroup = OrbitNodeGroup | 'general';

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
        group?: PinnedEditorGroup;
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
    let dynamicTagConfigById: Map<string, CompassInfoTagConfig> = new Map();
    let pinnedLabelByTagId: Map<string, string> = new Map();
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
    let pinnedAvailableGroups: PinnedEditorGroup[] = ['general', 'regular'];

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

    function handleCompassPinnedPick(
        ts: number,
        bodyId: ObjId,
        code?: string,
        sourceWheel?: 'compass' | 'horizon' | 'synod' | 'bind' | 'nodal'
    ) {
        handleMarkerPick(ts, bodyId, code, sourceWheel);
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

    function sourceWheelsFromSpec(): Array<Exclude<OrbitNodeGroup, 'regular'>> {
        const groups = wheelNodeGroupsFromSpec();
        const order: Array<Exclude<OrbitNodeGroup, 'regular'>> = ['compass', 'horizon', 'nodal', 'synod', 'bind'];
        return order.filter((group) => normalizeSpecNodeGroup(group, groups).length > 0);
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

            const starDefs = starInfoDefsForMetaField(typeof row.metaField === 'string' ? row.metaField : undefined);
            if (starDefs.length > 0) {
                for (const starDef of starDefs) {
                    const starLabel = String(starDef.defaultLabel ?? starDef.label ?? '').trim();
                    if (!starLabel) continue;
                    const starId = `${scope}:${source}:${tagIdFromLabel(starLabel)}`;
                    if (seen.has(starId)) continue;
                    seen.add(starId);
                    out.push({
                        id: starId,
                        label: uiLabel(starLabel),
                        scope,
                        enabledByDefault,
                        modal: typeof starDef.modal === 'string' ? starDef.modal : undefined,
                        source,
                        metaField: typeof starDef.metaField === 'string' ? starDef.metaField : undefined,
                        format: starDef.format,
                        spokes: row.spokes
                    });
                }
            }
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

    function resolvePinnedTechTagLabel(systemLabel: string): string {
        const id = `pinned-node:${tagIdFromLabel(systemLabel)}`;
        const custom = pinnedLabelByTagId.get(id);
        return custom && custom.trim() ? custom.trim() : systemLabel;
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

        // Keep system node tags from spec stable across cycle switches.
        const groups = wheelNodeGroupsFromSpec();
        for (const source of sourceWheelsFromSpec()) {
            const specTags = normalizeSpecNodeGroup(source, groups);
            for (const rawTag of specTags) {
                const tag = String(rawTag ?? '').trim();
                const dashAt = tag.lastIndexOf('-');
                if (dashAt <= 0 || dashAt >= tag.length - 1) continue;
                const spoke = tag.slice(0, dashAt);
                if (!isSpokeCode(spoke)) continue;
                const normalizedSpoke = spoke === 'E+' ? 'E_next' : spoke;
                const label = formatLabelTitleCaseUi(`${formatSpokeCodeUi(normalizedSpoke)}-${source}`);
                const id = `pinned-node:${tagIdFromLabel(label)}`;
                if (byId.has(id)) continue;
                byId.set(id, {
                    ts: Number.POSITIVE_INFINITY,
                    def: {
                        id,
                        label,
                        scope: 'pinned',
                        enabledByDefault: true,
                        group: source
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
        const sourceCode = row.currentHouses[def.source];
        if (!sourceCode || !tagAppliesToCode(def, sourceCode)) return undefined;
        if (!def.metaField) return '';
        const meta = row.infoMeta[def.source] ?? {};
        if (def.metaField === 'distanceAu') {
            const rawValue = Number(meta?.[def.metaField]);
            if (!Number.isFinite(rawValue)) return undefined;
            const isDistPs = tagIdFromLabel(def.label) === 'dist-ps';
            const isDistLy = tagIdFromLabel(def.label) === 'dist-ly';
            const isStar = isReferenceStarDistance(row.id);
            if (isDistPs) {
                return isStar ? tagValueFromMeta(def, meta, sourceCode) : undefined;
            }
            if (isDistLy) {
                return isStar ? tagValueFromMeta(def, meta, sourceCode) : undefined;
            }
            return isStar ? undefined : formatDistAuValue3(rawValue);
        }
        return tagValueFromMeta(def, meta, sourceCode);
    }

    function chipLabelKey(label: string): string {
        return String(label ?? '').trim().toLowerCase();
    }

    function chipHasValue(value: string | undefined): boolean {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function mergePinnedBodyItems(dynamicItems: CompassInfoChip[], bodyItems: CompassInfoChip[]): CompassInfoChip[] {
        const out: CompassInfoChip[] = [];
        const seen = new Map<string, number>();

        const pushChip = (chip: CompassInfoChip) => {
            const key = chipLabelKey(chip.label);
            const hitIdx = seen.get(key);
            if (hitIdx == null) {
                seen.set(key, out.length);
                out.push(chip);
                return;
            }
            const prev = out[hitIdx];
            if (!chipHasValue(prev.value) && chipHasValue(chip.value)) {
                out[hitIdx] = chip;
            }
        };

        for (const chip of dynamicItems) pushChip(chip);
        for (const chip of bodyItems) pushChip(chip);
        return out;
    }

    function groupEnabledByNodeToggles(group: OrbitNodeGroup): boolean {
        return showOrbitNodesAny && isOrbitNodeGroupVisible(group);
    }

    const PINNED_DURATION_TAG_ID = 'pinned:duration';

    function buildPinnedMetaDefs(): CompassTagDef[] {
        return [
            {
                id: PINNED_DURATION_TAG_ID,
                label: 'Cycle',
                scope: 'pinned',
                enabledByDefault: true,
                group: 'general'
            }
        ];
    }

    function pinnedGroupFromNode(node: OrbitNodeUi): OrbitNodeGroup {
        return orbitNodeGroup(node);
    }

    $: compassHouseDefs = buildHouseDefsForWheel(spec);
    $: pinnedAvailableGroups = (() => {
        const out: PinnedEditorGroup[] = ['general', 'regular'];
        for (const group of sourceWheelsFromSpec()) out.push(group);
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
        const pinnedMetaDefs = buildPinnedMetaDefs();
        return [
            ...dynamicDefs,
            ...pinnedMetaDefs,
            ...pinnedDefs
        ] satisfies CompassTagDef[];
    })();
    $: compassTagDefById = new Map(compassTagDefs.map((d) => [d.id, d]));
    $: dynamicTagConfigById = new Map(
        (compassInfoConfig?.dynamic?.tags ?? [])
            .map((t) => [t.id, t] as const)
    );
    $: pinnedLabelByTagId = new Map(
        (compassInfoConfig?.pinned?.tags ?? [])
            .map((t) => [t.id, String(t.label ?? '').trim()] as const)
            .filter((entry) => entry[1].length > 0)
    );

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
                value: (t.value && t.value.trim()) ? t.value.trim() : undefined,
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
                color: b.color,
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
        const pinnedTagConfigById = new Map(compassInfoConfig.pinned.tags.map((t) => [t.id, t]));
        const body = allBodies.find((b) => b.id === pinnedBodyId);
        const bodyItems = body?.bodyInfoItems ?? [];
        const dynamicItems = compassDynamicRows.find((row) => row.id === pinnedBodyId)?.items ?? [];
        const pinnedItems = mergePinnedBodyItems(dynamicItems, bodyItems);
        const mainCycle = mainCycleSourceForActiveWheel();
        const durationItem = (() => {
            if (!mainCycle) return undefined;
            const mainCycleSpokes = windowRows
                .filter((row) => row.sourceWheel === mainCycle)
                .map((row) => ({ ts: row.ts, code: row.code }));
            const value = formatCycleDurationFromSpokes(mainCycleSpokes);
            if (!value) return undefined;
            const cfg = pinnedTagConfigById.get(PINNED_DURATION_TAG_ID);
            if (cfg?.enabled === false) return undefined;
            const def = compassTagDefById.get(PINNED_DURATION_TAG_ID);
            const label = (cfg?.label && cfg.label.trim())
                ? cfg.label.trim()
                : (def?.label ?? 'Cycle');
            const modal = (cfg?.modal && cfg.modal.trim())
                ? cfg.modal.trim()
                : (typeof def?.modal === 'string' ? def.modal : undefined);
            return {
                id: PINNED_DURATION_TAG_ID,
                label,
                value,
                modal
            };
        })();
        const nodes: CompassPinnedInfoRow['nodes'] = windowRows
            .flatMap((row) => {
                const id = `pinned-node:${tagIdFromLabel(row.techName)}`;
                const cfg = pinnedTagConfigById.get(id);
                if (cfg && cfg.enabled === false) return [];
                const label = (cfg?.label && cfg.label.trim()) ? cfg.label.trim() : row.techName;
                return [{
                    id,
                    label,
                    ts: row.ts,
                    code: row.code,
                    source: row.source,
                    sourceWheel: row.sourceWheel,
                    disabled: activeOverlappedRowIds.has(row.id)
                }];
            });

        out.push({
            id: `pinned:${pinnedBodyId}`,
            bodyId: pinnedBodyId,
            emoji: body?.emoji ?? '•',
            name: body?.name ?? String(pinnedBodyId),
            color: body?.color,
            items: pinnedItems,
            durationItem,
            nodes
        });
        return out;
    })();

</script>

<section class="panel" bind:this={panelEl}>
    <WheelHeader
            wheel={wheel}
            onDocs={docs.openDocs}
            onClose={closeCompass}
            dragEnabled={dragEnabled}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
            visualOpen={showVisualSection}
            secondaryVisualAvailable={supportsSecondaryVisual}
            secondaryVisualOpen={showSecondaryVisualSection}
            infoOpen={showInfoSection}
            pickersOpen={showPickersSection}
            profileLocked={$isActiveProfileLocked}
            onToggleVisual={toggleVisualSection}
            onToggleSecondaryVisual={toggleSecondaryVisualSection}
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

    {#if hasVisualSection || showInfoSection}
        <div class="sectionSep" aria-hidden="true"></div>
    {/if}

    {#if hasVisualSection || showInfoSection}
        <div
            class="contentLayout"
            class:infoSide={showInfoSide}
            class:infoLeft={showInfoSide && compassInfoPosition === 'left'}
            style={contentLayoutStyle}
            transition:slide|local
        >
        <!-- WHEEL SVG -->
        {#if hasVisualSection}
            <div class="visualPane" bind:this={visualPaneEl}>
                <div class="wrap" bind:this={wrapEl}>
                    <section class="wheelPanel" class:twoPaneRow={showDualVisualRow}>
            {#if supportsSecondaryVisual && showSecondaryVisualSection}
                <div class="visualLayoutBar">
                    <button
                            class="nodeToggle navBtn sideBySideToggle"
                            type="button"
                            title={showDualVisualRow ? 'Stack views vertically' : 'Show both views side by side'}
                            aria-label={showDualVisualRow ? 'Stack views vertically' : 'Show both views side by side'}
                            on:click={toggleVisualLayout}
                    >
                        {showDualVisualRow ? '↕' : '↔'}
                    </button>
                    {#if showDualVisualRow}
                        <button
                                class="nodeToggle navBtn"
                                type="button"
                                title={visualRowSide === 'left' ? 'Move side view to the right' : 'Move side view to the left'}
                                aria-label={visualRowSide === 'left' ? 'Move side view to the right' : 'Move side view to the left'}
                                on:click={toggleVisualRowSide}
                        >
                            {visualRowSide === 'left' ? '⇢' : '⇠'}
                        </button>
                    {:else}
                        <button
                                class="nodeToggle navBtn"
                                type="button"
                                title={visualColumnOrder === 'side-first' ? 'Move top view above side view' : 'Move side view above top view'}
                                aria-label={visualColumnOrder === 'side-first' ? 'Move top view above side view' : 'Move side view above top view'}
                                on:click={toggleVisualColumnOrder}
                        >
                            {visualColumnOrder === 'side-first' ? '⇣' : '⇡'}
                        </button>
                    {/if}
                </div>
            {/if}
            {#if showVisualSection}
            <div
                class="wheelBox"
                class:rowSecond={showDualVisualRow && visualRowSide === 'left'}
                class:columnSecond={!showDualVisualRow && visualColumnOrder === 'side-first'}
            >
                <div class="phoneSwipeZone" data-phone-swipe-zone="1" aria-hidden="true"></div>
                <svg bind:this={primarySvgEl} width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}
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

                    {#if liveNorthEnabled && Number.isFinite(liveNorthHeadingDeg)}
                        <g
                                class="liveNorthArrow"
                                transform={`rotate(${-Number(liveNorthHeadingDeg)} ${cx} ${cy})`}
                                aria-hidden="true"
                        >
                            <line
                                    class="liveNorthArrowShaft"
                                    x1={cx}
                                    y1={cy + (rOuter * 0.08)}
                                    x2={cx}
                                    y2={cy - (rOuter * 0.74)}
                            />
                            <path
                                    class="liveNorthArrowHead"
                                    d={`M ${cx} ${cy - (rOuter * 0.93)} L ${cx - (rOuter * 0.055)} ${cy - (rOuter * 0.78)} L ${cx + (rOuter * 0.055)} ${cy - (rOuter * 0.78)} Z`}
                            />
                            <text
                                    class="liveNorthArrowLabel"
                                    x={cx}
                                    y={cy - (rOuter * 0.64)}
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                            >
                                N
                            </text>
                        </g>
                    {/if}

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

                    {#if wheel?.wheelType === 'compass' && showConstellationBoundaries}
                        {#each constellationBoundaryCurves as c (`constellation-boundary:${c.id}:${c.seg}`)}
                            <path class="constellationBoundaryCurve" d={c.d} data-keep-pin="1">
                                <title>{c.title}</title>
                            </path>
                        {/each}
                    {/if}

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
                                on:click={(e) => handleHouseTap(e, houseTip, label)}
                                on:dblclick={() => handleSpokeDoubleClick(label)}
                                on:contextmenu={(e) => handleHouseLongPress(e, houseTip)}
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

                    {#if wheel?.wheelType === 'compass' && showAstroFrame}
                        {#each astroFrameCurves as c (`astro-frame:${c.id}:${c.seg}`)}
                            <path
                                    class={`astroFrameCurve astroFrameCurve-${c.id}`}
                                    d={c.d}
                                    data-keep-pin="1"
                            />
                        {/each}

                        {#each astroFrameNodes as n (`astro-node:${n.id}`)}
                            {@const nodeKey = `astro-node:${n.id}`}
                            <g
                                    class={`astroFrameNode astroFrameNode-${n.kind}`}
                                    data-keep-pin="1"
                                    role="img"
                                    aria-label={n.tip.label}
                                    style={n.node.color ? `color:${n.node.color}` : undefined}
                                    on:mouseenter={(e) => tip.hoverMomentEnter(e, n.tip, nodeKey)}
                                    on:mouseleave={() => tip.hoverLeave(nodeKey)}
                            >
                                <circle class="astroFrameNodeHit" cx={n.x} cy={n.y} r={VB * 0.018} />
                                {#if n.kind === 'intersection'}
                                    <circle class="astroFrameIntersectionDot" cx={n.x} cy={n.y} r={VB * 0.005} />
                                {:else}
                                    <circle class="astroFramePoleRing" cx={n.x} cy={n.y} r={VB * 0.014} />
                                    <text
                                            class="astroFramePoleEmoji"
                                            x={n.x}
                                            y={n.y}
                                            text-anchor="middle"
                                            dominant-baseline="middle"
                                    >
                                        {n.node.emoji}
                                    </text>
                                {/if}
                            </g>
                        {/each}
                    {/if}

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
                                        on:click={(e) => handleOrbitNodeTap(e, n)}
                                        on:dblclick={(e) => {
                                            if ((n.tip.pickTsList?.length ?? 0) > 1) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMarkerPick(n.tip.ts, n.bodyId, n.code, n.sourceWheel);
                                        }}
                                        on:contextmenu={(e) => handleOrbitNodeLongPress(e, n.tip)}
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
                        {@const singleId = clusterSingleBodyId(c)}
                        {@const singleItem = c.count === 1 ? c.items[0] : null}
                        {@const isReference = !!singleId && (objects?.[singleId]?.kind === 'reference' || objects?.[singleId]?.kind === 'star' || objects?.[singleId]?.kind === 'pole')}
                        {@const glyphColor = !isCluster && c.color ? c.color : 'currentColor'}
                        {@const glyphRotateDeg = (!isCluster && singleItem && Number.isFinite(singleItem.emojiRotationDeg)) ? Number(singleItem.emojiRotationDeg) : 0}
                        {@const o = c.opacity ?? 1}

                        <g class="marker"
                           role="button"
                           tabindex="0"
                           class:pinnedMark={clusterContainsPinned(c)}
                           data-marker="1"
                           transform={`translate(${p.x} ${p.y})`}
                           style={`opacity:${c.opacity ?? 1}`}
                           on:click={(e) => handleClusterTap(e, c)}
                           on:contextmenu={(e) => handleClusterLongPress(e, c)}
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
                            <g class="markerBody">
                                <circle r={markerSizes.hit} fill="transparent" />
                                {#if isCluster || singleId === pinnedBodyId}
                                    <circle
                                            r={markerSizes.ring}
                                            fill="transparent"
                                            stroke="currentColor"
                                            stroke-opacity={isCluster ? 0.2 : 0.1}
                                            stroke-width={isCluster ? 0.5 : 0.3}/>
                                {/if}
                                <text
                                        class="markerGlyph useObjectColor"
                                        text-anchor="middle"
                                        dominant-baseline="middle"
                                        font-size={isCluster
                                            ? markerSizes.fontCluster
                                            : (isReference ? markerSizes.fontReference : markerSizes.fontSingle) * (singleId ? resolveBodyEmojiScale(singleId) : DEFAULT_EMOJI_SCALE)}
                                        font-weight={isCluster ? 900 : 850}
                                        letter-spacing={c.count === 1 ? 0 : 0.6}
                                        fill={glyphColor}
                                        fill-opacity={Math.max(0.92, o)}
                                        stroke={glyphColor}
                                        stroke-opacity={isCluster ? 0.2 : 0.4}
                                        stroke-width={isCluster ? 1.5 : 1}
                                        transform={glyphRotateDeg ? `rotate(${glyphRotateDeg})` : undefined}
                                        style="pointer-events:none"
                                >
                                    {c.count === 1 ? c.emoji : c.label}
                                </text>
                            </g>
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
                    {#if !hideZenithTop}
                        <circle cx={cx} cy={cy} r={VB * 0.003} class="zenith" />
                    {/if}
                </svg>

                {#if controlsPaneMode === 'top'}
                <div class="compassNav">
                    {#if wheel?.wheelType === 'compass' && liveNorthSupported}
                        <button
                                class="nodeToggle navBtn trueNorthToggle"
                                class:off={!liveNorthEnabled}
                                type="button"
                                title={liveNorthButtonTitle}
                                aria-label={liveNorthButtonTitle}
                                aria-pressed={liveNorthEnabled}
                                on:click={toggleLiveNorth}
                        >
                            N
                        </button>
                    {/if}
                    {#if wheel?.wheelType === 'compass'}
                        <button
                                class="nodeToggle navBtn astroFrameToggle"
                                class:off={!showAstroFrame}
                                type="button"
                                title={showAstroFrame ? 'Hide Astro Frame' : 'Show Astro Frame'}
                                aria-label={showAstroFrame ? 'Hide Astro Frame' : 'Show Astro Frame'}
                                aria-pressed={showAstroFrame}
                                on:click={toggleAstroFrame}
                        >
                            AF
                        </button>
                        <button
                                class="nodeToggle navBtn constellationBoundaryToggle"
                                class:off={!showConstellationBoundaries}
                                type="button"
                                title={showConstellationBoundaries ? 'Hide constellation boundaries' : 'Show constellation boundaries'}
                                aria-label={showConstellationBoundaries ? 'Hide constellation boundaries' : 'Show constellation boundaries'}
                                aria-pressed={showConstellationBoundaries}
                                on:click={toggleConstellationBoundaries}
                        >
                            CB
                        </button>
                    {/if}
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

                    {#if hasPinnedAnyOrbitNodes}
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
                <div class="compassNav compassNavTopLeft">
                    <button
                            class="markerScaleBtn navBtn"
                            type="button"
                            title="Marker size -"
                            aria-label="Marker size -"
                            on:click={decMarkerScale}
                            disabled={$isActiveProfileLocked}
                    >
                        −
                    </button>
                    <button
                            class="markerScaleBtn navBtn"
                            type="button"
                            title="Marker size +"
                            aria-label="Marker size +"
                            on:click={incMarkerScale}
                            disabled={$isActiveProfileLocked}
                    >
                        +
                    </button>
                </div>
                {/if}

                {#if hasPinnedAnyOrbitNodes && controlsPaneMode === 'top'}
                    {#if wheel?.wheelType === 'compass'}
                        <div class="nodeNav nodeNavCompass">
                            <button
                                    class="nodeToggle navBtn nodeRegular nodeRegularTopRight"
                                    class:off={!orbitNodeGroupVisible.regular}
                                    type="button"
                                    title="Toggle regular nodes"
                                    aria-label="Toggle regular nodes"
                                    aria-pressed={orbitNodeGroupVisible.regular}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('regular')}
                            >
                                .
                            </button>
                            <button
                                    class="nodeToggle navBtn nodeHorizon nodeHorizonBottomLeft"
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
                                    class="nodeToggle navBtn nodeCompass nodeCompassBottomRight"
                                    class:off={!orbitNodeGroupVisible.compass}
                                    type="button"
                                    title="Toggle compass nodes"
                                    aria-label="Toggle compass nodes"
                                    aria-pressed={orbitNodeGroupVisible.compass}
                                    on:click|stopPropagation={() => toggleOrbitNodeGroup('compass')}
                            >
                                C
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
            {/if}

            {#if showSecondaryVisualSection}
                <div
                    class="wheelBox wheelBoxSide"
                    class:rowFirst={showDualVisualRow && visualRowSide === 'left'}
                    class:columnFirst={!showDualVisualRow && visualColumnOrder === 'side-first'}
                >
                    <svg bind:this={secondarySvgEl} width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}
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
                         aria-label="System Side View">
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
                            {@const houseKey = `side-house:${label}`}
                            {@const labelEmoji = sideEmojiAtLabel(label)}
                            {@const spokeEmoji = sideEmojiAtSpoke(label)}

                            <g
                                    class="spoke"
                                    class:hot={activeSpokeCode === label}
                                    data-keep-pin="1"
                                    role="button"
                                    tabindex="0"
                                    aria-label={`House ${label}`}
                                    on:click={(e) => handleHouseTap(e, houseTip, label)}
                                    on:dblclick={() => handleSpokeDoubleClick(label)}
                                    on:contextmenu={(e) => handleHouseLongPress(e, houseTip)}
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
                                            x={pt.x}
                                            y={pt.y}
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

                        {#each sideOrbitCurves as c (`side-orbit:${c.id}:${c.seg}`)}
                            {#if showOrbits || pinnedBodyId === c.id}
                                <path
                                        class="orbitCurve orbitCurveSide"
                                        class:dim={!c.visible}
                                        class:pinnedCurve={pinnedBodyId === c.id}
                                        d={c.d}
                                />
                            {/if}
                        {/each}

                        {#if pinnedBodyId}
                            {#each orbitNodesSideVisible as n (n.key)}
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
                                            on:click={(e) => handleOrbitNodeTap(e, n)}
                                            on:dblclick={(e) => {
                                                if ((n.tip.pickTsList?.length ?? 0) > 1) return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleMarkerPick(n.tip.ts, n.bodyId, n.code, n.sourceWheel);
                                            }}
                                            on:contextmenu={(e) => handleOrbitNodeLongPress(e, n.tip)}
                                            on:mouseenter={(e) => {
                                                activateSpokeFromOrbitNode(n);
                                                tip.hoverMomentEnter(e, n.tip, `${n.key}:side`);
                                            }}
                                            on:mouseleave={() => {
                                                clearActiveSpoke();
                                                tip.hoverLeave(`${n.key}:side`);
                                            }}
                                            on:focus={() => activateSpokeFromOrbitNode(n)}
                                            on:blur={clearActiveSpoke}
                                            on:keydown={(e) => handleOrbitNodeKeydown(e, n.tip)}
                                    />
                                {/if}
                            {/each}
                        {/if}

                        {#each sideMarkerClusters as c (c.id)}
                            {@const markerKey = `side-marker:${c.id}`}
                            {@const isCluster = c.count > 1}
                            {@const singleId = clusterSingleBodyId(c)}
                            {@const singleItem = c.count === 1 ? c.items[0] : null}
                            {@const isReference = !!singleId && (objects?.[singleId]?.kind === 'reference' || objects?.[singleId]?.kind === 'star' || objects?.[singleId]?.kind === 'pole')}
                            {@const glyphColor = !isCluster && c.color ? c.color : 'currentColor'}
                            {@const glyphRotateDeg = (!isCluster && singleItem && Number.isFinite(singleItem.emojiRotationDeg)) ? Number(singleItem.emojiRotationDeg) : 0}
                            {@const o = c.opacity ?? 1}

                            <g class="marker"
                               role="button"
                               tabindex="0"
                               class:pinnedMark={clusterContainsPinned(c)}
                               data-marker="1"
                               transform={`translate(${c.x} ${c.y})`}
                               style={`opacity:${c.opacity ?? 1}`}
                               on:click={(e) => handleClusterTap(e, c)}
                               on:contextmenu={(e) => handleClusterLongPress(e, c)}
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
                                <g class="markerBody">
                                    <circle r={markerSizes.hit} fill="transparent" />
                                    {#if isCluster || singleId === pinnedBodyId}
                                        <circle
                                                r={markerSizes.ring}
                                                fill="transparent"
                                                stroke="currentColor"
                                                stroke-opacity={isCluster ? 0.2 : 0.1}
                                                stroke-width={isCluster ? 0.5 : 0.3}/>
                                    {/if}
                                    <text
                                            class="markerGlyph useObjectColor"
                                            text-anchor="middle"
                                            dominant-baseline="middle"
                                            font-size={isCluster
                                                ? markerSizes.fontCluster
                                                : (isReference ? markerSizes.fontReference : markerSizes.fontSingle) * (singleId ? resolveBodyEmojiScale(singleId) : DEFAULT_EMOJI_SCALE)}
                                            font-weight={isCluster ? 900 : 850}
                                            letter-spacing={c.count === 1 ? 0 : 0.6}
                                            fill={glyphColor}
                                            fill-opacity={Math.max(0.92, o)}
                                            stroke={glyphColor}
                                            stroke-opacity={isCluster ? 0.2 : 0.4}
                                            stroke-width={isCluster ? 1.5 : 1}
                                            transform={glyphRotateDeg ? `rotate(${glyphRotateDeg})` : undefined}
                                            style="pointer-events:none"
                                    >
                                        {c.count === 1 ? c.emoji : c.label}
                                    </text>
                                </g>
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
                        {#if !hideZenithSide}
                            <circle cx={cx} cy={cy} r={VB * 0.003} class="zenith" />
                        {/if}
                    </svg>

                    {#if controlsPaneMode === 'side'}
                        <div class="compassNav">
                            {#if wheel?.wheelType === 'compass'}
                                <button
                                        class="nodeToggle navBtn constellationBoundaryToggle"
                                        class:off={!showConstellationBoundaries}
                                        type="button"
                                        title={showConstellationBoundaries ? 'Hide constellation boundaries' : 'Show constellation boundaries'}
                                        aria-label={showConstellationBoundaries ? 'Hide constellation boundaries' : 'Show constellation boundaries'}
                                        aria-pressed={showConstellationBoundaries}
                                        on:click={toggleConstellationBoundaries}
                                >
                                    CB
                                </button>
                            {/if}
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

                            {#if hasPinnedAnyOrbitNodes}
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
                        <div class="compassNav compassNavTopLeft">
                            <button
                                    class="markerScaleBtn navBtn"
                                    type="button"
                                    title="Marker size -"
                                    aria-label="Marker size -"
                                    on:click={decMarkerScale}
                                    disabled={$isActiveProfileLocked}
                            >
                                −
                            </button>
                            <button
                                    class="markerScaleBtn navBtn"
                                    type="button"
                                    title="Marker size +"
                                    aria-label="Marker size +"
                                    on:click={incMarkerScale}
                                    disabled={$isActiveProfileLocked}
                            >
                                +
                            </button>
                        </div>
                        {#if hasPinnedAnyOrbitNodes}
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
                            </div>
                        {/if}
                    {/if}
                </div>
            {/if}

            {#if $tipState.open && ($tipState.cluster || $tipState.moment)}
                <CompassTooltip
                        x={$tipState.x}
                        y={$tipState.y}
                        cluster={$tipState.cluster}
                        moment={$tipState.moment}
                        allBodies={allBodies}
                        dynamicRows={compassDynamicRows}
                        dynamicDisabledIds={compassDynamicDisabledIds}
                        separatorLabel={tooltipSeparatorLabel}
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
                <button
                    type="button"
                    class="paneResizeHandle visualResizeHandle"
                    aria-label="Resize visual block"
                    title="Resize visual block"
                    on:pointerdown={startVisualResize}
                ></button>
            </div>
        {/if}

        <!-- INFO -->
        {#if showInfoSection}
            <div
                class="infoPane"
                class:side={showInfoSide}
                style={`${showInfoSide && visualPaneHeight > 0 ? `--compass-info-pane-height:${visualPaneHeight}px;` : ''}${!showInfoSide ? `--compass-info-bottom-height:${compassInfoBottomHeight}px;` : ''}`}
            >
                {#if showInfoWidthResizeHandle}
                    <button
                        type="button"
                        class="paneResizeHandle infoResizeHandle"
                        class:leftEdge={compassInfoPosition === 'left'}
                        class:rightEdge={compassInfoPosition === 'right'}
                        aria-label="Resize info block width"
                        title="Resize info block width"
                        on:pointerdown={startInfoWidthResize}
                    ></button>
                {/if}
                {#if showInfoHeightResizeHandle}
                    <button
                        type="button"
                        class="paneResizeHandle infoBottomResizeHandle"
                        aria-label="Resize info block height"
                        title="Resize info block height"
                        on:pointerdown={startInfoBottomHeightResize}
                    ></button>
                {/if}
                <CompassInfoBlock
                        config={compassInfoConfig}
                        tagDefs={compassTagDefs}
                        houseDefs={compassHouseDefs}
                        pinnedAvailableGroups={pinnedAvailableGroups}
                        generalChips={compassGeneralChips}
                        errorReason={solveReason}
                        dynamicRows={compassDynamicRows}
                        pinnedRows={compassPinnedRows}
                        referenceTs={localLiveNowTs}
                        onBodyPick={handleCompassBodyPick}
                        onPinnedPick={handleCompassPinnedPick}
                        onEditPinnedBody={openPinnedBodyEditor}
                        onConfigure={applyCompassInfoConfig}
                        locked={$isActiveProfileLocked}
                        canPlaceSide={hasVisualSection}
                        layoutPosition={compassInfoPosition}
                        onMoveLeft={() => setCompassInfoPosition('left')}
                        onMoveRight={() => setCompassInfoPosition('right')}
                        onMoveBottom={() => setCompassInfoPosition('bottom')}
                />
            </div>
        {/if}
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

<BodyInfoEditor
        open={!!editingBodyId}
        bodyId={editingBodyId}
        locked={$isActiveProfileLocked}
        onClose={closePinnedBodyEditor}
/>

<style>
    .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: var(--radius-18);
        padding: var(--sp-12);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
        position: relative;
    }
    .contentLayout {
        display: grid;
        gap: var(--sp-12);
        min-height: 0;
        align-items: start;
    }
    .contentLayout.infoSide {
        align-items: stretch;
    }
    .visualPane {
        position: relative;
        min-width: 0;
        min-height: 0;
        display: grid;
        align-self: start;
        width: 100%;
    }
    .wrap {
        width: 100%;
        max-width: 100%;
        flex: 0 0 auto;
        min-height: 0;
        padding-block: 10px;
        box-sizing: border-box;
        margin-inline: auto;
    }
    .infoPane {
        min-width: 0;
        min-height: 0;
        height: var(--compass-info-bottom-height, 420px);
        display: grid;
        overflow: visible;
        position: relative;
        border-radius: var(--radius-16);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        padding: var(--sp-10) var(--sp-10) var(--sp-18);
        box-sizing: border-box;
    }
    .infoPane.side {
        height: var(--compass-info-pane-height, auto);
        max-height: var(--compass-info-pane-height, none);
        align-self: start;
        width: 100%;
        max-width: 100%;
        padding-left: var(--sp-10);
        padding-right: var(--sp-10);
    }
    .contentLayout.infoSide .visualPane {
        order: 1;
    }
    .contentLayout.infoSide .infoPane.side {
        order: 2;
    }
    .contentLayout.infoSide.infoLeft .infoPane.side {
        order: 1;
    }
    .contentLayout.infoSide.infoLeft .visualPane {
        order: 2;
    }
    .paneResizeHandle {
        position: absolute;
        z-index: 5;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--fg), transparent 78%);
        padding: 0;
        touch-action: none;
        pointer-events: auto;
    }
    .paneResizeHandle:hover {
        background: color-mix(in oklab, var(--fg), transparent 66%);
    }
    .visualResizeHandle {
        right: 10px;
        bottom: 10px;
        width: 14px;
        height: 14px;
        border-radius: var(--radius-4);
        cursor: nwse-resize;
    }
    .infoResizeHandle {
        top: 50%;
        width: 14px;
        height: 96px;
        border-radius: var(--radius-pill);
        cursor: ew-resize;
        transform: translateY(-50%);
        border-color: color-mix(in oklab, var(--fg), transparent 58%);
        background: color-mix(in oklab, var(--panel), var(--fg) 10%);
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--fg), transparent 82%),
            0 6px 20px color-mix(in oklab, black, transparent 78%);
    }
    .infoResizeHandle.leftEdge {
        right: -7px;
        left: auto;
    }
    .infoResizeHandle.rightEdge {
        right: -7px;
        left: auto;
    }
    .infoResizeHandle::before {
        content: '';
        position: absolute;
        inset: 14px 4px;
        border-radius: var(--radius-pill);
        background:
            repeating-linear-gradient(
                to bottom,
                color-mix(in oklab, var(--fg), transparent 14%) 0 6px,
                transparent 6px 12px
            );
        opacity: 0.9;
    }
    .infoBottomResizeHandle {
        left: 50%;
        bottom: -7px;
        width: 96px;
        height: 14px;
        border-radius: var(--radius-pill);
        cursor: ns-resize;
        transform: translateX(-50%);
        border-color: color-mix(in oklab, var(--fg), transparent 58%);
        background: color-mix(in oklab, var(--panel), var(--fg) 10%);
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--fg), transparent 82%),
            0 6px 20px color-mix(in oklab, black, transparent 78%);
    }
    .infoBottomResizeHandle::before {
        content: '';
        position: absolute;
        inset: 4px 14px;
        border-radius: var(--radius-pill);
        background:
            repeating-linear-gradient(
                to right,
                color-mix(in oklab, var(--fg), transparent 14%) 0 6px,
                transparent 6px 12px
            );
        opacity: 0.9;
    }
    .headerBottom {
        display: grid;
        gap: var(--sp-6);
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
        gap: var(--sp-10);
        width: 100%;
        justify-items: center;
        padding-inline: 8px;
        box-sizing: border-box;
    }
    .visualLayoutBar {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-6);
    }
    .wheelPanel.twoPaneRow {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
    }
    .wheelBox { width: 100%; aspect-ratio: 1 / 1; display: grid; place-items: stretch; overflow: visible; position: relative; min-width: 0; }
    .wheelBox.rowFirst {
        order: 1;
    }
    .wheelBox.rowSecond {
        order: 2;
    }
    .wheelBox.columnFirst {
        order: 1;
    }
    .wheelBox.columnSecond {
        order: 2;
    }
    .wheelPanel.twoPaneRow .visualLayoutBar {
        grid-column: 1 / -1;
    }
    .wheelBox svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
        position: relative;
        z-index: 1;
    }
    .phoneSwipeZone {
        display: none;
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
        font-size: var(--fs-18);
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: var(--sp-2);
        margin-top: auto;   /* вот это магия “прилипни вниз” */
        min-height: 0;
        overflow: auto;
    }
    .infoRow { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--sp-10); padding: var(--sp-4) var(--sp-6); border-radius: var(--radius-10); }

    .infoRow{
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 90%);
    }

    .horizon { stroke: currentColor; stroke-opacity: 0.28; stroke-width: 6; }
    .zenith { fill: currentColor; opacity: 0.85; }
    .sideAxis {
        stroke: currentColor;
        stroke-opacity: 0.34;
        stroke-width: 5;
        stroke-linecap: round;
    }
    .sideAxisVertical {
        stroke-opacity: 0.28;
    }
    .sideLabel {
        fill: currentColor;
        fill-opacity: 0.72;
        font-size: var(--fs-28);
        font-weight: 700;
        user-select: none;
        pointer-events: none;
    }

    .marker { cursor: pointer; }
    .marker .markerBody {
        transform-box: fill-box;
        transform-origin: center;
    }
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
        gap: var(--sp-14);
    }

    .pE{ font-size: var(--fs-20); width:24px; text-align:center; }
    .pN{ font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pH{ font-weight:900; opacity:0.9; padding:var(--sp-2) var(--sp-8); border-radius:var(--radius-10);
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
    @media (max-width: 1100px) {
        .contentLayout.infoSide,
        .contentLayout.infoSide.infoLeft {
            grid-template-columns: 1fr;
        }
        .contentLayout.infoSide.infoLeft .infoPane {
            order: 1;
        }
        .contentLayout.infoSide.infoLeft .visualPane {
            order: 2;
        }
        .contentLayout.infoSide .infoPane.side {
            height: clamp(320px, 48vh, 460px);
            max-height: none;
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
        font-size: var(--fs-40);
        font-weight: 400;
    }
    .roleEmojiOnLabel {
        font-size: var(--fs-62);
        font-weight: 900;
    }
    .roleEmojiOnSpoke {
        font-size: var(--fs-34);
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
    .markerScaleBtn {
        width: var(--wheel-overlay-btn-size-sm, 30px);
        height: var(--wheel-overlay-btn-size-sm, 30px);
        padding: 0;
        border-radius: var(--radius-9);
        font-weight: 900;
        line-height: 1;
    }
    :global([data-theme="light"]) .markerGlyph.useObjectColor {
        fill: currentColor !important;
        stroke: currentColor !important;
    }
    .compassNav {
        position: absolute;
        top: 4px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: var(--sp-8);
        align-items: end;
        z-index: 3;
        pointer-events: auto;
    }
    .wheelBox .compassNav.compassNavTopLeft {
        left: 0;
        right: auto;
        top: 4px;
        flex-direction: row;
        gap: var(--sp-6);
        align-items: flex-start;
    }
    .nodeNav {
        position: absolute;
        right: 0;
        bottom: 18px;
        display: grid;
        grid-template-columns: repeat(2, var(--wheel-overlay-btn-size-sm, 30px));
        gap: var(--sp-6);
        z-index: 3;
        pointer-events: auto;
    }
    .nodeNavCompass {
        right: -2px;
        bottom: 20px;
    }
    .nodeNavCompass .nodeRegularTopRight {
        grid-column: 2;
        grid-row: 1;
    }
    .nodeNavCompass .nodeHorizonBottomLeft {
        grid-column: 1;
        grid-row: 2;
    }
    .nodeNavCompass .nodeCompassBottomRight {
        grid-column: 2;
        grid-row: 2;
    }
    .orbitToggle {
        width: var(--wheel-overlay-btn-size-lg, 34px);
        height: var(--wheel-overlay-btn-size-lg, 34px);
        font-size: var(--fs-17);
        line-height: 1;
    }
    .orbitToggle.off {
        opacity: 0.5;
    }
    .nodeToggle {
        width: var(--wheel-overlay-btn-size-sm, 30px);
        height: var(--wheel-overlay-btn-size-sm, 30px);
        font-size: var(--fs-13);
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
    .nodeToggle.trueNorthToggle {
        color: color-mix(in oklab, var(--accent-red), white 10%);
        font-weight: 900;
    }
    .nodeToggle.astroFrameToggle {
        color: color-mix(in oklab, #7bdff2, white 8%);
    }
    .nodeToggle.constellationBoundaryToggle {
        color: color-mix(in oklab, #9ad18f, white 10%);
    }
    .liveNorthArrow {
        pointer-events: none;
    }
    .liveNorthArrowShaft {
        stroke: color-mix(in oklab, var(--accent-red), white 18%);
        stroke-width: 5;
        stroke-linecap: round;
        opacity: 0.92;
    }
    .liveNorthArrowHead {
        fill: color-mix(in oklab, var(--accent-red), white 14%);
        opacity: 0.96;
    }
    .liveNorthArrowLabel {
        fill: color-mix(in oklab, var(--accent-red), white 14%);
        font-size: calc(var(--fs-14) * 1.15);
        font-weight: 900;
        letter-spacing: 0.02em;
    }
    .astroFrameCurve {
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-opacity: 0.35;
        pointer-events: none;
    }
    .astroFrameCurve.astroFrameCurve-equator {
        stroke: #4cc9f0;
    }
    .astroFrameCurve.astroFrameCurve-ecliptic {
        stroke: #d4af37;
        stroke-dasharray: 9 7;
    }
    .astroFrameCurve.dim {
        stroke-opacity: 0.18;
    }
    .constellationBoundaryCurve {
        fill: none;
        stroke: color-mix(in oklab, #9ad18f, white 8%);
        stroke-width: 1.25;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-opacity: 0.34;
        pointer-events: none;
    }
    .astroFrameNode {
        cursor: pointer;
    }
    .astroFrameNodeHit {
        fill: transparent;
    }
    .astroFrameIntersectionDot {
        fill: color-mix(in oklab, #fff, currentColor 18%);
        stroke: currentColor;
        stroke-width: 1.5;
        opacity: 0.9;
    }
    .astroFramePoleEmoji {
        font-size: var(--fs-23);
        font-weight: 800;
        fill: currentColor;
        opacity: 0.9;
        user-select: none;
        pointer-events: none;
    }
    .astroFramePoleRing {
        fill: transparent;
        stroke: currentColor;
        stroke-width: 1.6;
        opacity: 0.9;
    }
    .astroFrameNode.dim .astroFrameIntersectionDot,
    .astroFrameNode.dim .astroFramePoleEmoji,
    .astroFrameNode.dim .astroFramePoleRing {
        opacity: 0.6;
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
    .orbitCurveSide {
        stroke-opacity: 0.28;
    }

    /*noinspection CssUnusedSymbol*/
    .orbitNode {
        fill: color-mix(in oklab, var(--fg), var(--bg) 20%);
        fill-opacity: 0.9;
        stroke: color-mix(in oklab, var(--bg), var(--fg) 30%);
        stroke-width: 1.5px;
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
        stroke-width: 1.7px;
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
        padding-right: var(--sp-2);
    }

    @media (max-width: 640px) {
        .sideBySideToggle {
            display: none !important;
        }
        .marker .markerBody {
            transform: scale(var(--mobile-marker-scale, 0.82));
        }
        .orbitNode {
            transform-box: fill-box;
            transform-origin: center;
            transform: scale(var(--mobile-marker-scale, 0.82));
        }
        .phoneSwipeZone {
            display: block;
            position: absolute;
            left: 6px;
            bottom: 6px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 1px solid color-mix(in oklab, var(--fg), transparent 68%);
            background: transparent;
            box-shadow: 0 2px 10px color-mix(in oklab, black, transparent 80%);
            z-index: 7;
            pointer-events: auto;
            touch-action: pan-x;
            display: grid;
            place-items: center;
        }
        .phoneSwipeZone::before {
            content: '↔';
            font-size: var(--fs-18);
            font-weight: 800;
            line-height: 1;
            opacity: 0.9;
        }
        .panel {
            height: 100%;
            min-height: 0;
            display: grid;
            grid-template-rows: auto auto auto minmax(0, 1fr);
        }
        .pickersBlock {
            min-height: 0;
        }
        .contentLayout {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden;
            align-items: stretch;
        }
        .visualPane {
            flex: 0 1 auto;
            min-height: 0;
            max-height: 52dvh;
            overflow: visible !important;
            position: relative;
            z-index: 1;
            contain: none;
            clip-path: none;
        }
        .wrap,
        .wheelPanel,
        .wheelBox,
        .wheelBox svg {
            overflow: visible !important;
        }
        .wrap,
        .wheelPanel,
        .wheelBox {
            contain: none;
        }
        .infoPane,
        .infoPane.side {
            flex: 1 1 0 !important;
            height: auto !important;
            max-height: 100% !important;
            min-height: 0 !important;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            align-self: stretch;
            display: flex;
            flex-direction: column;
            touch-action: pan-y;
            position: relative;
            z-index: 2;
            background: var(--panel) !important;
        }
        .infoPane :global(.infoBlock) {
            flex: 1 1 auto;
            min-height: 0;
            height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
            background: var(--panel) !important;
        }
        .paneResizeHandle {
            display: none !important;
        }
    }
</style>
