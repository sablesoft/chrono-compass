<!-- src/components/Cycle.svelte -->
<!--suppress HtmlUnknownTag -->
<script lang="ts">
    import { slide } from 'svelte/transition';
    import { createWheelGeom, SPOKE_LABELS, safeAngle } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useWheelEffectiveTs } from '../lib/wheel/ui/useEffectiveTs';

    import CycleTooltip from './CycleTooltip.svelte';
    import { useCycleTooltip, type CycleTipPayload } from '../lib/wheel/ui/useCycleTooltip';
    import { PointerAnimator } from '../lib/wheel/pointerAnimator';
    import { useCycleNowPointer } from '../lib/wheel/ui/useCycleNowPointer';

    import { objects, wheels } from '../lib/catalog';
    import type { ObjId, WheelSpec, RoleName, EmojiPlacement, EmojiPlacementInput, SpokeCode } from '../lib/catalog';
    import type { CycleInfoConfig, InfoItem, InfoTagConfig, InfoTemplate } from '../lib/wheel/types';

    import DocsModal from './DocsModal.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import WheelHeader from './WheelHeader.svelte';
    import CycleInfoBlock from './CycleInfoBlock.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { ms, formatDateTime } from '../lib/format';
    import { formatInfoValue } from '../lib/wheel/infoFormat';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    // unified resolver (runtime+idb+compute)
    import { resolveWheel } from '../lib/board/dispatcher';
    import type { CycleSpoke, WheelSolveResult } from '../lib/board/runtime';

    import { DEFAULT_LOCATION_ID, type Location } from '../lib/location/types';
    import { formatLabelTitleCaseUi, formatSpokeCodeUi, type WheelObserverState, type WheelTimeState, type SpokeKey, SPOKES_ORDER } from '../lib/wheel/types';

    import { setSelectedTs, startLive as startGlobalLive } from '../lib/time/store';

    import type { MarkerCluster } from '../lib/wheel/types';
    import { typeLabel } from '../lib/wheel/control';

    // ------------------------------------------------------------
    // Props (Board passes wheel + location)
    // ------------------------------------------------------------
    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: Location;
    export let onUserActivity: () => void = () => {};
    export let dragEnabled = false;
    export let onCardDragStart: (e: DragEvent) => void = () => {};
    export let onCardDragEnd: () => void = () => {};

    const dbg = debug('CYCLE', '🌀');

    // docs (per wheel type)
    const docs = useDocs(
        () => `concept/${wheel?.wheelType}.md`,
        {
            getTitle: () => typeLabel(wheel?.wheelType) + ' Wheel',
            dbg,
            tag: () => String(wheel?.wheelType ?? 'cycle')
        }
    );
    const docsState = docs.state;

    // ------------------------------------------------------------
    // Local derived state from wheel
    // ------------------------------------------------------------
    // IMPORTANT:
    // - wheelId: stable identity for UI + board mutations (must NOT depend on time/lock/etc)
    $: wheelId = wheel?.id;

    $: observer = (wheel?.observer ?? { locationId: DEFAULT_LOCATION_ID, locked: false }) as WheelObserverState;
    $: time = (wheel?.time ?? { live: true, locked: false }) as WheelTimeState;

    // Only “horizon” wheels show location controls for now
    $: isHorizon = wheel?.wheelType === 'horizon';

    // prefer passed-in location (already resolved in Board)
    $: wheelLoc = location;

    function closeCycle() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.removeWheelById(wheelId, 'Cycle.close');
    }

    // ------------------------------------------------------------
    // Effective time (UNIFIED)
    // - effTs = what solver uses
    // - also exposes globalTs/globalLive/localLiveNowTs for TimePicker UI
    // ------------------------------------------------------------
    const eff = useWheelEffectiveTs(
        () => wheelId,
        () => time,
        {
            syncToBoard: true,
            onSyncTime: (next, reason) => {
                if (!wheelId) return;
                boardApi.updateWheelTime(wheelId, next, reason ?? 'Cycle.syncWheelTime');
            },
            dbg: { warn: dbg.log }
        }
    );

    const effState = eff.state;
    $: effTs = $effState.ts;
    $: globalTs = $effState.globalTs;
    $: localLiveNowTs = $effState.localLiveNowTs;
    $: {
        void time?.live;
        void time?.locked;
        void time?.ts;
        eff.refresh('Cycle.timeChanged');
    }

    // If observer isn't locked -> keep it synced to passed-in location (ONLY for horizon wheels)
    $: {
        if (wheelId && isHorizon)
            if (!observer?.locked && wheelLoc?.id && observer.locationId !== wheelLoc.id) {
                boardApi.updateWheelObserver(wheelId, { locationId: wheelLoc.id }, 'Cycle.syncObserverLocation');
            }
    }

    // ------------------------------------------------------------
    // Helpers (format)
    // ------------------------------------------------------------
    function fmtOrDash(ts0: number) {
        return Number.isFinite(ts0) ? formatDateTime(ts0) : '—';
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
    const rInner = geom.rInner;
    const rLabel = geom.rLabel;

    const boundaryAngleDeg = geom.boundaryAngleDeg;
    const spokeAngleDeg = geom.spokeAngleDeg;
    const polarToXY = geom.polarToXY;
    const ringSectorPath = geom.ringSectorPath;

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

    const tip = useCycleTooltip({
        isCoarsePointer: () => isCoarsePointer,
        onActivateMarker: (_m) => {},
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });
    const tipState = tip.state;

    // ------------------------------------------------------------
    // Solve (unified dispatcher, no UI cacheKey)
    // ------------------------------------------------------------
    let solveOk = false;
    let solveReason = '';
    let spokes: CycleSpoke[] = [];
    let solvePending = false;
    $: solveRolesKey = JSON.stringify((wheel as any)?.roles ?? {});
    $: solveLocationKey = String((isHorizon ? wheelLoc?.id : '') ?? '');
    $: solveConfigReady = !!wheel && !!wheelId && (!isHorizon || !!wheelLoc);
    $: solveConfigKey = `${wheelId ?? ''}|${wheel?.wheelType ?? ''}|${solveRolesKey}|${solveLocationKey}`;
    $: solveRunKey = `${solveConfigKey}|${Number.isFinite(effTs) ? effTs : 'NaN'}`;

    let solveDoneForConfig = false;
    let solveDoneConfigKey = '';
    $: if (solveDoneConfigKey !== solveConfigKey) {
        solveDoneConfigKey = solveConfigKey;
        solveDoneForConfig = false;
    }
    $: showLoadingOverlay = solveConfigReady && (solvePending || !solveDoneForConfig);

    let ensureRunId = 0;

    function sortSpokes(xs: CycleSpoke[]) {
        return (xs ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    async function ensureCycleForTs(ts: number) {
        const myRun = ++ensureRunId;
        solvePending = true;

        solveOk = false;
        solveReason = '';

        if (!wheel || !wheelId) {
            solveReason = 'No wheel';
            solveDoneForConfig = true;
            if (ensureRunId === myRun) solvePending = false;
            return;
        }

        try {
            const ctx = {
                ts,
                location: isHorizon ? wheelLoc : undefined,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log },
            };

            const res: WheelSolveResult = await resolveWheel(wheel as any, ctx);

            if (ensureRunId !== myRun) return;

            if (!res || (res as any).kind !== 'cycle') {
                solveReason = 'Not a cycle result';
                solveDoneForConfig = true;
                return;
            }

            const r: any = res;
            solveOk = !!r.ok;
            solveReason = r.ok ? '' : (r.reason ?? 'Solve failed');

            // обновляем спицы, только когда пришёл валидный ответ
            spokes = sortSpokes(r.spokes ?? []);
            solveDoneForConfig = true;
        } catch (e: any) {
            if (ensureRunId !== myRun) return;
            solveReason = e?.message ?? 'Solve failed';
            solveDoneForConfig = true;
        } finally {
            if (ensureRunId === myRun) solvePending = false;
        }
    }

    $: {
        void solveRunKey;
        if (solveConfigReady) void ensureCycleForTs(effTs);
    }

    // ------------------------------------------------------------
    // Derived arrays from spokes (UI helpers)
    // ------------------------------------------------------------
    let spokeTimes: number[] = [];
    let spokeCodes: SpokeKey[] = [];
    let boundaryTimes: number[] = [];

    $: {
        const times: number[] = [];
        const codes: SpokeKey[] = [];

        for (let i = 0; i < 17; i++) {
            const s = spokes.find(x => x.index === i);
            if (s && Number.isFinite(s.ts)) {
                times[i] = ms(s.ts);
                codes[i] = (s.code ?? (i === 16 ? 'E_next' : (labels[i] as any))) as SpokeKey;
            } else {
                times[i] = NaN;
                codes[i] = (i === 16 ? 'E_next' : (labels[i] as any)) as SpokeKey;
            }
        }

        spokeTimes = times;
        spokeCodes = codes;

        const bt: number[] = [];
        for (let i = 0; i < 16; i++) {
            const a = spokeTimes[i];
            const b = spokeTimes[i + 1];
            bt[i] = (Number.isFinite(a) && Number.isFinite(b)) ? ms((a + b) / 2) : NaN;
        }
        boundaryTimes = bt;
    }

    function cycleWindowFromSpokes() {
        const a = spokeTimes?.[0];
        const b = spokeTimes?.[16];
        return (Number.isFinite(a) && Number.isFinite(b) && b > a) ? { start: a, end: b } : null;
    }

    function clamp01(x: number) {
        return x < 0 ? 0 : (x > 1 ? 1 : x);
    }

    function angleDegAtTs(ts0: number): number | null {
        const t = spokeTimes;
        if (!t || t.length < 17) return null;

        const tE = t[0];
        const tE2 = t[16];
        if (!Number.isFinite(tE) || !Number.isFinite(tE2) || !(tE2 > tE)) return null;

        const ts = Math.min(Math.max(ts0, tE), tE2);

        let i = 0;
        for (let k = 0; k < 16; k++) {
            const a = t[k];
            const b = t[k + 1];
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (ts >= a && ts <= b) { i = k; break; }
            if (ts > b) i = k;
        }

        const aT = t[i];
        const bT = t[i + 1];
        const den = (Number.isFinite(aT) && Number.isFinite(bT) && bT > aT) ? (bT - aT) : 1;
        const u = clamp01((ts - aT) / den);

        const aAng = spokeAngleDeg(i);
        const bAng = (i === 15) ? (spokeAngleDeg(0) - 360) : spokeAngleDeg(i + 1);

        return aAng + (bAng - aAng) * u;
    }

    const now = useCycleNowPointer(
        () => cycleWindowFromSpokes(),
        (ts0) => angleDegAtTs(ts0),
        dbg
    );
    const nowState = now.state;

    let showNowPointer = false;
    let nowDisplayAngle = 0;
    let hideNowPointerByWindowLag = false;

    $: showNowPointer = $nowState.show && !time.live;
    $: nowDisplayAngle = $nowState.displayAngle;
    $: {
        const w = cycleWindowFromSpokes();
        hideNowPointerByWindowLag = !!(
            w &&
            Number.isFinite(effTs) &&
            (effTs < w.start || effTs > w.end)
        );
    }

    let lastNowDepsKey = '';

    $: {
        const w = cycleWindowFromSpokes();
        if (w) {
            const key = `deps:${w.start}:${w.end}`;
            if (key !== lastNowDepsKey) {
                lastNowDepsKey = key;
                now.refresh?.(key);
            }
        }
    }

    $: cycleBeginTs = spokeTimes?.[0];
    $: cycleEndTs = spokeTimes?.[16];
    $: cycleDurationMs =
        Number.isFinite(cycleBeginTs) && Number.isFinite(cycleEndTs) && cycleEndTs > cycleBeginTs
            ? (cycleEndTs - cycleBeginTs)
            : NaN;

    function spokePayload(i: number): CycleTipPayload {
        const s = spokes.find(x => x.index === i);
        const code = (i == 16) ? 'E+' : (spokeCodes?.[i] ?? labels[i]);

        const t = spokeTimes?.[i];
        const ts = Number.isFinite(t) ? t : NaN;
        const pickTs = resolveSpokePickTs(i);

        const collectTooltipItemsFromConfig = (
            spoke: CycleSpoke
        ): Array<{ id?: string; label: string; value?: string; modal?: string }> => {
            const meta = spokeInfoMeta(spoke);
            const out: Array<{ id?: string; label: string; value?: string; modal?: string }> = [];
            const seen = new Set<string>();

            for (const tpl of infoConfig.templates) {
                if (!tpl.enabled) continue;
                if (!tpl.spokes.includes(spoke.code)) continue;
                const chips = buildChips(tpl.tags, meta, spoke.code, tpl.id);
                for (const chip of chips) {
                    const key = chip.id || chip.label;
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    out.push({
                        id: chip.id,
                        label: chip.label,
                        value: chip.value,
                        modal: chip.modal
                    });
                }
            }

            return out;
        };

        const items = (() => {
            if (!s) return [];
            return collectTooltipItemsFromConfig(s);
        })();
        const tags = uniqueStrings(items.map((item) => item.label));
        return {
            kind: 'spoke',
            code: String(code),
            ts,
            pickTs: Number.isFinite(pickTs) ? pickTs : undefined,
            meta: (s as any)?.meta,
            tags: tags.length ? tags : undefined,
            items: items.length ? items : undefined
        };
    }

    function boundaryPayload(i: number): CycleTipPayload {
        const from = String(labels[i]);
        const to = String(i === 15 ? 'E+' : labels[i + 1]);

        const t = boundaryTimes?.[i];
        const ts = Number.isFinite(t) ? t : NaN;

        return { kind: 'boundary', from, to, ts };
    }

    function canShowCycleTooltip(p: CycleTipPayload): boolean {
        if (p.kind === 'marker') return p.moments.length > 0;
        return Array.isArray(p.items) && p.items.length > 0;
    }

    // ------------------------------------------------------------
    // Emoji placements
    // ------------------------------------------------------------
    function bodyEmoji(id: ObjId | null | undefined): string | null {
        if (!id) return null;
        const b = (objects as any)[id] as { emoji?: string } | undefined;
        return b?.emoji ?? null;
    }

    type UiAnchor =
        | { kind: 'center' }
        | { kind: 'pointer' }
        | { kind: 'label'; spoke: SpokeCode }
        | { kind: 'spoke'; spoke: SpokeCode };

    function anchorKey(a: UiAnchor) {
        if (a.kind === 'center') return 'center';
        if (a.kind === 'pointer') return 'pointer';
        return `${a.kind}:${a.spoke}`;
    }

    function parsePlacement(p: EmojiPlacement): UiAnchor {
        if (p === 'center') return { kind: 'center' };
        if (p === 'pointer') return { kind: 'pointer' };
        if (p.endsWith('-spoke')) return { kind: 'spoke', spoke: p.slice(0, -'-spoke'.length) as SpokeCode };
        return { kind: 'label', spoke: p as SpokeCode };
    }

    function parsePlacements(p: EmojiPlacementInput | undefined): UiAnchor[] {
        if (!p) return [];
        const arr = Array.isArray(p) ? p : [p];
        return arr.map((x) => parsePlacement(x));
    }

    type EmojiAt = { anchor: UiAnchor; text: string };

    let spec: WheelSpec | null = null;
    let emojiAt: EmojiAt[] = [];

    $: {
        spec = wheel?.wheelType ? (wheels as any)[wheel.wheelType] as WheelSpec : null;

        const ui = (spec as any)?.ui as Partial<Record<RoleName, EmojiPlacementInput>> | undefined;
        const draws: Array<{ anchor: UiAnchor; emoji: string }> = [];

        const focusId = (wheel?.roles as any)?.focus as ObjId | null;
        const targetRaw = (wheel?.roles as any)?.target as ObjId[] | ObjId | null;
        const targetId = Array.isArray(targetRaw) ? (targetRaw[0] ?? null) : targetRaw;

        if (ui?.focus && focusId) {
            const e = bodyEmoji(focusId);
            if (e) {
                for (const a of parsePlacements(ui.focus)) draws.push({ anchor: a, emoji: e });
            }
        }

        if (ui?.target && targetId) {
            const e = bodyEmoji(targetId);
            if (e) {
                for (const a of parsePlacements(ui.target)) draws.push({ anchor: a, emoji: e });
            }
        }

        if (ui?.looker) {
            const lookerId = (wheel?.roles as any)?.looker as ObjId | null;
            const e = bodyEmoji(lookerId);
            if (e) {
                for (const a of parsePlacements(ui.looker)) draws.push({ anchor: a, emoji: e });
            }
        }

        const m = new Map<string, { anchor: UiAnchor; parts: string[] }>();
        for (const d of draws) {
            const k = anchorKey(d.anchor);
            const cur = m.get(k) ?? { anchor: d.anchor, parts: [] };
            cur.parts.push(d.emoji);
            m.set(k, cur);
        }

        emojiAt = Array.from(m.values()).map(x => ({ anchor: x.anchor, text: x.parts.join('') }));
    }

    function emojiAtPointer(): string | null {
        return emojiAt.find(x => x.anchor.kind === 'pointer')?.text ?? null;
    }
    function emojiAtCenter(): string | null {
        return emojiAt.find(x => x.anchor.kind === 'center')?.text ?? null;
    }
    function emojiAtLabel(spoke: SpokeCode): string | null {
        return emojiAt.find(x => x.anchor.kind === 'label' && x.anchor.spoke === spoke)?.text ?? null;
    }
    function emojiAtSpoke(spoke: SpokeCode): string | null {
        return emojiAt.find(x => x.anchor.kind === 'spoke' && x.anchor.spoke === spoke)?.text ?? null;
    }

    let pointerEmoji: string | null = null;
    let centerEmoji: string | null = null;

    $: {
        pointerEmoji = emojiAtPointer();
        centerEmoji = emojiAtCenter();
    }

    // ------------------------------------------------------------
    // Pointer animation
    // ------------------------------------------------------------
    function nearestSpokeIndexByTime(ts0: number, arr: number[]) {
        let bestI = 0;
        let bestD = Infinity;
        for (let i = 0; i < arr.length; i++) {
            const t = arr[i];
            if (!Number.isFinite(t)) continue;
            const d = Math.abs(ts0 - t);
            if (d < bestD) { bestD = d; bestI = i; }
        }
        return bestI;
    }

    $: activeSpokeIndex = spokeTimes?.length ? nearestSpokeIndexByTime(effTs, spokeTimes) : 0;
    $: activeSpokeCode = spokeCodes?.[activeSpokeIndex] ?? ((activeSpokeIndex === 16) ? 'E_next' : (labels[activeSpokeIndex] as any));
    $: activeSpokeLabel = formatSpokeCodeUi(activeSpokeCode);

    $: pointerAngleDeg = (() => {
        const t = spokeTimes;
        if (!t || t.length < 17) return 0;

        const tE = t[0];
        const tE2 = t[16];
        if (!Number.isFinite(tE) || !Number.isFinite(tE2) || !(tE2 > tE)) return 0;

        const ts0 = Math.min(Math.max(effTs, tE), tE2);

        let i = 0;
        for (let k = 0; k < 16; k++) {
            const a = t[k];
            const b = t[k + 1];
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (ts0 >= a && ts0 <= b) { i = k; break; }
            if (ts0 > b) i = k;
        }

        const aT = t[i];
        const bT = t[i + 1];
        const segDen = (Number.isFinite(aT) && Number.isFinite(bT) && bT > aT) ? (bT - aT) : 1;
        const u = clamp01((ts0 - aT) / segDen);

        const aAng = spokeAngleDeg(i);
        const bAng = (i === 15) ? (spokeAngleDeg(0) - 360) : spokeAngleDeg(i + 1);

        return aAng + (bAng - aAng) * u;
    })();

    let lastSeenTs = effTs;
    let timeDir: -1 | 0 | 1 = 0;

    let displayAngle = 0;
    let noTransition = false;

    const animator = new PointerAnimator((s) => {
        displayAngle = s.angleDeg;
        noTransition = s.noTransition;
    });

    $: {
        const delta = effTs - lastSeenTs;
        timeDir = delta === 0 ? 0 : (delta > 0 ? 1 : -1);
        lastSeenTs = effTs;

        const cycleWindowKey = `${spokeTimes?.[0] ?? 'na'}:${spokeTimes?.[16] ?? 'na'}`;

        animator.applyInput({
            baseAngleDeg: pointerAngleDeg,
            timeDir,
            cycleKey: cycleWindowKey
        });
    }

    function jumpTo(ts0: number, reason = 'jump') {
        if (!Number.isFinite(ts0)) return;
        onUserActivity();
        const pickedTs = ms(ts0);
        dbg.log(`${wheel?.wheelType} ${reason}`, {
            from: new Date(selectedTs).toISOString(),
            to: new Date(pickedTs).toISOString(),
            wheelId,
        });
        if (time.locked) {
            if (wheelId) {
                boardApi.updateWheelTime(
                    wheelId,
                    { live: false, ts: pickedTs, locked: true },
                    `Cycle.${reason}.goLocked`
                );
            }
        } else {
            setSelectedTs(pickedTs);
        }
        now.refresh?.(`user:${reason}`);
    }

    function goLiveFromNowPointer() {
        onUserActivity();
        if (time.locked) {
            if (!wheelId) return;
            boardApi.updateWheelTime(
                wheelId,
                { live: true, locked: true },
                'Cycle.nowPointer.goLockedLive'
            );
            return;
        }
        startGlobalLive();
    }

    const SHIFT_EPS_MS = 1500;
    const NEXT_CYCLE_PICK_EPS_MS = 15_000;
    const SNAP_SPOKE_EPS_MS = 250;
    let pendingShiftSnap: { dir: -1 | 1 } | null = null;

    function nearestMainSpokeIndexByTime(ts0: number, arr: number[]) {
        let bestI = 0;
        let bestD = Infinity;
        for (let i = 0; i < 16; i++) {
            const t = arr?.[i];
            if (!Number.isFinite(t)) continue;
            const d = Math.abs(ts0 - t);
            if (d < bestD) { bestD = d; bestI = i; }
        }
        return bestI;
    }

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        const t0 = spokeTimes?.[0];
        const t1 = spokeTimes?.[16];
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) return;
        const tsNow = Math.min(Math.max(effTs, t0), t1);
        const offsetFromStart = tsNow - t0;
        const offsetToEnd = t1 - tsNow;

        // Keep the same phase position in adjacent cycle instead of snapping to E/E+ boundary.
        const probe = dir < 0
            ? (t0 - offsetToEnd - SHIFT_EPS_MS)
            : (t1 + offsetFromStart + SHIFT_EPS_MS);
        pendingShiftSnap = { dir };
        jumpTo(probe, dir < 0 ? 'prevCycle' : 'nextCycle');
    }

    $: {
        if (pendingShiftSnap && solveOk && spokeTimes && spokeTimes.length >= 16) {
            const dir = pendingShiftSnap.dir;
            const i = nearestMainSpokeIndexByTime(effTs, spokeTimes);
            const snapTs = spokeTimes[i];
            pendingShiftSnap = null;

            if (Number.isFinite(snapTs) && Math.abs(effTs - snapTs) > SNAP_SPOKE_EPS_MS) {
                jumpTo(snapTs, `shiftSnap:${dir < 0 ? 'prev' : 'next'}:spoke:${i}`);
            }
        }
    }

    function resolveSpokePickTs(i: number): number {
        const t = spokeTimes?.[i];
        if (!Number.isFinite(t)) return NaN;
        // E+ is boundary/end. Use a larger offset than regular shift epsilon
        // to reliably step into the next cycle window (cache buckets are coarser).
        return i === 16 ? (t + NEXT_CYCLE_PICK_EPS_MS) : t;
    }

    function handleSpokeActivate(i: number) {
        const t = resolveSpokePickTs(i);
        if (Number.isFinite(t)) jumpTo(t, `spoke:${i}`);
    }

    function handleBoundaryActivate(i: number) {
        const t = boundaryTimes[i];
        if (Number.isFinite(t)) jumpTo(t, `boundary:${i}`);
    }

    function handleMarkerPick(ts0: number) {
        jumpTo(ts0, `tipPick`);
        tip.closeNow();
    }

    // Markers (stub)
    let markerClusters: MarkerCluster[] = [];
    markerClusters = [];

    $: showVisualSection = wheel?.view?.showVisual !== false;
    $: showInfoSection = wheel?.view?.showInfo === true;
    $: showPickersSection = wheel?.view?.showPickers === true;

    function toggleVisualSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showVisual: !showVisualSection } },
            'Cycle.toggleVisualSection'
        );
    }

    function toggleInfoSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showInfo: !showInfoSection } },
            'Cycle.toggleInfoSection'
        );
    }

    function togglePickersSection() {
        onUserActivity();
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { showPickers: !showPickersSection } },
            'Cycle.togglePickersSection'
        );
    }

    function handleSpokePick(code: SpokeKey) {
        const hit = spokes.find((s) => s.code === code);
        if (!hit) return;
        const ts = resolveSpokePickTs(hit.index);
        if (Number.isFinite(ts)) jumpTo(ts, `spoke:${code}`);
    }

    type InfoChip = {
        id: string;
        label: string;
        value?: string;
        kind?: string;
        modal?: string;
        clickable?: boolean;
        disabled?: boolean;
        title?: string;
        ariaLabel?: string;
        dim?: boolean;
        templateId?: string;
    };

    type SpokeInfoRow = {
        code: SpokeKey;
        chips: InfoChip[];
        ts?: number;
        isCurrent?: boolean;
        templateId?: string;
    };

    type TagDef = {
        id: string;
        label: string;
        enabled?: boolean;
        enabledStatic?: boolean;
        modal?: string;
        metaField?: string;
        format?: string;
        value?: string;
        spokes?: SpokeKey[] | '*';
    };

    let cycleInfoDefs: InfoItem[] = [];
    let tagDefs: TagDef[] = [];
    let tagDefById: Map<string, TagDef> = new Map();
    let availableSpokeCodes: SpokeKey[] = [];
    let activeSpoke: CycleSpoke | null = null;

    let generalDefs: Array<{ id: string; label: string; value: string }> = [];
    let currentValues: Record<string, string> = {};
    let staticValues: Record<string, string> = {};

    let defaultInfoConfig: CycleInfoConfig = {
        general: { enabled: true, tags: [] },
        templates: []
    };
    let infoConfig: CycleInfoConfig = defaultInfoConfig;

    let generalChipsOrdered: InfoChip[] = [];
    let currentRow: SpokeInfoRow | null = null;
    let staticSpokeRows: SpokeInfoRow[] = [];
    let extraTagsBySpoke: Map<SpokeKey, string[]> = new Map();

    let infoConfigInitialized = false;
    let infoConfigWheelId = '';

    function normalizeLabel(input: unknown): string {
        return String(input ?? '').trim();
    }

    function tagIdFromLabel(label: string): string {
        const base = label
            .toLowerCase()
            .replace(/[\s-]+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return base || 'item';
    }

    function normalizeTagConfig(input: InfoTagConfig): InfoTagConfig | null {
        if (!input || !input.id) return null;
        return {
            id: String(input.id).trim(),
            label: input.label,
            enabled: input.enabled !== false,
            modal: input.modal,
            isCustom: input.isCustom
        };
    }

    function normalizeTemplate(input: InfoTemplate, defaults: InfoTemplate): InfoTemplate {
        const tags = Array.isArray(input.tags) && input.tags.length
            ? input.tags.map(normalizeTagConfig).filter((t): t is InfoTagConfig => !!t)
            : defaults.tags;
        const spokes = Array.isArray(input.spokes) && input.spokes.length
            ? input.spokes.filter(Boolean)
            : defaults.spokes;
        return {
            id: input.id || defaults.id,
            title: String(input.title || defaults.title || 'Template'),
            enabled: typeof input.enabled === 'boolean' ? input.enabled : defaults.enabled,
            dynamic: typeof input.dynamic === 'boolean' ? input.dynamic : defaults.dynamic,
            spokes,
            tags
        };
    }

    function normalizeInfoConfig(defaults: CycleInfoConfig, current?: CycleInfoConfig | null): CycleInfoConfig {
        if (!current) return defaults;
        const generalTags = Array.isArray(current.general?.tags) && current.general.tags.length
            ? current.general.tags.map(normalizeTagConfig).filter((t): t is InfoTagConfig => !!t)
            : defaults.general.tags;
        const templates = Array.isArray(current.templates) && current.templates.length
            ? current.templates.map((tpl) => {
                const base = defaults.templates.find((d) => d.dynamic === tpl.dynamic) ?? defaults.templates[0];
                return normalizeTemplate(tpl, base);
            })
            : defaults.templates;
        return {
            general: {
                enabled: typeof current.general?.enabled === 'boolean' ? current.general.enabled : defaults.general.enabled,
                tags: generalTags
            },
            templates
        };
    }

    function applyInfoConfig(next: CycleInfoConfig) {
        if (!wheelId) return;
        boardApi.updateWheelById(
            wheelId,
            { view: { infoConfig: next } },
            'Cycle.configureInfoBlock'
        );
    }

    function reorderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
        if (!ids.length) return items;
        const map = new Map(items.map((x) => [x.id, x]));
        const out: T[] = [];
        const seen = new Set<string>();
        for (const id of ids) {
            const hit = map.get(id);
            if (!hit || seen.has(id)) continue;
            out.push(hit);
            seen.add(id);
        }
        for (const item of items) {
            if (seen.has(item.id)) continue;
            out.push(item);
        }
        return out;
    }

    function handleGeneralReorder(ids: string[]) {
        if (!infoConfig) return;
        const map = new Map(infoConfig.general.tags.map((t) => [t.id, t]));
        const nextTags = reorderByIds(infoConfig.general.tags, ids).filter((t) => map.has(t.id));
        applyInfoConfig({ ...infoConfig, general: { ...infoConfig.general, tags: nextTags } });
    }

    function handleTemplateReorder(templateId: string, ids: string[]) {
        if (!infoConfig) return;
        const nextTemplates = infoConfig.templates.map((tpl) => {
            if (tpl.id !== templateId) return tpl;
            const map = new Map(tpl.tags.map((t) => [t.id, t]));
            const nextTags = reorderByIds(tpl.tags, ids).filter((t) => map.has(t.id));
            return { ...tpl, tags: nextTags };
        });
        applyInfoConfig({ ...infoConfig, templates: nextTemplates });
    }

    function buildTagDefs(rows: InfoItem[]): TagDef[] {
        const out: TagDef[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
            if (!row?.defaultLabel) continue;
            const rawLabel = normalizeLabel(row.defaultLabel);
            const label = formatLabelTitleCaseUi(rawLabel);
            const id = tagIdFromLabel(rawLabel);
            if (!id || !label || seen.has(id)) continue;
            seen.add(id);
            out.push({
                id,
                label,
                enabled: row.enabled !== false,
                enabledStatic: typeof row.enabledStatic === 'boolean' ? row.enabledStatic : undefined,
                modal: typeof row.modal === 'string' ? row.modal : undefined,
                metaField: row.metaField,
                format: row.format,
                value: row.value,
                spokes: row.spokes
            });
        }
        return out;
    }

    function buildSpokeTypeInfoItems(wheelType: string | undefined): InfoItem[] {
        const type = String(wheelType ?? '').trim();
        if (!type) return [];
        return SPOKES_ORDER.map((code) => ({
            defaultLabel: `${code}-${type}`,
            enabled: false,
            spokes: [code]
        }));
    }

    function tagApplies(def: TagDef | undefined, code: SpokeKey): boolean {
        if (!def?.spokes) return true;
        if (def.spokes === '*') return true;
        return def.spokes.includes(code);
    }

    function tagValueForDef(def: TagDef | undefined, meta: Record<string, unknown>): string | undefined {
        if (!def) return undefined;
        const rawValue = def.metaField ? (meta as any)?.[def.metaField] : def.value;
        if (def.format) return formatInfoValue(def.format, rawValue);
        if (rawValue == null || String(rawValue).trim() === '') return undefined;
        return String(rawValue);
    }

    function spokeInfoMeta(spoke: CycleSpoke | null | undefined): Record<string, unknown> {
        if (!spoke) return {};
        const meta = ((spoke as any)?.meta ?? {}) as Record<string, unknown>;
        return {
            ...meta,
            ts: Number.isFinite(spoke.ts) ? spoke.ts : undefined
        };
    }

    function buildValueMap(meta: Record<string, unknown>, code: SpokeKey): Record<string, string> {
        const out: Record<string, string> = {};
        for (const def of tagDefs) {
            if (!tagApplies(def, code)) continue;
            const value = tagValueForDef(def, meta);
            if (value != null) out[def.id] = value;
        }
        return out;
    }

    function buildChips(tagConfigs: InfoTagConfig[], meta: Record<string, unknown>, code: SpokeKey, templateId?: string): InfoChip[] {
        const out: InfoChip[] = [];
        for (const tag of tagConfigs) {
            if (tag.enabled === false) continue;
            const def = tagDefById.get(tag.id);
            if (def && !tagApplies(def, code)) continue;
            const baseLabel = def?.label ?? formatLabelTitleCaseUi(tag.label ?? tag.id);
            const label = (tag.label && tag.label.trim()) ? tag.label.trim() : baseLabel;
            const value = tagValueForDef(def, meta);
            const modal = tag.modal && tag.modal.trim() ? tag.modal.trim() : undefined;
            out.push({
                id: tag.id,
                label,
                value,
                modal,
                clickable: !!modal,
                templateId
            });
        }
        return out;
    }

    function findTemplate(templates: InfoTemplate[], code: SpokeKey, dynamic: boolean): InfoTemplate | null {
        for (const tpl of templates) {
            if (!tpl.enabled || tpl.dynamic !== dynamic) continue;
            if (tpl.spokes.includes(code)) return tpl;
        }
        return null;
    }

    function templateTagLabels(template: InfoTemplate, code: SpokeKey): string[] {
        const out: string[] = [];
        for (const tag of template.tags) {
            if (tag.enabled === false) continue;
            const def = tagDefById.get(tag.id);
            if (def && !tagApplies(def, code)) continue;
            const label = (tag.label && tag.label.trim()) ? tag.label.trim() : (def?.label ?? formatLabelTitleCaseUi(tag.id));
            if (!label) continue;
            out.push(label);
        }
        return out;
    }

    function uniqueStrings(list: string[]): string[] {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const raw of list) {
            const v = String(raw ?? '').trim();
            if (!v || seen.has(v)) continue;
            seen.add(v);
            out.push(v);
        }
        return out;
    }

    function defaultStaticSpokes(codes: SpokeKey[]): SpokeKey[] {
        const preferred: SpokeKey[] = ['E', 'N', 'W', 'S', 'E_next'];
        return preferred.filter((code) => codes.includes(code));
    }

    $: cycleInfoDefsBase = Array.isArray((spec as any)?.info) ? ((spec as any).info as InfoItem[]) : [];
    $: cycleInfoMomentDef = [{ defaultLabel: 'moment', metaField: 'ts', format: 'dateTime', spokes: '*' } satisfies InfoItem];
    $: cycleInfoDefs = [...cycleInfoMomentDef, ...cycleInfoDefsBase, ...buildSpokeTypeInfoItems(wheel?.wheelType)];
    $: tagDefs = buildTagDefs(cycleInfoDefs);
    $: tagDefById = new Map(tagDefs.map((d) => [d.id, d]));
    $: availableSpokeCodes = SPOKES_ORDER.filter((code) => spokes.some((s) => s.code === code));
    $: activeSpoke = spokes.find((x) => x.index === activeSpokeIndex) ?? null;

    $: generalDefs = [{
        id: 'duration',
        label: formatLabelTitleCaseUi('duration'),
        value: formatInfoValue('duration', cycleDurationMs)
    }];

    $: defaultInfoConfig = {
        general: {
            enabled: true,
            tags: [{ id: 'duration', enabled: true }]
        },
        templates: [
            {
                id: 'tpl:dynamic:default',
                title: 'Current spoke',
                enabled: true,
                dynamic: true,
                spokes: availableSpokeCodes,
                tags: tagDefs.map((d) => ({ id: d.id, enabled: d.enabled !== false, modal: d.modal }))
            },
            {
                id: 'tpl:static:default',
                title: 'Spokes',
                enabled: true,
                dynamic: false,
                spokes: defaultStaticSpokes(availableSpokeCodes),
                tags: tagDefs.map((d) => ({
                    id: d.id,
                    enabled: typeof d.enabledStatic === 'boolean' ? d.enabledStatic : (d.enabled !== false),
                    modal: d.modal
                }))
            }
        ]
    } satisfies CycleInfoConfig;

    $: if (wheelId && wheelId !== infoConfigWheelId) {
        infoConfigWheelId = wheelId;
        infoConfigInitialized = false;
    }

    $: infoConfig = normalizeInfoConfig(defaultInfoConfig, wheel?.view?.infoConfig ?? null);
    $: if (!infoConfigInitialized && wheelId && wheel?.view && !wheel.view.infoConfig && availableSpokeCodes.length > 0) {
        infoConfigInitialized = true;
        applyInfoConfig(defaultInfoConfig);
    }

    $: generalChipsOrdered = (() => {
        if (!infoConfig?.general.enabled) return [];
        const generalMap = new Map(generalDefs.map((d) => [d.id, d]));
        return infoConfig.general.tags
            .filter((t) => t.enabled !== false)
            .map((t) => {
                const def = generalMap.get(t.id);
                const label = (t.label && t.label.trim()) ? t.label.trim() : (def?.label ?? formatLabelTitleCaseUi(t.id));
                const value = def?.value;
                const modal = t.modal && t.modal.trim() ? t.modal.trim() : undefined;
                return {
                    id: t.id,
                    label,
                    value,
                    modal,
                    clickable: !!modal
                };
            });
    })();

    $: currentRow = (() => {
        if (!activeSpoke) return null;
        const template = findTemplate(infoConfig.templates, activeSpoke.code, true);
        if (!template) return null;
        const meta = spokeInfoMeta(activeSpoke);
        const chips = buildChips(template.tags, meta, activeSpoke.code, template.id);
        return { code: activeSpoke.code, ts: activeSpoke.ts, chips, isCurrent: true, templateId: template.id };
    })();

    $: staticSpokeRows = (() => {
        const rows: SpokeInfoRow[] = [];
        for (const code of availableSpokeCodes) {
            const template = findTemplate(infoConfig.templates, code, false);
            if (!template) continue;
            const spoke = spokes.find((s) => s.code === code);
            if (!spoke) continue;
            const meta = spokeInfoMeta(spoke);
            const chips = buildChips(template.tags, meta, code, template.id);
            rows.push({ code, ts: spoke.ts, chips, templateId: template.id });
        }
        return rows;
    })();

    $: currentValues = activeSpoke ? buildValueMap(spokeInfoMeta(activeSpoke), activeSpoke.code) : {};
    $: {
        const refCode = availableSpokeCodes[0];
        const refSpoke = refCode ? spokes.find((s) => s.code === refCode) : null;
        staticValues = refSpoke ? buildValueMap(spokeInfoMeta(refSpoke), refSpoke.code) : {};
    }

    $: extraTagsBySpoke = (() => {
        const map = new Map<SpokeKey, string[]>();
        for (const tpl of infoConfig.templates) {
            if (!tpl.enabled || tpl.dynamic) continue;
            for (const code of tpl.spokes) {
                const labels = templateTagLabels(tpl, code);
                if (!labels.length) continue;
                const next = map.get(code) ?? [];
                map.set(code, uniqueStrings([...next, ...labels]));
            }
        }
        return map;
    })();
</script>

<section class="panel">
    <WheelHeader
            wheel={wheel}
            onDocs={docs.openDocs}
            onClose={closeCycle}
            dragEnabled={dragEnabled}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
            visualOpen={showVisualSection}
            infoOpen={showInfoSection}
            pickersOpen={showPickersSection}
            onToggleVisual={toggleVisualSection}
            onToggleInfo={toggleInfoSection}
            onTogglePickers={togglePickersSection}
    />

    {#if showPickersSection}
    <section class="pickersBlock" aria-label="Wheel pickers" transition:slide|local>
        <div class="sectionSep headerSep" aria-hidden="true"></div>
        <div class="headerBottom" class:twoCols={isHorizon}>
            <div class="pickerRow">
                <div class="rowFill">
                    <TimePicker
                            value={time}
                            locked={time.locked}
                            liveNowTs={time.live ? (time.locked ? localLiveNowTs : globalTs) : null}
                            onChange={(next, meta) => {
                                onUserActivity();
                                const patch: Partial<WheelTimeState> =
                                    next.live
                                        ? { live: true, locked: meta.lockOnApply ? true : time.locked }
                                        : { live: false, ts: next.ts ?? Date.now(), locked: meta.lockOnApply ? true : time.locked };
                                if (!wheelId) return;
                                boardApi.updateWheelTime(wheelId, patch, 'Cycle.time.apply');
                            }}
                            onToggleLock={(next) => {
                                onUserActivity();
                                if (!wheelId) return;
                                boardApi.updateWheelTime(wheelId, { locked: next }, 'Cycle.time.lock');
                            }}
                    />
                </div>
            </div>

            {#if isHorizon}
                <div class="pickerRow">
                    <div class="rowFill">
                        <LocationPicker
                                value={wheelLoc}
                                locked={observer.locked}
                                onChange={(loc) => {
                                onUserActivity();
                                    const patch: Partial<WheelObserverState> = {
                                        locationId: loc.id,
                                        locked: true
                                    };
                                    dbg.log?.('Cycle.location.apply', { patch, wheelId });
                                    if (!wheelId) return;
                                    boardApi.updateWheelObserver(wheelId, patch, 'Cycle.location.apply');
                                }}
                                onToggleLock={(next) => {
                                    onUserActivity();
                                    if (!wheelId) return;
                                    boardApi.updateWheelObserver(wheelId, { locked: next }, 'Cycle.location.lock');
                                }}
                        />
                    </div>
                </div>
            {/if}
        </div>
    </section>
    {/if}

    {#if showVisualSection || showInfoSection}
        <div class="sectionSep" aria-hidden="true"></div>
    {/if}

    {#if showVisualSection}
        <div class="wrap" bind:this={wrapEl} transition:slide|local>
            <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Cycle Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

                    <!-- House Boundaries -->
                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}
                        {@const key = `boundary:${i}`}

                        <g class="tick"
                           role="button"
                           tabindex="0"
                           aria-label={`House boundary ${i + 1}`}
                           on:click={(e) => {
                               const p = boundaryPayload(i);
                               if (!canShowCycleTooltip(p)) return;
                               tip.openNow(e, p);
                           }}
                           on:dblclick={() => handleBoundaryActivate(i)}
                           on:mouseenter={(e) => {
                               const p = boundaryPayload(i);
                               if (!canShowCycleTooltip(p)) return;
                               tip.hoverEnter(e, p, key);
                           }}
                           on:mouseleave={() => tip.hoverLeave(key)}
                           on:keydown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   handleBoundaryActivate(i);
                               }
                           }}>
                            <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} class="tickLine" />
                            <circle cx={pHit.x} cy={pHit.y} r={VB * 0.03} fill="transparent" />
                        </g>
                    {/each}

                    <g class="quadrants" aria-hidden="true" transform={`rotate(90 ${cx} ${cy})`}>
                        <path d={ringSectorPath(-45, -135)} class="q q-red" />
                        <path d={ringSectorPath(-135, -225)} class="q q-white" />
                        <path d={ringSectorPath(-225, -315)} class="q q-blue" />
                        <path d={ringSectorPath(-315, -405)} class="q q-gold" />
                    </g>

                    <!-- Spoke Labels -->
                    {#each labels as label, i (label)}
                        {@const a = spokeAngleDeg(i)}
                        {@const p1 = polarToXY(rInner, a)}
                        {@const p2 = polarToXY(rOuter, a)}
                        {@const pt = polarToXY(rLabel, a)}
                        {@const key = `spoke:${i}`}
                        {@const isActive = i === activeSpokeIndex}

                        {@const code = (spokeCodes?.[i] ?? (i === 16 ? 'E_next' : labels[i]))}
                        {@const labelEmoji = emojiAtLabel(code)}
                        {@const spokeEmoji = emojiAtSpoke(code)}
                        {@const midPt = polarToXY((rInner + rOuter) * 0.56, a)}

                        <g class="spoke" style="pointer-events: none;">
                            <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke="currentColor"
                                    stroke-opacity={isActive ? 0.9 : 0.35}
                                    stroke-width={i % 4 === 0 ? 4 : 2}
                                    stroke-linecap="round"
                            />

                            {#if spokeEmoji}
                                <text class="roleEmoji roleEmojiOnSpoke"
                                      x={midPt.x} y={midPt.y}
                                      text-anchor="middle"
                                      dominant-baseline="middle">
                                    {spokeEmoji}
                                </text>
                            {/if}

                            <!-- интерактив только тут -->
                            <g class="spokeHit"
                               style="pointer-events: all;"
                               role="button"
                               tabindex="0"
                               aria-label={`Spoke ${label}`}
                               on:click={(e) => {
                                   const p = spokePayload(i);
                                   if (!canShowCycleTooltip(p)) return;
                                   tip.openNow(e, p);
                               }}
                               on:dblclick={() => handleSpokeActivate(i)}
                               on:mouseenter={(e) => {
                                   const p = spokePayload(i);
                                   if (!canShowCycleTooltip(p)) return;
                                   tip.hoverEnter(e, p, key);
                               }}
                               on:mouseleave={() => tip.hoverLeave(key)}
                               on:keydown={(e) => {
                                   if (e.key === 'Enter' || e.key === ' ') {
                                       e.preventDefault();
                                       handleSpokeActivate(i);
                                   }
                               }}>
                                <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={VB * 0.046}
                                        fill="transparent"
                                        stroke="currentColor"
                                        class="spokeHalo"
                                        class:activeHalo={isActive}/>

                                {#if labelEmoji}
                                    <text class="roleEmoji roleEmojiOnLabel"
                                          x={pt.x} y={pt.y}
                                          text-anchor="middle"
                                          dominant-baseline="middle">
                                        {labelEmoji}
                                    </text>
                                {:else}
                                    <text class="spokeLabel"
                                          x={pt.x} y={pt.y}
                                          text-anchor="middle"
                                          dominant-baseline="middle"
                                          font-size={VB * 0.035}
                                          fill="currentColor"
                                          fill-opacity={isActive ? 1 : 0.65}>
                                        {label}
                                    </text>
                                {/if}
                            </g>

                            {#if i === 0}
                                {@const pt2 = { x: pt.x + 5, y: pt.y + VB * 0.06 }}
                                {@const key = `spoke:${i}`}
                                {@const ePlusActive = activeSpokeIndex === 16}

                                <!-- E+ отдельная интерактивная зона -->
                                <g class="eplus spokeHit"
                                   style="pointer-events: all;"
                                   role="button"
                                   tabindex="0"
                                   aria-label="Spoke E+"
                                   on:click={(e) => {
                                       const p = spokePayload(16);
                                       if (!canShowCycleTooltip(p)) return;
                                       tip.openNow(e, p);
                                   }}
                                   on:dblclick={() => handleSpokeActivate(16)}
                                   on:mouseenter={(e) => {
                                       const p = spokePayload(16);
                                       if (!canShowCycleTooltip(p)) return;
                                       tip.hoverEnter(e, p, key);
                                   }}
                                   on:mouseleave={() => tip.hoverLeave(key)}
                                   on:keydown={(e) => {
                                       if (e.key === 'Enter' || e.key === ' ') {
                                           e.preventDefault();
                                           handleSpokeActivate(16);
                                       }
                                   }}>
                                    <circle class="spokeHalo"
                                            cx={pt2.x}
                                            cy={pt2.y}
                                            r={VB * 0.034}
                                            fill="transparent"
                                            stroke="currentColor"
                                            class:activeHalo={ePlusActive} />
                                    <text class="spokeLabel eplusLabel"
                                          x={pt2.x} y={pt2.y}
                                          text-anchor="middle"
                                          dominant-baseline="middle"
                                          font-size={VB * 0.034}
                                          fill="currentColor"
                                          fill-opacity={ePlusActive ? 0.9 : 0.55}>E+</text>
                                </g>
                            {/if}

                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    <!-- Markers -->
                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = rInner + (rOuter - rInner) * (c.orbit ?? 0.6)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}

                        <g class="marker"
                           data-marker="1"
                           role="presentation"
                           transform={`translate(${p.x} ${p.y})`}
                           on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                           on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}>
                            <circle r={VB * 0.035} fill="transparent" />
                            <circle r={VB * 0.02} fill={c.bg} stroke="currentColor" stroke-opacity="0.45" stroke-width="3" />
                            <circle r={VB * 0.018} fill="none" stroke="var(--bg)" stroke-opacity="0.5" stroke-width="2" />
                            <text
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={c.count === 1 ? VB * 0.02 : VB * 0.024}
                                    font-weight={c.count === 1 ? 500 : 800}
                                    letter-spacing={c.count === 1 ? 0 : 0.5}
                                    fill="currentColor"
                                    fill-opacity="0.95"
                                    style="pointer-events:none">
                                {c.count === 1 ? c.emoji : c.label}
                            </text>
                        </g>
                    {/each}

                    <!-- Now Moment Pointer -->
                    {#if showNowPointer && !hideNowPointerByWindowLag}
                        <g class="nowPointer" transform={`rotate(${safeAngle(nowDisplayAngle, 0)} ${cx} ${cy})`}>
                            <line x1={cx} y1={cy}
                                  x2={cx + rOuter} y2={cy}
                                  stroke="var(--accent-live)"
                                  stroke-width="10"
                                  stroke-linecap="round"
                                  stroke-opacity="0.35" />
                            <circle cx={cx + rOuter}
                                    cy={cy}
                                    r={VB * 0.018}
                                    fill="var(--accent-live)"
                                    fill-opacity="0.65"
                                    role="button"
                                    tabindex="0"
                                    aria-label="Go LIVE (now)"
                                    on:click|stopPropagation={goLiveFromNowPointer}
                                    on:keydown|stopPropagation={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            goLiveFromNowPointer();
                                        }
                                    }} />
                        </g>
                    {/if}

                    <!-- Current Moment Pointer -->
                    <g transform={`translate(${cx} ${cy})`}>
                        <g class="pointer"
                           class:noTransition={noTransition}
                           style={`transform: rotate(${safeAngle(displayAngle, 0)}deg);`}>
                            <line x1="0" y1="0"
                                  x2={rOuter} y2="0"
                                  stroke="currentColor"
                                  stroke-width="9"
                                  stroke-linecap="round" />
                            <circle cx={rOuter} cy="0"
                                    r={VB * 0.028}
                                    fill="var(--bg)"
                                    stroke="currentColor"
                                    stroke-opacity="0.55"
                                    stroke-width="3" />

                            {#if pointerEmoji}
                                <text class="roleEmoji roleEmojiPointer"
                                      x={rOuter} y="0"
                                      text-anchor="middle"
                                      dominant-baseline="middle">
                                    {pointerEmoji}
                                </text>
                            {/if}
                        </g>
                    </g>

                    {#if centerEmoji}
                        <text
                                class="roleEmoji roleEmojiCenter"
                                x={cx} y={cy}
                                text-anchor="middle"
                                dominant-baseline="middle"
                        >
                            {centerEmoji}
                        </text>
                    {:else}
                        <circle cx={cx} cy={cy} r={VB * 0.012} fill="currentColor" />
                    {/if}
                </svg>

                <div class="cycleNav">
                    <button class="cycleUp navBtn" title="Next Cycle" on:click={() => shiftCycle(1)}>▲</button>
                    <button class="cycleDown navBtn" title="Previous Cycle" on:click={() => shiftCycle(-1)}>▼</button>
                </div>
            </div>

            {#if $tipState.open && $tipState.payload}
                <CycleTooltip
                        x={$tipState.x}
                        y={$tipState.y}
                        payload={$tipState.payload}
                        onPickTs={handleMarkerPick}
                        onClose={tip.closeNow}
                        onEnter={tip.keepOpen}
                        onLeave={tip.scheduleClose}
                />
            {/if}
            </section>
        </div>
    {/if}

    {#if showVisualSection && showInfoSection}
        <div class="sectionSep" aria-hidden="true"></div>
    {/if}

    {#if showInfoSection}
        <div transition:slide|local>
            <CycleInfoBlock
                    generalChips={generalChipsOrdered}
                    currentRow={currentRow}
                    spokeRows={staticSpokeRows}
                    referenceTs={Number.isFinite(localLiveNowTs) ? localLiveNowTs : Date.now()}
                    config={infoConfig}
                    defaultConfig={defaultInfoConfig}
                    spokeOptions={availableSpokeCodes}
                    tagDefs={tagDefs}
                    generalDefs={generalDefs}
                    currentValues={currentValues}
                    staticValues={staticValues}
                onSpokeClick={handleSpokePick}
                onGeneralReorder={handleGeneralReorder}
                onTemplateReorder={handleTemplateReorder}
                onConfigure={applyInfoConfig}
                reorderEnabled={false}
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
    .wheelBox {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: stretch;
        overflow: visible;
        position: relative;
    }

    .wheelBox svg { width: 100%; height: 100%; display: block; overflow: visible; }
    svg { display: block; width: 100%; height: 100%; max-width: none; max-height: none; overflow: visible; }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .tick { cursor: pointer; }
    .tickLine{
        stroke: currentColor;
        stroke-opacity: 0.32;
        stroke-width: 5;
        stroke-linecap: round;
        transition: stroke-opacity 120ms ease;
    }
    .tick:hover .tickLine { stroke-opacity: 0.75; }
    .tick:focus,
    .tick:focus-visible {
        outline: none;
    }
    .tick:focus-visible .tickLine {
        stroke-opacity: 0.75;
    }

    .spokeLabel {
        pointer-events: auto;
        cursor: pointer;
        transition: fill-opacity 120ms ease, font-weight 120ms ease;
    }

    /* Compass-like halos */
    .spokeHalo {
        stroke-opacity: 0.12;
        stroke-width: 2.5;
        filter: none;
        transition: stroke-opacity 120ms ease, filter 120ms ease;
    }
    .spokeHalo.activeHalo {
        stroke-opacity: 0.75;
        stroke-width: 4.5;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .spoke { user-select: none; cursor: default; }

    /* hover только по зоне клика */
    .spokeHit:hover .spokeLabel { fill-opacity: 1; font-weight: 800; }
    .spokeHit:hover .spokeHalo  {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .spokeHit:focus,
    .spokeHit:focus-visible {
        outline: none;
    }
    .spokeHit:focus-visible .spokeHalo {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }

    /* Курсор должен быть на элементе, который реально "ховерится" */
    .spokeHit .spokeHalo { cursor: pointer; pointer-events: all; }
    .spokeHit .spokeLabel { cursor: pointer; pointer-events: none; } /* чтобы текст не перехватывал */

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }

    .pointer {
        transition: transform 420ms ease;
        transform-origin: 0 0;
        will-change: transform;
    }

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

    .rowFill :global(> *) {
        width: 100%;
        min-width: 0;
        display: block;
    }
    .rowFill :global(> *) { margin: 0; }

    /*noinspection CssUnusedSymbol*/
    .pickerRow :global(.face) { margin: 0; }

    .roleEmoji{
        user-select: none;
        pointer-events: none; /* чтобы эмодзи не перехватывало hover/click */
        font-variant-emoji: emoji;
        fill: currentColor;
        opacity: 0.95;
    }

    .roleEmojiCenter{
        font-size: 82px;
        font-weight: 900;
    }

    .roleEmojiPointer{
        font-size: 54px;
        font-weight: 900;
        filter: drop-shadow(0 0 6px rgba(0,0,0,0.6));

    }

    .roleEmojiOnLabel{
        font-size: 70px;
        font-weight: 900;
    }

    .roleEmojiOnSpoke{
        font-size: 26px;
        font-weight: 900;
    }

    .spokeHit:hover .roleEmojiOnLabel{
        opacity: 1;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .nowPointer { transition: transform 420ms ease; }
    .nowPointer circle { cursor: pointer; }
    .nowPointer:hover line,
    .nowPointer:hover circle {
        stroke-opacity: 0.85;
        fill-opacity: 0.9;
    }

    .cycleNav {
        position: absolute;
        top: 4px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .cycleUp,
    .cycleDown {
        width: 34px;
        height: 34px;
    }
</style>
