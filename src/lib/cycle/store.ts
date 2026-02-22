// src/lib/cycle/store.ts

import type { BoardWheel } from '../board/types';
import type { CycleSolveResult, CycleSpoke, WheelSolveResult } from '../board/runtime';
import { ms } from '../format';
import { CYCLE_PERSIST_EXCLUDED_TYPES, type CycleData, type CycleKey } from './types';
import {envBool} from "../env";

// если VITE_CYCLE_IDB не определён → true
export const ENABLE_CYCLE_IDB = envBool('CYCLE_IDB', true);

const DB_NAME = 'chrono_compass_cycle_cache';
const DB_VERSION = 1;

const STORE_CYCLES = 'cycles';

const MAX_CYCLES_PER_KEY = 256;
const MAX_CYCLES_TOTAL = 5000;

type CycleRecord = {
    cycleKey: string;
    startTs: number;
    endTs: number;
    spokes: CycleSpoke<any>[];
    createdAt: number;
    updatedAt: number;

    // NOTE: older records may still contain extra fields (spokeTimes, etc.).
    // We intentionally ignore them for forward compatibility during dev.
    [k: string]: any;
};

function isFiniteNum(x: any): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function roleToKeyPart(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch { return String(v); }
}

function targetToKeyPart(target: any): string {
    if (Array.isArray(target)) return roleToKeyPart(target[0]);
    return roleToKeyPart(target);
}

/**
 * Return CycleKey or null if this wheel type is excluded from persistent cache.
 * Key order is strict: wheelType, looker, focus, target.
 */
export function makeCycleKey(wheel: BoardWheel): CycleKey | null {
    const wt = String((wheel as any)?.wheelType ?? '');
    if (!wt) return null;

    if (CYCLE_PERSIST_EXCLUDED_TYPES.has(wt)) return null;

    const roles = (wheel as any)?.roles ?? {};
    const looker = roleToKeyPart(roles.looker);
    const focus = roleToKeyPart(roles.focus);
    const target = targetToKeyPart(roles.target);

    const key = `${wt}:${looker}:${focus}:${target}`;
    return key as CycleKey;
}

/* ============================================================
   CycleData builders
   ============================================================ */

export function buildCycleDataFromSolve<Meta = any>(
    key: CycleKey,
    solve: CycleSolveResult<Meta>,
): CycleData<Meta> | null {
    if (!solve?.ok) return null;

    const spokes = (solve.spokes ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (!spokes.length) return null;

    const s0 = spokes.find(s => s.index === 0);
    const s16 = spokes.find(s => s.index === 16);

    const startTs = s0?.ts;
    const endTs = s16?.ts;

    if (!isFiniteNum(startTs) || !isFiniteNum(endTs) || !(endTs > startTs)) return null;

    const now = ms(Date.now());

    return {
        key,
        startTs: ms(startTs),
        endTs: ms(endTs),
        spokes,
        createdAt: now,
        updatedAt: now,
    };
}

export function cycleContainsTs(c: CycleData | null | undefined, ts: number): boolean {
    if (!c) return false;
    if (!isFiniteNum(c.startTs) || !isFiniteNum(c.endTs)) return false;
    return ts >= c.startTs && ts <= c.endTs;
}

/* ============================================================
   IndexedDB (persistent cache)
   - Store: "cycles"
   - Primary key: [cycleKey, startTs]
   - Index: "by_cycle_start" on [cycleKey, startTs]
   ============================================================ */

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;

            if (!db.objectStoreNames.contains(STORE_CYCLES)) {
                const store = db.createObjectStore(STORE_CYCLES, { keyPath: ['cycleKey', 'startTs'] });
                store.createIndex('by_cycle_start', ['cycleKey', 'startTs'], { unique: true });
                store.createIndex('by_cycleKey', 'cycleKey', { unique: false });
                store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });

    return _dbPromise;
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

async function idbGetCycleForTs(cycleKey: CycleKey, ts: number): Promise<CycleData | null> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readonly');
    const store = tx.objectStore(STORE_CYCLES);
    const index = store.index('by_cycle_start');

    // Find record with greatest startTs <= ts for this cycleKey.
    const range = IDBKeyRange.bound([cycleKey as any, Number.NEGATIVE_INFINITY], [cycleKey as any, ts]);
    const cursorReq = index.openCursor(range, 'prev');

    const rec = await new Promise<CycleRecord | null>((resolve, reject) => {
        cursorReq.onsuccess = () => {
            const cur = cursorReq.result;
            if (!cur) return resolve(null);
            resolve(cur.value as any);
        };
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IndexedDB cursor failed'));
    });

    await txDone(tx);

    if (!rec) return null;
    if (!isFiniteNum(rec.startTs) || !isFiniteNum(rec.endTs)) return null;
    if (ts < rec.startTs || ts > rec.endTs) return null; // hole case

    return {
        key: rec.cycleKey as any,
        startTs: rec.startTs,
        endTs: rec.endTs,
        spokes: (rec.spokes ?? []) as any,
        createdAt: rec.createdAt ?? rec.updatedAt ?? ms(Date.now()),
        updatedAt: rec.updatedAt ?? ms(Date.now()),
    };
}

async function idbPutCycle(cycle: CycleData): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readwrite');
    const store = tx.objectStore(STORE_CYCLES);

    const now = ms(Date.now());

    const rec: CycleRecord = {
        cycleKey: cycle.key as any,
        startTs: cycle.startTs,
        endTs: cycle.endTs,
        spokes: cycle.spokes,
        createdAt: cycle.createdAt ?? now,
        updatedAt: now,
    };

    store.put(rec as any);
    await txDone(tx);

    await trimKey(cycle.key, now);
    await trimTotal(now);
}

async function listCyclesForKey(cycleKey: CycleKey): Promise<CycleRecord[]> {
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

async function trimKey(cycleKey: CycleKey, nowTs: number): Promise<void> {
    const rows = await listCyclesForKey(cycleKey);
    if (rows.length <= MAX_CYCLES_PER_KEY) return;

    rows.sort((a, b) => {
        const da = Math.min(Math.abs(a.startTs - nowTs), Math.abs(a.endTs - nowTs));
        const db = Math.min(Math.abs(b.startTs - nowTs), Math.abs(b.endTs - nowTs));
        if (da !== db) return db - da; // farthest first
        return (a.updatedAt ?? 0) - (b.updatedAt ?? 0); // older first
    });

    const toDelete = rows.slice(0, rows.length - MAX_CYCLES_PER_KEY);

    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readwrite');
    const store = tx.objectStore(STORE_CYCLES);

    for (const r of toDelete) {
        store.delete([r.cycleKey as any, r.startTs] as any);
    }

    await txDone(tx);
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

    const req = idx.openCursor(); // ascending updatedAt
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

async function trimTotal(nowTs: number): Promise<void> {
    const total = await countAll();
    if (total <= MAX_CYCLES_TOTAL) return;

    const rows = await listAllByUpdatedAt();

    rows.sort((a, b) => {
        const da = Math.min(Math.abs(a.startTs - nowTs), Math.abs(a.endTs - nowTs));
        const db = Math.min(Math.abs(b.startTs - nowTs), Math.abs(b.endTs - nowTs));
        if (da !== db) return db - da; // farthest first
        return (a.updatedAt ?? 0) - (b.updatedAt ?? 0); // older first
    });

    const toDelete = rows.slice(0, total - MAX_CYCLES_TOTAL);

    const db = await openDb();
    const tx = db.transaction(STORE_CYCLES, 'readwrite');
    const store = tx.objectStore(STORE_CYCLES);

    for (const r of toDelete) {
        store.delete([r.cycleKey as any, r.startTs] as any);
    }

    await txDone(tx);
}

/* ============================================================
   In-memory local cache (per wheel instance)
   ============================================================ */

type LocalEntry = { key: CycleKey; cycle: CycleData };

const localByWheelId = new Map<string, LocalEntry>();

export function getLocalCycle(wheelId: string, key: CycleKey, ts: number): CycleData | null {
    const e = localByWheelId.get(wheelId);
    if (!e) return null;
    if (e.key !== key) return null;
    return cycleContainsTs(e.cycle, ts) ? e.cycle : null;
}

export function setLocalCycle(wheelId: string, key: CycleKey, cycle: CycleData): void {
    localByWheelId.set(wheelId, { key, cycle });
}

export function clearLocalCycle(wheelId: string): void {
    localByWheelId.delete(wheelId);
}

/* ============================================================
   High-level helpers (to be used by Cycle.svelte later)
   ============================================================ */

export async function getPersistentCycle(key: CycleKey, ts: number): Promise<CycleData | null> {
    if (!ENABLE_CYCLE_IDB) return null;
    return await idbGetCycleForTs(key, ts);
}

export async function putPersistentCycle(cycle: CycleData): Promise<void> {
    if (!ENABLE_CYCLE_IDB) return;
    await idbPutCycle(cycle);
}

/**
 * Convenience: accept a WheelSolveResult, extract CycleSolveResult and build CycleData.
 * Returns null if not ok / not a cycle.
 */
export function tryBuildCycleDataFromWheelSolve<Meta = any>(
    key: CycleKey,
    res: WheelSolveResult,
): CycleData<Meta> | null {
    if (!res || (res as any).kind !== 'cycle') return null;
    const r = res as any as CycleSolveResult<Meta>;
    return buildCycleDataFromSolve<Meta>(key, r);
}
