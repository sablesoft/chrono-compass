// src/lib/cycle/store.ts

import type { CycleSolveResult, CycleSpoke } from '../board/runtime';
import { ms } from '../format';
import { envBool } from '../env';

import type { CycleData, CacheWheelLike, CacheKey} from './types';

/* ============================================================
   Public persistent API (wheelLike -> key inside)
   ============================================================ */

export async function getCycle(wheel: CacheWheelLike, ts: number): Promise<CycleData | null> {
    if (!isCacheEnabledForWheel(wheel)) return null;

    // 1) runtime
    const r = runtimeGet(wheel, ts);
    if (r) return r;

    // 2) persistent
    const p = await persistentGet(wheel, ts);
    if (p) {
        // обновляем runtime "последним" найденным циклом
        runtimePut(p);
        return p;
    }

    return null;
}

export async function putCycleSolved<Meta = any>(
    wheel: CacheWheelLike,
    solve: CycleSolveResult<Meta>,
    opts?: { persist?: boolean }
): Promise<CycleData<Meta> | null> {
    if (!isCacheEnabledForWheel(wheel)) return null;

    let cycle = buildCycleDataFromSolve(wheel, solve);
    if (!cycle) return null;

    cycle = alignCycleWithRuntimeNeighbor(cycle);
    runtimePut(cycle);

    if (opts?.persist !== false) {
        cycle = await persistentPut(cycle) as CycleData<Meta>;
        runtimePut(cycle);
    }

    return cycle;
}

// -----------

const ENABLE_CYCLE_IDB = envBool('CYCLE_IDB', true);
const CYCLE_CACHE_EXCLUDED_TYPES = new Set<string>(['compass', 'system']);
const DB_NAME = 'chrono_compass_cycle_cache';
const DB_VERSION = 2;
const CYCLE_CACHE_UID = 'cycle-cache-2026-02-28-b';
const STORE_CYCLES = 'cycles';
const STORE_META = 'meta';
const META_KEY_CACHE_UID = 'cycle_cache_uid';
const MAX_CYCLES_PER_KEY = 256;
const MAX_CYCLES_TOTAL = 5000;
const CYCLE_TS_BUCKET_MS = 10_000;
const BOUNDARY_SNAP_TOLERANCE_MS = 2 * CYCLE_TS_BUCKET_MS;
const STORAGE_SOFT_LIMIT_PCT = 0.7;
const STORAGE_TARGET_PCT = 0.6;
const STORAGE_CLEANUP_BATCH_MIN = 64;

const runtime = new Map<CacheKey, CycleData<any>>();

type CycleRecord = {
    cacheKey: string;
    startTs: number;
    endTs: number;
    spokes: CycleSpoke<any>[];
    createdAt: number;
    updatedAt: number;
    [k: string]: any;
};

type MetaRecord = {
    key: string;
    value: any;
};

function buildCycleDataFromSolve<Meta = any>(
    wheel: CacheWheelLike,
    solve: CycleSolveResult<Meta>,
): CycleData<Meta> | null {
    if (!solve?.ok) return null;

    const cacheKey = makeCacheKey(wheel);

    const spokes = (solve.spokes ?? [])
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((s) => ({ ...s, ts: roundToBucketMs(s.ts, CYCLE_TS_BUCKET_MS) }));
    if (!spokes.length) return null;

    const s0 = spokes.find((s) => s.index === 0);
    const s16 = spokes.find((s) => s.index === 16);

    let startTs = s0?.ts;
    let endTs = s16?.ts;

    if (!isFiniteNum(startTs) || !isFiniteNum(endTs)) return null;
    if (!(endTs > startTs)) {
        endTs = startTs + CYCLE_TS_BUCKET_MS;
    }

    setSpokeTs(spokes as CycleSpoke<any>[], 0, startTs);
    setSpokeTs(spokes as CycleSpoke<any>[], 16, endTs);

    const t = nowMs();

    return {
        cacheKey,
        startTs: ms(startTs),
        endTs: ms(endTs),
        spokes,
        createdAt: t,
        updatedAt: t,
    };
}

function roundToBucketMs(ts: number, bucketMs: number): number {
    if (!isFiniteNum(ts)) return NaN;
    return Math.round(ts / bucketMs) * bucketMs;
}

function setSpokeTs(spokes: CycleSpoke<any>[], index: number, ts: number): void {
    const i = spokes.findIndex((s) => (s.index ?? -1) === index);
    if (i < 0) return;
    spokes[i] = { ...spokes[i], ts };
}

function snapBoundaryToNeighbor(candidate: number, neighbor: number, toleranceMs = BOUNDARY_SNAP_TOLERANCE_MS): number {
    if (!isFiniteNum(candidate) || !isFiniteNum(neighbor)) return candidate;
    return Math.abs(candidate - neighbor) <= toleranceMs ? neighbor : candidate;
}

function alignCycleWithKnownBoundaries(cycle: CycleData, prevEndTs?: number, nextStartTs?: number): CycleData {
    let startTs = cycle.startTs;
    let endTs = cycle.endTs;
    const spokes = (cycle.spokes ?? []).map((s) => ({ ...s }));

    if (isFiniteNum(prevEndTs)) startTs = snapBoundaryToNeighbor(startTs, prevEndTs);
    if (isFiniteNum(nextStartTs)) endTs = snapBoundaryToNeighbor(endTs, nextStartTs);

    if (!(endTs > startTs)) endTs = startTs + CYCLE_TS_BUCKET_MS;

    setSpokeTs(spokes, 0, startTs);
    setSpokeTs(spokes, 16, endTs);

    return { ...cycle, startTs, endTs, spokes };
}

function alignCycleWithRuntimeNeighbor(cycle: CycleData): CycleData {
    const known = runtime.get(cycle.cacheKey);
    if (!known) return cycle;

    let prevEndTs: number | undefined = undefined;
    let nextStartTs: number | undefined = undefined;

    // Same-cycle stabilization.
    if (Math.abs(cycle.startTs - known.startTs) <= BOUNDARY_SNAP_TOLERANCE_MS) {
        nextStartTs = known.startTs;
    }
    if (Math.abs(cycle.endTs - known.endTs) <= BOUNDARY_SNAP_TOLERANCE_MS) {
        prevEndTs = known.endTs;
    }

    // Neighbor-cycle stabilization (only when boundaries are close enough).
    if (Math.abs(cycle.startTs - known.endTs) <= BOUNDARY_SNAP_TOLERANCE_MS) {
        prevEndTs = known.endTs;
    }
    if (Math.abs(cycle.endTs - known.startTs) <= BOUNDARY_SNAP_TOLERANCE_MS) {
        nextStartTs = known.startTs;
    }

    return alignCycleWithKnownBoundaries(cycle, prevEndTs, nextStartTs);
}

function roleToKeyPart(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch { return String(v); }
}

function targetToKeyPart(target: any): string {
    // контракт: target влияет только “первым” значением
    if (Array.isArray(target)) return roleToKeyPart(target[0]);
    return roleToKeyPart(target);
}

function observerToKeyPart(observer?: { locationId?: string }): string {
    return observer?.locationId ? String(observer.locationId) : '';
}

/**
 * Universal cache key for cycle computations.
 * Contract: wheelType + roles(looker/focus/target[0]) + observer.locationId
 */
function makeCacheKey(w: CacheWheelLike): CacheKey {
    const wt = String(w?.wheelType ?? '');
    const roles = (w as any)?.roles ?? {};
    const looker = roleToKeyPart(roles.looker);
    const focus = roleToKeyPart(roles.focus);
    const target = targetToKeyPart(roles.target);
    const loc = observerToKeyPart(w?.observer);

    return `${wt}:${looker}:${focus}:${target}:@${loc}` as CacheKey;
}

function isCacheEnabledForWheel(w: CacheWheelLike): boolean {
    const t = String(w?.wheelType ?? '');
    return !!t && !CYCLE_CACHE_EXCLUDED_TYPES.has(t);
}

function isFiniteNum(x: any): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function nowMs(): number {
    return ms(Date.now());
}

function distanceFromPresent(row: Pick<CycleRecord, 'startTs' | 'endTs'>, nowTs: number): number {
    return Math.min(Math.abs(row.startTs - nowTs), Math.abs(row.endTs - nowTs));
}

function sortByFarthestFromPresent(rows: CycleRecord[], nowTs: number): CycleRecord[] {
    return rows.sort((a, b) => {
        const da = distanceFromPresent(a, nowTs);
        const db = distanceFromPresent(b, nowTs);
        if (da !== db) return db - da;
        return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
    });
}

function isQuotaExceededError(err: unknown): boolean {
    if (!err) return false;
    if (err instanceof DOMException) {
        return err.name === 'QuotaExceededError' || err.code === 22;
    }
    const msg = String((err as any)?.name ?? '') + ' ' + String((err as any)?.message ?? '');
    return /quota/i.test(msg);
}

async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator === 'undefined') return null;
    const estimateFn = navigator?.storage?.estimate;
    if (typeof estimateFn !== 'function') return null;
    try {
        const e = await estimateFn.call(navigator.storage);
        const usage = Number(e?.usage);
        const quota = Number(e?.quota);
        if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null;
        return { usage, quota };
    } catch {
        return null;
    }
}

function coversTs(c: CycleData, ts: number): boolean {
    return isFiniteNum(ts) && ts >= c.startTs && ts <= c.endTs;
}

function runtimeGet(wheel: CacheWheelLike, ts: number): CycleData | null {
    const key = makeCacheKey(wheel);
    const hit = runtime.get(key);
    if (!hit) return null;
    return coversTs(hit, ts) ? hit : null;
}

function runtimePut(cycle: CycleData): void {
    runtime.set(cycle.cacheKey, { ...cycle, updatedAt: nowMs() });
}

/* ============================================================
   IndexedDB (persistent cache)
   ============================================================ */

let _dbPromise: Promise<IDBDatabase> | null = null;
let _cacheInitPromise: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;

            if (!db.objectStoreNames.contains(STORE_CYCLES)) {
                const store = db.createObjectStore(STORE_CYCLES, { keyPath: ['cacheKey', 'startTs'] });
                store.createIndex('by_cycle_start', ['cacheKey', 'startTs'], { unique: true });
                store.createIndex('by_cycleKey', 'cacheKey', { unique: false });
                store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });

    return _dbPromise;
}

export async function initCycleCacheStorage(): Promise<void> {
    if (!ENABLE_CYCLE_IDB) return;
    if (typeof indexedDB === 'undefined') return;
    if (_cacheInitPromise) return _cacheInitPromise;

    _cacheInitPromise = (async () => {
        const db = await openDb();
        const tx = db.transaction([STORE_META, STORE_CYCLES], 'readwrite');
        const meta = tx.objectStore(STORE_META);
        const cycles = tx.objectStore(STORE_CYCLES);

        const rec = await reqToPromise(meta.get(META_KEY_CACHE_UID as any) as IDBRequest<MetaRecord | undefined>);
        const currentUid = typeof rec?.value === 'string' ? rec.value : '';

        if (!currentUid || currentUid !== CYCLE_CACHE_UID) {
            cycles.clear();
            meta.put({
                key: META_KEY_CACHE_UID,
                value: CYCLE_CACHE_UID,
            } satisfies MetaRecord as any);
            runtime.clear();
        }

        await txDone(tx);
    })();

    try {
        await _cacheInitPromise;
    } catch (err) {
        _cacheInitPromise = null;
        throw err;
    }
}

function txDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'));
    });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
}

async function idbGetForTs(cycleKey: CacheKey, ts: number): Promise<CycleData | null> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readonly');
    const store = tx.objectStore(STORE_CYCLES);
    const index = store.index('by_cycle_start');

    const range = IDBKeyRange.bound([cycleKey as any, Number.NEGATIVE_INFINITY], [cycleKey as any, ts]);
    const cursorReq = index.openCursor(range, 'prev');

    const rec = await new Promise<CycleRecord | null>((resolve, reject) => {
        cursorReq.onsuccess = () => resolve(cursorReq.result ? (cursorReq.result.value as any) : null);
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IndexedDB cursor failed'));
    });

    await txDone(tx);

    if (!rec) return null;
    if (!isFiniteNum(rec.startTs) || !isFiniteNum(rec.endTs)) return null;
    if (ts < rec.startTs || ts > rec.endTs) return null;

    return {
        cacheKey: rec.cacheKey as any,
        startTs: rec.startTs,
        endTs: rec.endTs,
        spokes: (rec.spokes ?? []) as any,
        createdAt: rec.createdAt ?? rec.updatedAt ?? nowMs(),
        updatedAt: rec.updatedAt ?? nowMs(),
    };
}

async function idbPut(cycle: CycleData): Promise<CycleData> {
    const rows = await listRecordsForKey(cycle.cacheKey);
    const prev = rows
        .filter((r) => isFiniteNum(r.endTs) && r.endTs <= cycle.startTs)
        .sort((a, b) => b.endTs - a.endTs)[0];
    const next = rows
        .filter((r) => isFiniteNum(r.startTs) && r.startTs >= cycle.endTs)
        .sort((a, b) => a.startTs - b.startTs)[0];

    const aligned = alignCycleWithKnownBoundaries(cycle, prev?.endTs, next?.startTs);

    const t = nowMs();
    await trimByStoragePressure(t);

    const rec: CycleRecord = {
        cacheKey: aligned.cacheKey as any,
        startTs: aligned.startTs,
        endTs: aligned.endTs,
        spokes: aligned.spokes,
        createdAt: aligned.createdAt ?? t,
        updatedAt: t,
    };

    try {
        await putRecord(rec);
    } catch (err) {
        if (!isQuotaExceededError(err)) throw err;
        await trimByStoragePressure(t, { force: true, targetPct: STORAGE_TARGET_PCT * 0.9 });
        await trimTotal(t);
        await putRecord(rec);
    }

    await trimKey(aligned.cacheKey, t);
    await trimTotal(t);
    await trimByStoragePressure(t);
    return { ...aligned, updatedAt: t };
}

async function listRecordsForKey(cycleKey: CacheKey): Promise<CycleRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readonly');
    const store = tx.objectStore(STORE_CYCLES);
    const idx = store.index('by_cycleKey');

    const range = IDBKeyRange.only(cycleKey as any);
    const req = idx.openCursor(range);

    const rows: CycleRecord[] = await new Promise((resolve, reject) => {
        const out: CycleRecord[] = [];
        req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve(out);
            out.push(cur.value as any);
            cur.continue();
        };
        req.onerror = () => reject(req.error ?? new Error('IndexedDB cursor failed'));
    });

    await txDone(tx);
    return rows;
}

async function trimKey(cycleKey: CacheKey, nowTs: number): Promise<void> {
    const rows = await listRecordsForKey(cycleKey);
    if (rows.length <= MAX_CYCLES_PER_KEY) return;

    sortByFarthestFromPresent(rows, nowTs);

    const toDelete = rows.slice(0, rows.length - MAX_CYCLES_PER_KEY);
    await deleteRecords(toDelete);
}

async function countAll(): Promise<number> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readonly');
    const store = tx.objectStore(STORE_CYCLES);
    const n = await reqToPromise(store.count());
    await txDone(tx);
    return n;
}

async function listAllByUpdatedAt(): Promise<CycleRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readonly');
    const store = tx.objectStore(STORE_CYCLES);
    const idx = store.index('by_updatedAt');

    const req = idx.openCursor();
    const rows: CycleRecord[] = await new Promise((resolve, reject) => {
        const out: CycleRecord[] = [];
        req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve(out);
            out.push(cur.value as any);
            cur.continue();
        };
        req.onerror = () => reject(req.error ?? new Error('IndexedDB cursor failed'));
    });

    await txDone(tx);
    return rows;
}

async function persistentGet(wheel: CacheWheelLike, ts: number): Promise<CycleData | null> {
    if (!ENABLE_CYCLE_IDB) return null;
    const key = makeCacheKey(wheel);
    return await idbGetForTs(key, ts);
}

async function persistentPut(cycle: CycleData): Promise<CycleData> {
    if (!ENABLE_CYCLE_IDB) return cycle;
    return await idbPut(cycle);
}

async function trimTotal(nowTs: number): Promise<void> {
    const total = await countAll();
    if (total <= MAX_CYCLES_TOTAL) return;

    const rows = await listAllByUpdatedAt();
    sortByFarthestFromPresent(rows, nowTs);

    const toDelete = rows.slice(0, total - MAX_CYCLES_TOTAL);
    await deleteRecords(toDelete);
}

async function putRecord(rec: CycleRecord): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readwrite');
    const store = tx.objectStore(STORE_CYCLES);
    store.put(rec as any);
    await txDone(tx);
}

async function deleteRecords(rows: CycleRecord[]): Promise<void> {
    if (!rows.length) return;
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readwrite');
    const store = tx.objectStore(STORE_CYCLES);

    for (const r of rows) store.delete([r.cacheKey as any, r.startTs] as any);
    await txDone(tx);
}

async function trimByStoragePressure(
    nowTs: number,
    opts?: { force?: boolean; targetPct?: number }
): Promise<void> {
    const est = await estimateStorage();
    if (!est) return;

    const usedPct = est.usage / est.quota;
    const targetPct = Math.max(0.2, Math.min(0.95, opts?.targetPct ?? STORAGE_TARGET_PCT));
    const shouldTrim = opts?.force ? usedPct > targetPct : usedPct > STORAGE_SOFT_LIMIT_PCT;
    if (!shouldTrim) return;

    const rows = await listAllByUpdatedAt();
    if (!rows.length) return;
    sortByFarthestFromPresent(rows, nowTs);

    const targetUsage = est.quota * targetPct;
    const excess = Math.max(0, est.usage - targetUsage);
    const ratio = est.usage > 0 ? excess / est.usage : 0;
    const countByRatio = Math.ceil(rows.length * ratio);
    const deleteCount = Math.min(rows.length, Math.max(STORAGE_CLEANUP_BATCH_MIN, countByRatio));

    await deleteRecords(rows.slice(0, deleteCount));
}
