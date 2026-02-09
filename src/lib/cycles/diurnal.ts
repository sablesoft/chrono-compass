// src/lib/cycles/diurnal.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from '../wheel/spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { debug } from '../debug';

const dbg = debug('diurnal', '🌎');
const { group, log, warn } = dbg;

let CALL_SEQ = 0;

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

function isFiniteTs(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function makeObserver(lat: number, lon: number, heightMeters = 0) {
    return new Astronomy.Observer(lat, lon, heightMeters);
}

function sunAltitudeDeg(ts: number, obs: Astronomy.Observer): number {
    const date = new Date(ts);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
    const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    return hor.altitude;
}

function findExtremumMs(opts: {
    t0: number;
    t1: number;
    obs: Astronomy.Observer;
    kind: 'max' | 'min';
    coarseStepMs?: number;
    refineIters?: number;
}): number | null {
    const { t0, t1, obs, kind, coarseStepMs = 10 * 60_000, refineIters = 50 } = opts;
    if (!(t1 > t0)) return null;

    const alt = (t: number) => sunAltitudeDeg(t, obs);

    let bestT = t0;
    let bestV = alt(t0);
    if (!Number.isFinite(bestV)) return null;

    for (let t = t0; t <= t1; t += coarseStepMs) {
        const v = alt(t);
        if (!Number.isFinite(v)) continue;
        const better = kind === 'max' ? v > bestV : v < bestV;
        if (better) {
            bestV = v;
            bestT = t;
        }
    }

    let lo = Math.max(t0, bestT - coarseStepMs);
    let hi = Math.min(t1, bestT + coarseStepMs);

    for (let i = 0; i < refineIters; i++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        const v1 = alt(m1);
        const v2 = alt(m2);
        if (!Number.isFinite(v1) || !Number.isFinite(v2)) break;

        if (kind === 'max') {
            if (v1 < v2) lo = m1;
            else hi = m2;
        } else {
            if (v1 > v2) lo = m1;
            else hi = m2;
        }
    }

    return ms((lo + hi) / 2);
}

/**
 * Строго ищем ПЕРЕСЕЧЕНИЕ (sign-change) altitude(center) = targetAltDeg.
 * grazing (касание без смены знака) автоматически игнорируется.
 *
 * rising=true: - -> +
 * rising=false: + -> -
 *
 * mode:
 *  - "first": первое пересечение в окне
 *  - "last": последнее пересечение в окне
 */
function findAltitudeCrossingMs(opts: {
    t0: number;
    t1: number;
    obs: Astronomy.Observer;
    targetAltDeg: number;
    rising: boolean;
    mode: 'first' | 'last';
    coarseStepMs?: number;
    refineEpsMs?: number;
}): number | null {
    const {
        t0,
        t1,
        obs,
        targetAltDeg,
        rising,
        mode,
        coarseStepMs = 10 * 60_000,
        refineEpsMs = 1000,
    } = opts;

    const f = (t: number) => sunAltitudeDeg(t, obs) - targetAltDeg;

    let prevT = t0;
    let prevF = f(prevT);
    if (!Number.isFinite(prevF)) return null;

    let found: number | null = null;

    for (let t = t0 + coarseStepMs; t <= t1; t += coarseStepMs) {
        const curT = t;
        const curF = f(curT);
        if (!Number.isFinite(curF)) return null;

        // Строгое пересечение: разные знаки или (на границе) допускаем 0 как “внутри”,
        // но только если сосед по другую сторону имеет противоположный знак.
        const crosses = rising
            ? (prevF < 0 && curF >= 0) || (prevF <= 0 && curF > 0)
            : (prevF > 0 && curF <= 0) || (prevF >= 0 && curF < 0);

        if (crosses) {
            // refine binary on [prevT, curT]
            let lo = prevT;
            let hi = curT;
            let flo = prevF;
            let fhi = curF;

            // гарантируем, что брекет содержит sign-change, иначе это может быть grazing на 0
            if (!(Number.isFinite(flo) && Number.isFinite(fhi))) return null;
            if (Math.sign(flo) === Math.sign(fhi) && flo !== 0 && fhi !== 0) {
                // не должно происходить при crosses=true, но на всякий
                prevT = curT;
                prevF = curF;
                continue;
            }

            while (hi - lo > refineEpsMs) {
                const mid = (lo + hi) / 2;
                const fmid = f(mid);
                if (!Number.isFinite(fmid)) return null;

                // выбираем половину, где сохраняется sign-change относительно цели rising/setting
                if (rising) {
                    if (fmid >= 0) {
                        hi = mid;
                        fhi = fmid;
                    } else {
                        lo = mid;
                        flo = fmid;
                    }
                } else {
                    if (fmid <= 0) {
                        hi = mid;
                        fhi = fmid;
                    } else {
                        lo = mid;
                        flo = fmid;
                    }
                }
            }

            const hit = ms(hi);
            if (mode === 'first') return hit;
            found = hit;
        }

        prevT = curT;
        prevF = curF;
    }

    return found;
}

// --- Полярная логика: всегда строим цикл по соседним восходам вокруг ts ---

const DAY_MS = 86400_000;

// “Видимый” восход/закат: верхний край касается горизонта.
// Horizon(...,"normal") учитывает рефракцию => целимся в altitude(center) = -R_sun.
const SOLAR_RADIUS_DEG = 16 / 60; // ~0.266666...
const TARGET_ALT_DEG = -SOLAR_RADIUS_DEG;

// Сколько дней максимум ищем событие вперёд/назад.
// 400 даёт запас даже для жестких полярных зон.
const SEARCH_LIMIT_DAYS = 400;

// Фильтр “слишком коротких” фаз (как ты предложил).
// Делай маленьким, иначе можно убить реальные короткие дни на границе полярного круга.
const MIN_PHASE_MS = 60_000; // 2 минуты

type RiseSetCycle = {
    E: number;        // sunrise
    W: number;        // sunset
    E_next: number;   // next sunrise
    N: number;        // max altitude on [E,W]
    S: number;        // min altitude on [W,E_next]
};

function findNextCrossing(
    tStart: number,
    lat: number,
    lon: number,
    rising: boolean,
): number | null {
    const obs = makeObserver(lat, lon, 0);

    // На маленьких длительностях (рядом с полярным кругом) пересечение может быть очень узким.
    // Поэтому используем адаптивный coarseStep: обычно 10 мин, но если не находим — уменьшаем.
    const steps = [10 * 60_000, 5 * 60_000, 2 * 60_000, 60_000];

    for (let dayOffset = 0; dayOffset <= SEARCH_LIMIT_DAYS; dayOffset++) {
        const t0 = ms(tStart + dayOffset * DAY_MS);
        const t1 = ms(t0 + DAY_MS);

        for (const coarseStepMs of steps) {
            const hit = findAltitudeCrossingMs({
                t0,
                t1,
                obs,
                targetAltDeg: TARGET_ALT_DEG,
                rising,
                mode: 'first',
                coarseStepMs,
            });
            if (isFiniteTs(hit)) return hit;
        }
    }
    return null;
}

function findPrevCrossing(
    tEnd: number,
    lat: number,
    lon: number,
    rising: boolean,
): number | null {
    const obs = makeObserver(lat, lon, 0);
    const steps = [10 * 60_000, 5 * 60_000, 2 * 60_000, 60_000];

    for (let dayOffset = 0; dayOffset <= SEARCH_LIMIT_DAYS; dayOffset++) {
        const t1 = ms(tEnd - dayOffset * DAY_MS);
        const t0 = ms(t1 - DAY_MS);

        for (const coarseStepMs of steps) {
            const hit = findAltitudeCrossingMs({
                t0,
                t1,
                obs,
                targetAltDeg: TARGET_ALT_DEG,
                rising,
                mode: 'last',
                coarseStepMs,
            });
            if (isFiniteTs(hit)) return hit;
        }
    }
    return null;
}

function computeCycleAroundTs(ts: number, lat: number, lon: number): RiseSetCycle | null {
    const obs = makeObserver(lat, lon, 0);

    // 1) Берём E как последний восход до/в ts
    let E = findPrevCrossing(ts, lat, lon, true);
    if (!isFiniteTs(E)) return null;

    // 2) Берём E_next как следующий восход после ts (не после E!)
    // Это даёт именно “рамку вокруг ts”: E <= ts < E_next.
    let E_next = findNextCrossing(ts + 1, lat, lon, true);
    if (!isFiniteTs(E_next)) return null;

    // Если вдруг нашли E_next раньше E (в теории не должно), пробуем оттолкнуться от E
    if (E_next <= E) {
        E_next = findNextCrossing(E + 1, lat, lon, true);
        if (!isFiniteTs(E_next) || E_next <= E) return null;
    }

    // Если E и E_next почти совпали — это похоже на “пограничную грязь”.
    // Игнорируем и берём следующий E_next дальше.
    let safety = 0;
    while (E_next - E < MIN_PHASE_MS && safety++ < 5) {
        const next = findNextCrossing(E_next + 1, lat, lon, true);
        if (!isFiniteTs(next)) break;
        E_next = next;
    }

    // 3) Находим W строго между E и E_next как первый закат после E
    let W: number | null = null;
    {
        // Сначала пробуем искать вперёд от E в пределах [E, E_next]
        const steps = [10 * 60_000, 5 * 60_000, 2 * 60_000, 60_000];
        for (const coarseStepMs of steps) {
            const hit = findAltitudeCrossingMs({
                t0: E,
                t1: E_next,
                obs,
                targetAltDeg: TARGET_ALT_DEG,
                rising: false,
                mode: 'first',
                coarseStepMs,
            });
            if (isFiniteTs(hit)) {
                W = hit;
                break;
            }
        }

        // Если не нашли (численно/на границе) — расширяем поиск по дням,
        // но запрещаем уходить за E_next: нам нужен W внутри цикла E..E_next.
        if (!isFiniteTs(W)) {
            // Здесь физика говорит “W должен быть”, но численность может мешать.
            // Мы просто признаём неудачу: в таком случае цикл считаем неустойчивым.
            return null;
        }
    }

    // 4) Фильтры коротких фаз: если день или ночь слишком короткие — пропускаем “мусорное” событие.
    // Под “мусорным” здесь обычно понимается пограничная зона около касания.
    // Реализация: если день короткий — берём следующий закат после текущего W (внутри E..E_next уже нельзя),
    // поэтому корректнее сдвинуть весь цикл: E := W? нет. Лучше: перепостроить рамку вокруг ts, но с ts сдвинутым.
    //
    // Чтобы не усложнять до бесконечности: делаем локальную стратегию:
    // - если день < MIN => сдвигаем ts немного вперёд и пересчитываем рамку.
    // - если ночь < MIN => сдвигаем ts немного назад и пересчитываем рамку.
    //
    // Это сохраняет “рамку вокруг ts” и избегает бесконечных прыжков.
    const dayLen = W - E;
    const nightLen = E_next - W;

    if (dayLen < MIN_PHASE_MS) {
        const bumped = ms(Math.min(E_next - 1, ts + MIN_PHASE_MS));
        return computeCycleAroundTs(bumped, lat, lon);
    }
    if (nightLen < MIN_PHASE_MS) {
        const bumped = ms(Math.max(E + 1, ts - MIN_PHASE_MS));
        return computeCycleAroundTs(bumped, lat, lon);
    }

    // 5) N и S как экстремумы на своих половинах
    const N = findExtremumMs({ t0: E, t1: W, obs, kind: 'max' });
    const S = findExtremumMs({ t0: W, t1: E_next, obs, kind: 'min' });
    if (!isFiniteTs(N) || !isFiniteTs(S)) return null;

    log('computeCycleAroundTs result', {
        ts: fmt(ts),
        E: fmt(E),
        W: fmt(W!),
        E_next: fmt(E_next),
        dayLenH: ((W! - E) / 3600_000).toFixed(3),
        nightLenH: ((E_next - W!) / 3600_000).toFixed(3),
        N: fmt(N!),
        S: fmt(S!),
    });

    return { E: ms(E), W: ms(W), E_next: ms(E_next), N: ms(N), S: ms(S) };
}

// “Диурнальный” цикл: от E (sunrise) до E_next (next sunrise), но может быть очень длинным/коротким.
export function getDayAnchors(ts: number, lat: number, lon: number): Anchors {
    ts = ms(ts);
    const callId = ++CALL_SEQ;

    return group(`ts=${fmt(ts)} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)}`, () => {
        log(`[#${callId}] getDayAnchors ENTER`, { ts: fmt(ts), lat, lon });
        const cycle = computeCycleAroundTs(ts, lat, lon);

        if (!cycle) {
            // Если мы не нашли вообще пересечений в пределах SEARCH_LIMIT_DAYS — это истинный полярный режим.
            // В отличие от прошлой версии, мы не делаем “24h от ts” (это ломает смысл).
            // Здесь лучше вернуть деградированный, но детерминированный цикл на solarNoon->next solarNoon.
            // Однако ты просил плясать от E/W — значит честнее: предупреждение и всё-таки fallback,
            // чтобы UI не умер.
            warn(`[#${callId}] computeCycleAroundTs -> null (fallback)`, { ts: fmt(ts), lat, lon });
            warn('polar: no rise/set crossings found within search window; fallback to ts-based 24h anchors', {
                ts: fmt(ts),
                lat,
                lon,
                limitDays: SEARCH_LIMIT_DAYS,
            });

            const start = ms(ts - (ts % DAY_MS));
            const end = ms(start + DAY_MS);
            const E = start;
            const N = ms(start + 6 * 3600_000);
            const W = ms(start + 12 * 3600_000);
            const S = ms(start + 18 * 3600_000);
            const E_next = end;
            return { start: E, end: E_next, E, N, W, S, E_next };
        }

        const anchors: Anchors = {
            start: cycle.E,
            end: cycle.E_next,

            E: cycle.E,
            N: cycle.N,
            W: cycle.W,
            S: cycle.S,

            E_next: cycle.E_next,
        };

        (anchors as any).__trace = { callId, ts, lat, lon, cycle };

        log(`[#${callId}] getDayAnchors RETURN`, {
            ts: fmt(ts),
            E: fmt(anchors.E),
            N: fmt(anchors.N),
            W: fmt(anchors.W),
            S: fmt(anchors.S),
            E_next: fmt(anchors.E_next),
        });

        if (!(anchors.E < anchors.N && anchors.N < anchors.W && anchors.W < anchors.S && anchors.S < anchors.E_next)) {
            warn('non-monotonic diurnal anchors', {
                E: fmt(anchors.E),
                N: fmt(anchors.N),
                W: fmt(anchors.W),
                S: fmt(anchors.S),
                E_next: fmt(anchors.E_next),
            });
        } else {
            log('diurnal anchors', {
                E: fmt(anchors.E),
                N: fmt(anchors.N),
                W: fmt(anchors.W),
                S: fmt(anchors.S),
                E_next: fmt(anchors.E_next),
                dayLenH: ((anchors.W - anchors.E) / 3600_000).toFixed(3),
                nightLenH: ((anchors.E_next - anchors.W) / 3600_000).toFixed(3),
            });
        }

        return anchors;
    }) as Anchors;
}

export const angleFromDayAnchors = angleFromAnchors;
