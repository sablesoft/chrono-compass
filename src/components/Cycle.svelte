<!-- src/components/Cycle.svelte -->
<!--suppress HtmlUnknownTag -->
<script lang="ts">
    import { createWheelGeom, SPOKE_LABELS, safeAngle } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useWheelEffectiveTs } from '../lib/wheel/ui/useEffectiveTs';

    import CycleTooltip from './CycleTooltip.svelte';
    import { useCycleTooltip, type CycleTipPayload } from '../lib/wheel/ui/useCycleTooltip';
    import { PointerAnimator } from '../lib/wheel/pointerAnimator';
    import { useCycleNowPointer } from '../lib/wheel/ui/useCycleNowPointer';

    import { objects, wheels } from '../lib/catalog';
    import type { ObjId, WheelSpec, RoleName, EmojiPlacement, SpokeCode } from '../lib/catalog';

    import DocsModal from './DocsModal.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';
    import WheelHeader from './WheelHeader.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { ms, formatDateTime } from '../lib/format';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    // unified resolver (runtime+idb+compute)
    import { resolveWheel } from '../lib/board/dispatcher';
    import type { CycleSpoke, WheelSolveResult } from '../lib/board/runtime';

    import { DEFAULT_LOCATION_ID, type Location } from '../lib/location/types';
    import { type WheelObserverState, type WheelTimeState, type SpokeKey } from '../lib/wheel/types';

    import { setSelectedTs } from '../lib/time/store';

    import type { MarkerCluster } from '../lib/wheel/wheel';
    import { typeLabel } from '../lib/wheel/control';

    // ------------------------------------------------------------
    // Props (Board passes wheel + location)
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

    function formatDurationHuman(ms0: number) {
        if (!Number.isFinite(ms0) || ms0 <= 0) return '—';

        const totalMinutes = Math.floor(ms0 / 60_000);
        if (totalMinutes <= 0) return '0 minutes';

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

        return parts.length ? parts.join(' ') : '0m';
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
    let spokes: CycleSpoke<any>[] = [];

    let ensureRunId = 0;

    function sortSpokes(xs: CycleSpoke<any>[]) {
        return (xs ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    async function ensureCycleForTs(ts: number) {
        const myRun = ++ensureRunId;

        solveOk = false;
        solveReason = '';

        if (!wheel || !wheelId) {
            solveReason = 'No wheel';
            return;
        }

        const ctx = {
            ts,
            location: isHorizon ? wheelLoc : undefined,
            dbg: { log: dbg.log, warn: dbg.log, error: dbg.log },
        };

        const res: WheelSolveResult = await resolveWheel(wheel as any, ctx);

        if (ensureRunId !== myRun) return;

        if (!res || (res as any).kind !== 'cycle') {
            solveReason = 'Not a cycle result';
            return;
        }

        const r: any = res;
        solveOk = !!r.ok;
        solveReason = r.ok ? '' : (r.reason ?? 'Solve failed');

        // обновляем spokes только когда пришёл валидный ответ
        spokes = sortSpokes(r.spokes ?? []);
    }

    $: {
        void ensureCycleForTs(effTs);
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

    $: showNowPointer = $nowState.show;
    $: nowDisplayAngle = $nowState.displayAngle;

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

    $: cycleDurationHuman = formatDurationHuman(cycleDurationMs);

    function spokePayload(i: number): CycleTipPayload {
        const s = spokes.find(x => x.index === i);
        const code = (i == 16) ? 'E+' : (spokeCodes?.[i] ?? labels[i]);

        const t = spokeTimes?.[i];
        const ts = Number.isFinite(t) ? t : NaN;
        const pickTs = resolveSpokePickTs(i);

        return {
            kind: 'spoke',
            code: String(code),
            ts,
            pickTs: Number.isFinite(pickTs) ? pickTs : undefined,
            meta: (s as any)?.meta
        };
    }

    function boundaryPayload(i: number): CycleTipPayload {
        const from = String(labels[i]);
        const to = String(i === 15 ? 'E+' : labels[i + 1]);

        const t = boundaryTimes?.[i];
        const ts = Number.isFinite(t) ? t : NaN;

        return { kind: 'boundary', from, to, ts };
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

    type EmojiAt = { anchor: UiAnchor; text: string };

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
    $: activeSpokeLabel = activeSpokeCode == 'E_next' ? 'E+' : activeSpokeCode;

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
        dbg.log(`${wheel?.wheelType} ${reason}`, {
            from: new Date(selectedTs).toISOString(),
            to: new Date(ms(ts0)).toISOString(),
            wheelId,
        });
        setSelectedTs(ms(ts0));
        now.refresh?.(`user:${reason}`);
    }

    const SHIFT_EPS_MS = 1500;

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        const t0 = spokeTimes?.[0];
        const t1 = spokeTimes?.[16];
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) return;
        const probe = dir < 0 ? (t0 - SHIFT_EPS_MS) : (t1 + SHIFT_EPS_MS);
        jumpTo(probe, dir < 0 ? 'prevCycle' : 'nextCycle');
    }

    function resolveSpokePickTs(i: number): number {
        const t = spokeTimes?.[i];
        if (!Number.isFinite(t)) return NaN;
        // E+ is the boundary; move slightly forward to force next-cycle solve at E.
        return i === 16 ? (t + SHIFT_EPS_MS) : t;
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
</script>

<section class="panel">
    <WheelHeader wheel={wheel} onDocs={docs.openDocs} onClose={closeCycle}/>

    <div class="wrap" bind:this={wrapEl}>
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
                           on:click={(e) => tip.openNow(e, boundaryPayload(i))}
                           on:dblclick={() => handleBoundaryActivate(i)}
                           on:mouseenter={(e) => tip.hoverEnter(e, boundaryPayload(i), key)}
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
                               on:click={(e) => tip.openNow(e, spokePayload(i))}
                               on:dblclick={() => handleSpokeActivate(i)}
                               on:mouseenter={(e) => tip.hoverEnter(e, spokePayload(i), key)}
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
                                   on:click={(e) => tip.openNow(e, spokePayload(16))}
                                   on:dblclick={() => handleSpokeActivate(16)}
                                   on:mouseenter={(e) => tip.hoverEnter(e, spokePayload(16), key)}
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
                    {#if showNowPointer}
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
                                    on:click|stopPropagation={now.startLive}
                                    on:keydown|stopPropagation={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            now.startLive();
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

    <div class="info">
        <div class="infoRow">
            <button
                    class="infoLine"
                    type="button"
                    title={solveOk ? `Go to ${activeSpokeLabel}` : solveReason || 'Solve failed'}
                    disabled={!solveOk}
                    on:click={() => {
                    const t = spokeTimes?.[activeSpokeIndex];
                    if (Number.isFinite(t)) jumpTo(t, `activeSpoke:${activeSpokeCode}`);
                }}>
                <div class="infoLabel">
                    <span class="labelText">Spoke</span>
                    <span class="chip">{activeSpokeLabel}</span>
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
                    on:click={() => {
                    const t = resolveSpokePickTs(16);
                    Number.isFinite(t) && jumpTo(t, 'cycleEndNext');
                }}
                    on:keydown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && solveOk) {
                        e.preventDefault();
                        const t = resolveSpokePickTs(16);
                        Number.isFinite(t) && jumpTo(t, 'cycleEndNext');
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

    /*noinspection CssUnusedSymbol*/
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
    .padding-right {
        padding-right: 2px;
    }
</style>
