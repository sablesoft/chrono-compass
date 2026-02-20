<!-- src/components/Cycle.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';

    import { createWheelGeom, SPOKE_LABELS, safeAngle } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import CycleTooltip from './CycleTooltip.svelte';
    import { useCycleTooltip, type CycleTipPayload } from '../lib/wheel/ui/useCycleTooltip';
    import { PointerAnimator } from '../lib/wheel/pointerAnimator';
    import { useCycleNowPointer } from '../lib/wheel/ui/useCycleNowPointer';

    import { objects, wheels } from '../lib/catalog';
    import type { ObjId, WheelSpec, RoleName, EmojiPlacement, SpokeCode } from '../lib/catalog';

    import DocsModal from './DocsModal.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { ms, formatDateTime } from '../lib/format';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    import { solveWheel } from '../lib/board/dispatcher';
    import type { WheelSolveResult, CycleSolveResult, CycleSpoke } from '../lib/board/runtime';

    import {DEFAULT_LOCATION_ID, type Location} from '../lib/location/types';
    import type { WheelObserverState, WheelTimeState, SpokeKey } from '../lib/wheel/types';

    import { selectedTs as globalSelectedTs, isLive as globalIsLive, setSelectedTs } from '../lib/time/store';

    import type { MarkerCluster } from '../lib/wheel/wheel';

    // NEW: cycle cache (local + IndexedDB)
    import type { CycleData, CycleKey } from '../lib/cycle/types';
    import {
        makeCycleKey,
        buildCycleDataFromSolve,
        getLocalCycle,
        setLocalCycle,
        clearLocalCycle,
        getPersistentCycle,
        putPersistentCycle
    } from '../lib/cycle/store';
    import {typeLabel} from "../lib/wheel/control";
    import WheelHeader from "./WheelHeader.svelte";

    // ------------------------------------------------------------
    // Props (NEW contract: Board passes wheel + location)
    // ------------------------------------------------------------
    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: Location;
    export let onUserActivity: () => void = () => {};

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
    $: wheelId = wheel?.wheelId;

    $: observer = (wheel?.observer ?? { locationId: DEFAULT_LOCATION_ID, locked: false }) as WheelObserverState;
    $: time = (wheel?.time ?? { live: true, locked: false }) as WheelTimeState;

    // Only “horizon” wheels show location controls for now
    $: isHorizon = wheel?.wheelType === 'horizon';

    // prefer passed-in location (already resolved in Board)
    $: wheelLoc = location;

    function cycleWindowFromSpokes() {
        const a = spokeTimes?.[0];
        const b = spokeTimes?.[16];
        return (Number.isFinite(a) && Number.isFinite(b) && b > a) ? { start: a, end: b } : null;
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
        const bAng = (i === 15) ? (spokeAngleDeg(0) + 360) : spokeAngleDeg(i + 1);

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

    $: showNowPointer = $nowState.show;
    $: nowDisplayAngle = $nowState.displayAngle;

    // чтобы now пересчитывался сразу, когда сменилось окно цикла
    $: {
        const w = cycleWindowFromSpokes();
        now.refresh?.(`deps:${w?.start ?? 'na'}:${w?.end ?? 'na'}`);
    }

    function closeCycle() {
        onUserActivity();
        boardApi.removeWheelById(wheelId, 'Cycle.close');
    }

    // ------------------------------------------------------------
    // Time sync: global <-> wheel time (same as Compass)
    // ------------------------------------------------------------
    let localLiveNowTs = ms(Date.now());
    let localLiveTimer: ReturnType<typeof setInterval> | null = null;
    let localAlignTimer: ReturnType<typeof setTimeout> | null = null;

    function fmtOrDash(ts0: number) {
        return Number.isFinite(ts0) ? formatDateTime(ts0) : '—';
    }

    // “календарная” длительность: годы/месяцы/дни/часы/минуты
    // (без секунд; если меньше единицы — пропускаем; если всё ноль — "0 minutes")
    function formatDurationHuman(ms0: number) {
        if (!Number.isFinite(ms0) || ms0 <= 0) return '—';

        const totalMinutes = Math.floor(ms0 / 60_000);
        if (totalMinutes <= 0) return '0 minutes';

        // Разложим в “приближённые” календарные единицы:
        // 1 month = 30 days (для UI вполне ок), 1 year = 365 days
        let minutes = totalMinutes;

        const MIN_PER_HOUR = 60;
        const MIN_PER_DAY = 24 * MIN_PER_HOUR;
        const MIN_PER_MONTH = 30 * MIN_PER_DAY;
        const MIN_PER_YEAR = 365 * MIN_PER_DAY;

        const years = Math.floor(minutes / MIN_PER_YEAR); minutes -= years * MIN_PER_YEAR;
        const months = Math.floor(minutes / MIN_PER_MONTH); minutes -= months * MIN_PER_MONTH;
        const days = Math.floor(minutes / MIN_PER_DAY); minutes -= days * MIN_PER_DAY;
        const hours = Math.floor(minutes / MIN_PER_HOUR); minutes -= hours * MIN_PER_HOUR;
        const mins = minutes;

        const parts: string[] = [];
        if (years) parts.push(`${years}y`);
        if (months) parts.push(`${months}mo`);
        if (days) parts.push(`${days}d`);
        if (hours) parts.push(`${hours}h`);
        if (mins) parts.push(`${mins}m`);

        // правило “если меньше года — не выводить годы…” уже соблюдается,
        // потому что years будет 0 и не попадёт в parts, и т.д.
        return parts.length ? parts.join(' ') : '0m';
    }

    $: cycleBeginTs = spokeTimes?.[0];
    $: cycleEndTs = spokeTimes?.[16];
    $: cycleDurationMs =
        Number.isFinite(cycleBeginTs) && Number.isFinite(cycleEndTs) && cycleEndTs > cycleBeginTs
            ? (cycleEndTs - cycleBeginTs)
            : NaN;

    $: cycleDurationHuman = formatDurationHuman(cycleDurationMs);

    function clearLocalLiveTimers() {
        if (localAlignTimer) { clearTimeout(localAlignTimer); localAlignTimer = null; }
        if (localLiveTimer) { clearInterval(localLiveTimer); localLiveTimer = null; }
    }

    function startLocalLiveTicker() {
        clearLocalLiveTimers();
        localLiveNowTs = ms(Date.now());

        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);

        localAlignTimer = setTimeout(() => {
            localLiveNowTs = ms(Date.now());
            localLiveTimer = setInterval(() => {
                localLiveNowTs = ms(Date.now());
            }, 60_000);
        }, msToNextMinute + 5);
    }

    $: {
        const needLocalLive = !!time?.locked && !!time?.live;
        if (needLocalLive) startLocalLiveTicker();
        else clearLocalLiveTimers();
    }

    $: effTs =
        !time?.locked
            ? selectedTs
            : time?.live
                ? localLiveNowTs
                : ms((time as any)?.ts ?? selectedTs);

    let globalTs = ms(Date.now());
    let globalLive = true;

    const unsubGTs = globalSelectedTs.subscribe(v => globalTs = v);
    const unsubGLive = globalIsLive.subscribe(v => globalLive = v);

    onDestroy(() => {
        unsubGTs();
        unsubGLive();
        clearLocalLiveTimers();

        // NEW: prevent local cache leaks for destroyed wheel instance
        if (wheelId) clearLocalCycle(wheelId);
    });

    // If wheel time isn't locked -> keep it synced to global time
    $: {
        if (wheelId)
            if (!time?.locked) {
                if (time.live !== globalLive || (time as any).ts !== (globalLive ? (time as any).ts : globalTs)) {
                    boardApi.updateWheelTime(
                        wheelId,
                        globalLive ? { live: true } : { live: false, ts: globalTs },
                        'Cycle.syncWheelTime'
                    );
                }
            }
    }

    // If observer isn't locked -> keep it synced to passed-in location (ONLY for horizon wheels)
    $: {
        if (wheelId && isHorizon)
            if (!observer?.locked && wheelLoc?.id && observer.locationId !== wheelLoc.id) {
                boardApi.updateWheelObserver(wheelId, { locationId: wheelLoc.id }, 'Cycle.syncObserverLocation');
            }
    }

    // ------------------------------------------------------------
    // Geometry (same as Wheel)
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
    // Cycle caching (local + IndexedDB)
    // ------------------------------------------------------------
    $: cycleKey = (wheel ? makeCycleKey(wheel) : null) as CycleKey | null;

    let cycle: CycleData<any> | null = null;

    let solveOk = false;
    let solveReason = '';
    let spokes: CycleSpoke<any>[] = [];

    // guard against async races
    let ensureRunId = 0;

    function sortSpokes(xs: CycleSpoke<any>[]) {
        return (xs ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    async function ensureCycleForTs(ts: number) {
        const myRun = ++ensureRunId;

        solveOk = false;
        solveReason = '';
        spokes = [];
        cycle = null;

        if (!wheel || !wheelId) {
            solveReason = 'No wheel';
            return;
        }

        // We only persist cycles if cycleKey exists (compass/horizon => null)
        const key = cycleKey;

        // If excluded from persistent cache, we still can do a simple compute each time
        // (or you can decide to add a volatile key for local caching later).
        if (!key) {
            const ctx = {
                ts,
                location: isHorizon ? wheelLoc : undefined,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
            };

            const res: WheelSolveResult = solveWheel(wheel as any, ctx);
            if (!res || (res as any).kind !== 'cycle') {
                solveReason = 'Not a cycle result';
                return;
            }

            const r = res as CycleSolveResult<any>;
            solveOk = !!r.ok;
            solveReason = r.ok ? '' : (r as any).reason ?? 'Solve failed';
            spokes = sortSpokes(r.spokes ?? []);
            return;
        }

        // 1) local cache
        const local = getLocalCycle(wheelId, key, ts);
        if (local) {
            // (race guard)
            if (ensureRunId !== myRun) return;

            cycle = local;
            solveOk = true;
            solveReason = '';
            spokes = sortSpokes(local.spokes ?? []);
            return;
        }

        // 2) IndexedDB cache
        try {
            const fromDb = await getPersistentCycle(key, ts);

            if (ensureRunId !== myRun) return;

            if (fromDb) {
                setLocalCycle(wheelId, key, fromDb);
                cycle = fromDb;
                solveOk = true;
                solveReason = '';
                spokes = sortSpokes(fromDb.spokes ?? []);
                return;
            }
        } catch (e) {
            // DB failure should never block UI; we fallback to solveWheel
            dbg.log?.('Cycle.cache.idb.get failed', e);
            if (ensureRunId !== myRun) return;
        }

        // 3) compute via solver
        const ctx = {
            ts,
            location: isHorizon ? wheelLoc : undefined,
            dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
        };

        const res: WheelSolveResult = solveWheel(wheel as any, ctx);

        if (ensureRunId !== myRun) return;

        if (!res || (res as any).kind !== 'cycle') {
            solveReason = 'Not a cycle result';
            return;
        }

        const r = res as CycleSolveResult<any>;
        solveOk = !!r.ok;
        solveReason = r.ok ? '' : (r as any).reason ?? 'Solve failed';

        if (!r.ok) {
            spokes = sortSpokes(r.spokes ?? []);
            return;
        }

        const built = buildCycleDataFromSolve<any>(key, r);
        if (!built) {
            // keep spokes anyway for UI hints
            spokes = sortSpokes(r.spokes ?? []);
            solveOk = false;
            solveReason = 'Cycle build failed';
            return;
        }

        // set local immediately
        setLocalCycle(wheelId, key, built);
        cycle = built;
        spokes = sortSpokes(built.spokes ?? []);

        // save async (don’t block render)
        putPersistentCycle(built).catch((e) => dbg.log?.('Cycle.cache.idb.put failed', e));
    }

    function spokePayload(i: number): CycleTipPayload {
        const s = spokes.find(x => x.index === i);
        const code = (spokeCodes?.[i] ?? (i === 16 ? 'E_next' : labels[i])) as any;
        return {
            kind: 'spoke',
            code: String(code),
            ts: ms(spokeTimes?.[i]),
            meta: (s as any)?.meta
        };
    }

    function boundaryPayload(i: number): CycleTipPayload {
        const from = String(labels[i]);
        const to = String(i === 15 ? 'E+' : labels[i + 1]);
        return {
            kind: 'boundary',
            from,
            to,
            ts: ms(boundaryTimes?.[i]),
        };
    }

    // Recompute ONLY when we must:
    // - effTs changes
    // - wheelId/cycleKey changes
    // - horizon location (because solver depends on it) changes
    $: {
        const ts = effTs;
        const wid = wheelId;
        if (!wid || !wheel) {
            solveOk = false;
            solveReason = 'No wheel';
            spokes = [];
            cycle = null;
        } else {
            // kick async resolver; race-safe via ensureRunId
            void ensureCycleForTs(ts);
        }
    }

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

    type EmojiAt = { anchor: UiAnchor; text: string };

    /**
     * Собираем рендер-план:
     * - spec = wheels[wheelType]
     * - ui = spec.ui
     * - roles = wheel.roles (focus/target/looker)
     * - для target берём первый элемент (как ты делаешь в bind)
     */
    let spec: WheelSpec | null = null;
    let emojiAt: EmojiAt[] = [];

    $: {
        spec = wheel?.wheelType ? (wheels as any)[wheel.wheelType] as WheelSpec : null;

        const ui = (spec as any)?.ui as Partial<Record<RoleName, EmojiPlacement>> | undefined;
        const draws: Array<{ anchor: UiAnchor; emoji: string }> = [];

        const focusId = (wheel?.roles as any)?.focus as ObjId | null;
        const targetRaw = (wheel?.roles as any)?.target as ObjId[] | ObjId | null;
        const targetId = Array.isArray(targetRaw) ? (targetRaw[0] ?? null) : targetRaw;

        if (ui?.focus && focusId) {
            const e = bodyEmoji(focusId);
            if (e) draws.push({ anchor: parsePlacement(ui.focus), emoji: e });
        }

        if (ui?.target && targetId) {
            const e = bodyEmoji(targetId);
            if (e) draws.push({ anchor: parsePlacement(ui.target), emoji: e });
        }

        if (ui?.looker) {
            const lookerId = (wheel?.roles as any)?.looker as ObjId | null;
            const e = bodyEmoji(lookerId);
            if (e) draws.push({ anchor: parsePlacement(ui.looker), emoji: e });
        }

        // merge if several emojis land in same anchor
        const m = new Map<string, { anchor: UiAnchor; parts: string[] }>();
        for (const d of draws) {
            const k = anchorKey(d.anchor);
            const cur = m.get(k) ?? { anchor: d.anchor, parts: [] };
            cur.parts.push(d.emoji);
            m.set(k, cur);
        }

        emojiAt = Array.from(m.values()).map(x => ({ anchor: x.anchor, text: x.parts.join('') }));
    }

    // helpers for SVG queries
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

    let nowWindowKey = 'na';

    $: {
        const a = spokeTimes?.[0];
        const b = spokeTimes?.[16];
        nowWindowKey = (Number.isFinite(a) && Number.isFinite(b) && b > a)
            ? `${a}:${b}`
            : 'na';
    }

    // дергаем пересчет NOW при любом изменении окна, но только когда оно валидно
    $: if (nowWindowKey !== 'na') {
        now.refresh?.(`window:${nowWindowKey}`);
    }

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

    function clamp01(x: number) {
        return x < 0 ? 0 : (x > 1 ? 1 : x);
    }

    $: activeSpokeIndex = spokeTimes?.length ? nearestSpokeIndexByTime(effTs, spokeTimes) : 0;
    $: activeSpokeCode = spokeCodes?.[activeSpokeIndex] ?? ((activeSpokeIndex === 16) ? 'E_next' : (labels[activeSpokeIndex] as any));

    // Pointer angle: piecewise interpolation between spokes
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
        const bAng = (i === 15) ? (spokeAngleDeg(0) + 360) : spokeAngleDeg(i + 1);

        return aAng + (bAng - aAng) * u;
    })();

    // ------------------------------------------------------------
    // Pointer animation (Wheel-style)
    // ------------------------------------------------------------
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

        // IMPORTANT: cycleKey must stay stable while we're inside the same cycle window.
        // We use actual E/E+ to define the window identity for animation logic.
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
        dbg.log(`${wheel?.wheelType} ${reason}`, { from: new Date(selectedTs).toISOString(), to: new Date(ms(ts0)).toISOString() });
        setSelectedTs(ms(ts0));
        now.refresh?.(`user:${reason}`);
    }

    // Nav: use cycle window edges
    const SHIFT_EPS_MS = 1500;

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        const t0 = spokeTimes?.[0];
        const t1 = spokeTimes?.[16];
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) return;
        const probe = dir < 0 ? (t0 - SHIFT_EPS_MS) : (t1 + SHIFT_EPS_MS);
        jumpTo(probe, dir < 0 ? 'prevCycle' : 'nextCycle');
    }

    // ------------------------------------------------------------
    // Tooltip handlers for spokes + boundaries
    // ------------------------------------------------------------
    function handleSpokeActivate(i: number) {
        const t = spokeTimes[i];
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

    // ------------------------------------------------------------
    // Markers (stub for now — we’ll wire to moments later)
    // ------------------------------------------------------------
    let markerClusters: MarkerCluster[] = [];
    markerClusters = [];
</script>

<section class="panel">
    <WheelHeader wheel={wheel} onDocs={docs.openDocs} onClose={closeCycle}/>

    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Cycle Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}
                        {@const payload = boundaryPayload(i)}
                        {@const key = `boundary:${i}`}

                        <g class="tick"
                                role="button"
                                tabindex="0"
                                aria-label={`House boundary ${i + 1}`}
                                on:click={(e) => tip.openNow(e, payload)}
                                on:dblclick={() => handleBoundaryActivate(i)}
                                on:mouseenter={(e) => tip.hoverEnter(e, payload, key)}
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

                    {#each labels as label, i (label)}
                        {@const a = spokeAngleDeg(i)}
                        {@const p1 = polarToXY(rInner, a)}
                        {@const p2 = polarToXY(rOuter, a)}
                        {@const pt = polarToXY(rLabel, a)}
                        {@const payload = spokePayload(i)}
                        {@const key = `spoke:${i}`}
                        {@const isActive = i === activeSpokeIndex}

                        {@const code = (spokeCodes?.[i] ?? (i === 16 ? 'E_next' : labels[i]))}
                        {@const labelEmoji = emojiAtLabel(code)}
                        {@const spokeEmoji = emojiAtSpoke(code)}
                        {@const midPt = polarToXY((rInner + rOuter) * 0.56, a)}

                        <!-- теперь это просто контейнер/рисунок, НЕ кнопка -->
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
                                    on:click={(e) => tip.openNow(e, payload)}
                                    on:dblclick={() => handleSpokeActivate(i)}
                                    on:mouseenter={(e) => tip.hoverEnter(e, payload, key)}
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
                                {@const payload = spokePayload(16)}
                                {@const key = `spoke:${i}`}
                                {@const ePlusActive = activeSpokeIndex === 16}

                                <!-- E+ отдельная интерактивная зона; родитель не ловит hover, потому что pointer-events:none -->
                                <g class="eplus spokeHit"
                                        style="pointer-events: all;"
                                        role="button"
                                        tabindex="0"
                                        aria-label="Spoke E+"
                                        on:click={(e) => tip.openNow(e, payload)}
                                        on:dblclick={() => handleSpokeActivate(16)}
                                        on:mouseenter={(e) => tip.hoverEnter(e, payload, key)}
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
                                            stroke-opacity={ePlusActive ? 0.55 : 0.25}
                                            stroke-width={ePlusActive ? 3 : 2}/>
                                    <text class="spokeLabel eplusLabel"
                                            x={pt2.x} y={pt2.y}
                                            text-anchor="middle"
                                            dominant-baseline="middle"
                                            font-size={VB * 0.034}
                                            fill="currentColor"
                                            fill-opacity={ePlusActive ? 0.9 : 0.55}>
                                        E+
                                    </text>
                                </g>
                            {/if}

                            <!-- это тоже теперь не интерактивно -->
                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = rInner + (rOuter - rInner) * (c.orbit ?? 0.6)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}

                        <g class="marker"
                                data-marker="1"
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

                    {#if showNowPointer}
                        <g class="nowPointer" transform={`rotate(${safeAngle(nowDisplayAngle, 0)} ${cx} ${cy})`}>
                            <line x1={cx} y1={cy}
                                    x2={cx + rOuter} y2={cy}
                                    stroke="var(--accent-live)"
                                    stroke-width="10"
                                    stroke-linecap="round"
                                    stroke-opacity="0.35"/>
                            <circle cx={cx + rOuter}
                                    cy={cy}
                                    r={VB * 0.018}
                                    fill="var(--accent-live)"
                                    fill-opacity="0.65"
                                    role="button"
                                    tabindex="0"
                                    aria-label="Go LIVE (now)"
                                    on:click|stopPropagation={now.startLive}
                                    on:keydown|stopPropagation={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          now.startLive();
                                        }
                                      }}/>
                        </g>
                    {/if}

                    <!-- Pointer -->
                    <g transform={`translate(${cx} ${cy})`}>
                        <g class="pointer"
                                class:noTransition={noTransition}
                                style={`transform: rotate(${safeAngle(displayAngle, 0)}deg);`}>
                            <line x1="0" y1="0"
                                    x2={rOuter} y2="0"
                                    stroke="currentColor"
                                    stroke-width="9"
                                    stroke-linecap="round"/>
                            <!-- белый кружок указателя -->
                            <circle cx={rOuter} cy="0"
                                    r={VB * 0.028}
                                    fill="var(--bg)"
                                    stroke="currentColor"
                                    stroke-opacity="0.55"
                                    stroke-width="3"/>

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
                />
            {/if}
        </section>
    </div>

    <div class="info">
        <div class="infoRow">
            <button
                    class="infoLine"
                    type="button"
                    title={solveOk ? `Go to ${activeSpokeCode}` : solveReason || 'Solve failed'}
                    disabled={!solveOk}
                    on:click={() => {
                      const t = spokeTimes?.[activeSpokeIndex];
                      if (Number.isFinite(t)) jumpTo(t, `activeSpoke:${activeSpokeCode}`);
                    }}>
                <div class="infoLabel">
                    <span class="labelText">Spoke</span>
                    <span class="chip">{activeSpokeCode}</span>
                </div>
                <div class="infoValue">{solveOk ? formatDateTime(spokeTimes?.[activeSpokeIndex]) : (solveReason || 'No data')}</div>
            </button>
        </div>
        <div class="infoRow">
            <div
                    class="infoLine"
                    role="button"
                    tabindex="0"
                    aria-label="Go to Begin (E)"
                    class:disabledLine={!solveOk}
                    on:click={() => Number.isFinite(cycleBeginTs) && jumpTo(cycleBeginTs, 'cycleBegin')}
                    on:keydown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && solveOk) {
                        e.preventDefault();
                        Number.isFinite(cycleBeginTs) && jumpTo(cycleBeginTs, 'cycleBegin');
                      }
                    }}>
                <div class="infoLabel">
                    <span class="labelText">Begin</span>
                    <span class="chip">E</span>
                </div>
                <div class="infoValue">{solveOk ? fmtOrDash(cycleBeginTs) : (solveReason || 'No data')}</div>
            </div>
        </div>

        <div class="infoRow">
            <div
                    class="infoLine"
                    role="button"
                    tabindex="0"
                    aria-label="Go to End (E+)"
                    class:disabledLine={!solveOk}
                    on:click={() => Number.isFinite(cycleEndTs) && jumpTo(cycleEndTs, 'cycleEnd')}
                    on:keydown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && solveOk) {
                        e.preventDefault();
                        Number.isFinite(cycleEndTs) && jumpTo(cycleEndTs, 'cycleEnd');
                      }
                    }}>
                <div class="infoLabel">
                    <span class="labelText">End</span>
                    <span class="chip">E+</span>
                </div>
                <div class="infoValue">{solveOk ? fmtOrDash(cycleEndTs) : (solveReason || 'No data')}</div>
            </div>
        </div>

        <div class="infoRow">
            <div class="infoLine staticLine">
                <div class="infoLabel">
                    <span class="labelText">Duration</span>
                </div>
                <div class="infoValue">{solveOk ? cycleDurationHuman : '—'}</div>
            </div>
        </div>

        {#if isHorizon}
            <div class="padding-right">
                <div class="rowFill">
                    <LocationPicker
                            value={wheelLoc}
                            locked={observer.locked}
                            onChange={(loc, meta) => {
              onUserActivity();
              const patch: Partial<WheelObserverState> = {
                locationId: meta.savedId,
                locked: meta.lockOnApply ? true : observer.locked
              };
              dbg.log?.('Cycle.location.apply', { patch });
              boardApi.updateWheelObserver(wheelId, patch, 'Cycle.location.apply');
            }}
                            onToggleLock={(next) => {
              onUserActivity();
              boardApi.updateWheelObserver(wheelId, { locked: next }, 'Cycle.location.lock');
            }}
                    />
                </div>
            </div>
        {/if}

        <div class="padding-right">
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
            boardApi.updateWheelTime(wheelId, patch, 'Cycle.time.apply');
          }}
                        onToggleLock={(next) => {
            onUserActivity();
            boardApi.updateWheelTime(wheelId, { locked: next }, 'Cycle.time.lock');
          }}
                />
            </div>
        </div>
    </div>
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
        padding: 14px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    .wrap {
        width: 100%;
        max-width: 100%;
        flex: 0 0 auto;
        min-height: 0;
    }
    .wheelPanel { display: grid; gap: 10px; width: 100%; justify-items: center; }
    .wheelBox {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: stretch;
        overflow: hidden;
        position: relative;
    }

    .wheelBox svg { width: 100%; height: 100%; display: block; }
    svg { display: block; width: 100%; height: 100%; max-width: none; max-height: none; }

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

    .infoRow {
        display: grid;
        grid-template-columns: 1fr;
        align-items: center;
        gap: 10px;
        padding: 4px 6px;
        border-radius: 10px;
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 90%);
    }
    .rowFill{
        min-width: 0;
        width: 100%;
        display: block;
    }

    .rowFill :global(> *) {
        width: 100%;
        min-width: 0;
        display: block;
    }
    .rowFill :global(> *) { margin: 0; }

    .infoRow :global(.face) {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
    }
    .infoLine{
        display: grid;
        grid-template-columns: 130px 1fr; /* ← фиксируешь “левую” колонку */
        align-items: center;
        gap: 10px;
        padding: 4px 8px;
        background: transparent;
        border: none;
    }

    .infoLine:not(.staticLine){
        cursor: pointer;
    }

    .infoLine:not(.staticLine):hover{
        background: rgba(255,255,255,0.05);
    }

    .disabledLine{
        opacity: 0.55;
        cursor: default;
        pointer-events: none;
    }

    .infoLabel{
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .labelText{
        font-weight: 700;
        opacity: 0.9;
    }

    .chip{
        font-weight: 700;
        font-size: 0.85em;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        opacity: 0.85;
    }

    .infoValue{
        text-align: right;        /* ← чтобы даты ровно по правому краю */
        font-variant-numeric: tabular-nums; /* ← ровные цифры, сильный win */
        opacity: 0.9;
        min-width: 0;
    }

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
        font-size: 30px;
        font-weight: 900;
    }

    .roleEmojiOnSpoke{
        font-size: 26px;
        font-weight: 900;
    }

    .spokeHit:hover .roleEmojiOnLabel,
    .spokeHit:hover .roleEmojiOnSpoke{
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
    .padding-right {
        padding-right: 2px;
    }
</style>
