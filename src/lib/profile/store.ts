// src/lib/profile/store.ts
import { derived, get, writable } from 'svelte/store';

import { debug } from '../debug';
import type { ObjId, WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

import type { Profile, ProfileData, ProfileId, ProfilesState, SavedWheel } from './types';
import { boardApi, boardState } from '../board/store';

import { makeDedupKey as makeDedupKeyImpl, normalizeRoleValue } from './dedup';
import type { WheelObserverState, WheelTimeState } from '../wheel/types';
import type { BoardWheel } from '../board/types';
import { currentLocationId, locationState } from '../location/store';
import { DEFAULT_LOCATION_ID, type Location, type LocationData } from '../location/types';

const dbg = debug('profile', '👤');

const KEY = 'chrono:profiles';
const ACTIVE_KEY = 'chrono:profiles:activeId';

function now(): number {
    return Date.now();
}

const DEFAULT_OBSERVER: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };
const DEFAULT_TIME: WheelTimeState = { live: true, locked: false };

function uid(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function emptyProfileData() {
    return {
        wheels: [] as SavedWheel[],
        favorites: [] as string[],
        bodies: {} as Partial<Record<ObjId, { name?: { en?: string }; emoji?: string }>>,
        wheelsOnScreen: [] as BoardWheel[]
    };
}

export function createDefaultProfile(): Profile {
    const t = now();
    return {
        id: 'default',
        title: 'Default',
        system: false,
        locked: false,
        createdAt: t,
        updatedAt: t,
        data: emptyProfileData()
    };
}

// ---------------------------
// storage
// ---------------------------

function loadProfilesState(): ProfilesState | null {
    return dbg.group('storage.loadProfilesState', () => {
        try {
            const raw = localStorage.getItem(KEY);
            const rawActive = localStorage.getItem(ACTIVE_KEY);

            dbg.log('storage.load.raw', {
                hasState: !!raw,
                hasActive: !!rawActive,
                activeLen: rawActive?.length ?? 0
            });

            if (!raw) return null;

            const parsed = JSON.parse(raw) as ProfilesState;

            const activeId =
                (rawActive && rawActive.length)
                    ? rawActive
                    : (parsed.activeId ?? null);

            const state: ProfilesState = {
                profiles: Array.isArray((parsed as any).profiles) ? (parsed as any).profiles : [],
                activeId
            };

            dbg.log('storage.load.ok', {
                profiles: state.profiles.length,
                activeId: state.activeId
            });

            return state;
        } catch (err) {
            dbg.warn('storage.load.fail', err);
            return null;
        }
    });
}

function saveProfilesState(state: ProfilesState) {
    dbg.group('storage.saveProfilesState', () => {
        try {
            dbg.log('storage.save.in', {
                profiles: state.profiles.length,
                activeId: state.activeId
            });

            localStorage.setItem(
                KEY,
                JSON.stringify({ profiles: state.profiles, activeId: state.activeId })
            );

            localStorage.setItem(ACTIVE_KEY, state.activeId ?? '');

            dbg.log('storage.save.ok');
        } catch (err) {
            dbg.warn('storage.save.fail', err);
        }
    });
}

// ---------------------------
// normalize
// ---------------------------

function normalizeState(s: ProfilesState | null): ProfilesState {
    return dbg.group('normalizeState', () => {
        const def = createDefaultProfile();

        if (!s || !Array.isArray(s.profiles) || s.profiles.length === 0) {
            dbg.warn('normalizeState.empty -> create default');
            return { profiles: [def], activeId: def.id };
        }

        const normalizedProfiles = s.profiles.map((p) => {
            const system = !!(p as any)?.system;
            const locked = system ? true : !!(p as any)?.locked;
            return {
            ...p,
            system,
            locked,
            data: {
                ...emptyProfileData(),
                ...(p?.data ?? {})
            }
        };});

        const hasDefault = normalizedProfiles.some(p => p?.id === def.id);
        const profiles = hasDefault ? normalizedProfiles : [def, ...normalizedProfiles];

        const activeId =
            s.activeId && profiles.some(p => p.id === s.activeId)
                ? s.activeId
                : def.id;

        dbg.log('normalizeState.ok', { hadDefault: hasDefault, profiles: profiles.length, activeId });
        return { profiles, activeId };
    });
}

// ---------------------------
// store init
// ---------------------------

const loaded = loadProfilesState();
const initial = normalizeState(loaded);

dbg.log('store.init', {
    loaded: !!loaded,
    profiles: initial.profiles.length,
    activeId: initial.activeId
});

export const profilesState = writable<ProfilesState>(initial);

profilesState.subscribe((s) => {
    dbg.log('store.persist', { profiles: s.profiles.length, activeId: s.activeId });
    saveProfilesState(s);
});

export const activeProfile = derived(profilesState, ($s) => {
    const p =
        $s.profiles.find(x => x.id === $s.activeId) ??
        $s.profiles.find(x => x.id === 'default');

    const out = p ?? createDefaultProfile();
    dbg.log('activeProfile', { id: out.id, title: out.title });
    return out;
});

export const isActiveProfileLocked = derived(activeProfile, ($p) => !!$p?.locked);

function snapshotCurrentBoard(): BoardWheel[] {
    // Snapshot stores wheel cards exactly as shown on board, independent from saved wheel presets.
    return boardApi.getItems().map((x) => ({
        id: (x as any).id,
        wheelType: (x as any).wheelType,
        title: (x as any).title,
        roles: (x as any).roles,
        observer: (x as any).observer,
        time: (x as any).time,
        order: (x as any).order,
        size: (x as any).size,
        layout: (x as any).layout,
        view: (x as any).view
    })) as any as BoardWheel[];
}

function sanitizeLocation(x: any): Location | null {
    if (!x || typeof x !== 'object') return null;
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    const tz = typeof x.tz === 'string' ? x.tz.trim() : '';
    const label = typeof x.label === 'string' ? x.label.trim() : '';
    const lat = Number((x as any).lat);
    const lon = Number((x as any).lon);
    if (!id || !tz || !label || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { id, tz, label, lat, lon };
}

function normalizeLocationsData(input: any): LocationData {
    const saved: Location[] = Array.isArray(input?.saved)
        ? input.saved
            .map((x: any) => sanitizeLocation(x))
            .filter((x: Location | null): x is Location => !!x)
        : [];

    const currentIdRaw = typeof input?.currentId === 'string' ? input.currentId.trim() : '';
    const currentId = saved.some((x) => x.id === currentIdRaw)
        ? currentIdRaw
        : (saved[0]?.id ?? '');

    return { saved, currentId };
}

function boardSnapshotSignature(items: BoardWheel[]): string {
    const normalized = (items ?? [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((x, idx) => ({
            id: String((x as any).id ?? ''),
            wheelType: (x as any).wheelType,
            title: String((x as any).title ?? ''),
            roles: (x as any).roles ?? {},
            observer: (x as any).observer ?? {},
            time: (x as any).time ?? {},
            size: Number.isFinite((x as any).size) ? Number((x as any).size) : null,
            layout: (x as any).layout ?? null,
            view: (x as any).view ?? null,
            order: idx
        }));
    return JSON.stringify(normalized);
}

function loadBoardForProfile(profileId: ProfileId): void {
    const s = get(profilesState);
    const p = s.profiles.find((x) => x.id === profileId) ?? null;
    const snap = (p?.data?.wheelsOnScreen ?? [])
        .slice()
        .sort((a: any, b: any) => (a as any).order - (b as any).order);

    const items = snap.map((x: any) => ({
        wheelType: x.wheelType,
        title: x.title,
        roles: x.roles,
        observer: x.observer,
        time: x.time,
        size: x.size,
        layout: x.layout,
        view: x.view
    }));

    boardApi.setFromSnapshot(items as any, 'profile.setActive.loadBoard');
}

function applyGlobalLocations(next: LocationData): void {
    const curState = get(locationState);
    const curCurrentId = get(currentLocationId);

    const byId = new Map<string, Location>();
    for (const loc of curState.saved ?? []) {
        const normalized = sanitizeLocation(loc);
        if (!normalized) continue;
        byId.set(normalized.id, normalized);
    }
    for (const loc of next.saved ?? []) {
        const normalized = sanitizeLocation(loc);
        if (!normalized) continue;
        // Imported location with same id overwrites existing one.
        byId.set(normalized.id, normalized);
    }

    const saved = Array.from(byId.values());
    const importedCurrentId = typeof next.currentId === 'string' ? next.currentId.trim() : '';
    const currentId = (
        importedCurrentId && byId.has(importedCurrentId)
            ? importedCurrentId
            : (curCurrentId && byId.has(curCurrentId) ? curCurrentId : (saved[0]?.id ?? ''))
    );

    locationState.set({ saved, currentId });
    currentLocationId.set(currentId);
}

function cloneSavedWheel(w: SavedWheel): SavedWheel {
    return {
        dedupKey: w.dedupKey,
        type: w.type,
        title: w.title,
        roles: { ...(w.roles ?? {}) },
        observer: { ...(w.observer ?? DEFAULT_OBSERVER) },
        time: { ...(w.time ?? DEFAULT_TIME) } as WheelTimeState,
        view: w.view ? { ...w.view } : undefined,
        favorite: !!w.favorite,
        createdAt: Number.isFinite(w.createdAt) ? w.createdAt : now(),
        updatedAt: Number.isFinite(w.updatedAt) ? w.updatedAt : now()
    };
}

function cloneBoardWheelSnapshot(w: BoardWheel, order: number): BoardWheel {
    return {
        id: String((w as any).id ?? ''),
        wheelType: (w as any).wheelType,
        title: String((w as any).title ?? ''),
        roles: { ...((w as any).roles ?? {}) },
        observer: { ...((w as any).observer ?? DEFAULT_OBSERVER) },
        time: { ...((w as any).time ?? DEFAULT_TIME) } as WheelTimeState,
        order,
        size: Number.isFinite((w as any).size) ? Number((w as any).size) : undefined,
        layout: (w as any).layout ? { ...(w as any).layout } : undefined,
        view: (w as any).view ? { ...(w as any).view } : undefined
    };
}

function normalizeBodies(input: any): Partial<Record<ObjId, { name?: { en?: string }; emoji?: string }>> {
    if (!input || typeof input !== 'object') return {};
    const out: Partial<Record<ObjId, { name?: { en?: string }; emoji?: string }>> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
        const id = String(k || '').trim() as ObjId;
        if (!id || !v || typeof v !== 'object') continue;
        const next: { name?: { en?: string }; emoji?: string } = {};
        const nameEn = typeof (v as any)?.name?.en === 'string' ? (v as any).name.en.trim() : '';
        const emoji = typeof (v as any)?.emoji === 'string' ? (v as any).emoji.trim() : '';
        if (nameEn) next.name = { en: nameEn };
        if (emoji) next.emoji = emoji;
        if (next.name || next.emoji) out[id] = next;
    }
    return out;
}

function normalizeImportedWheels(input: any): SavedWheel[] {
    if (!Array.isArray(input)) return [];
    const out: SavedWheel[] = [];
    for (const raw of input) {
        const dedupKey = typeof raw?.dedupKey === 'string' ? raw.dedupKey.trim() : '';
        const type = typeof raw?.type === 'string' ? raw.type.trim() : '';
        if (!dedupKey || !type) continue;
        out.push(cloneSavedWheel({
            dedupKey,
            type: type as WheelType,
            title: typeof raw?.title === 'string' ? raw.title : '',
            roles: (raw?.roles ?? {}) as WheelRolesState,
            observer: (raw?.observer ?? DEFAULT_OBSERVER) as WheelObserverState,
            time: (raw?.time ?? DEFAULT_TIME) as WheelTimeState,
            view: raw?.view,
            favorite: !!raw?.favorite,
            createdAt: Number.isFinite(raw?.createdAt) ? Number(raw.createdAt) : now(),
            updatedAt: Number.isFinite(raw?.updatedAt) ? Number(raw.updatedAt) : now()
        }));
    }
    return out;
}

function normalizeImportedBoard(input: any): BoardWheel[] {
    if (!Array.isArray(input)) return [];
    const withType = input.filter((x) => typeof x?.wheelType === 'string' && String(x.wheelType).trim().length > 0);
    return withType
        .map((x: any, idx: number) => cloneBoardWheelSnapshot({
            id: typeof x?.id === 'string' ? x.id : '',
            wheelType: x.wheelType as WheelType,
            title: typeof x?.title === 'string' ? x.title : '',
            roles: (x?.roles ?? {}) as WheelRolesState,
            observer: (x?.observer ?? DEFAULT_OBSERVER) as WheelObserverState,
            time: (x?.time ?? DEFAULT_TIME) as WheelTimeState,
            order: Number.isFinite(x?.order) ? Number(x.order) : idx,
            size: Number.isFinite(x?.size) ? Number(x.size) : undefined,
            layout: x?.layout,
            view: x?.view
        }, idx))
        .sort((a, b) => a.order - b.order)
        .map((x, idx) => ({ ...x, order: idx }));
}

function updateProfile(profileId: ProfileId, fn: (p: Profile) => Profile) {
    profilesState.update((s) => {
        const idx = s.profiles.findIndex(p => p.id === profileId);
        if (idx < 0) {
            dbg.warn('updateProfile.missing', profileId);
            return s;
        }

        const prev = s.profiles[idx];
        const next = fn(prev);

        const profiles = s.profiles.slice();
        profiles[idx] = next;

        dbg.log('updateProfile.ok', {
            id: profileId,
            title: next.title,
            updatedAt: next.updatedAt
        });

        return { ...s, profiles };
    });
}

// ---------------------------
// api
// ---------------------------

export const profilesApi = {
    list(): Profile[] {
        const s = get(profilesState);
        dbg.log('api.list', { profiles: s.profiles.length });
        return s.profiles;
    },

    getActive(): Profile {
        const p = get(activeProfile);
        dbg.log('api.getActive', { id: p.id, title: p.title });
        return p;
    },

    setActive(id: ProfileId) {
        dbg.group('api.setActive', () => {
            const before = get(profilesState);
            const prevActiveId = before.activeId ?? 'default';
            const ok = before.profiles.some(p => p.id === id);
            const nextId = ok ? id : 'default';

            if (prevActiveId === nextId) {
                dbg.log('api.setActive.noop', { activeId: nextId });
                return;
            }

            const boardSnapshot = snapshotCurrentBoard();

            profilesState.update((s) => {
                const curOk = s.profiles.some(p => p.id === id);
                const curNextId = curOk ? id : 'default';
                if (!curOk) dbg.warn('api.setActive.invalid -> default', { requested: id });

                const t = now();
                const profiles = s.profiles.map((p) => {
                    if (p.id !== prevActiveId) return p;
                    return {
                        ...p,
                        updatedAt: t,
                        data: {
                            ...p.data,
                            wheelsOnScreen: boardSnapshot
                        }
                    };
                });

                dbg.log('api.setActive.ok', {
                    prevActiveId,
                    activeId: curNextId,
                    savedBoardItems: boardSnapshot.length
                });

                return { ...s, profiles, activeId: curNextId };
            });

            loadBoardForProfile(nextId);
        });
    },

    createProfile(title: string): ProfileId {
        return dbg.group('api.createProfile', () => {
            const t = now();
            const id: ProfileId = uid('profile');

            const p: Profile = {
                id,
                title: title?.trim() || 'New profile',
                system: false,
                locked: false,
                createdAt: t,
                updatedAt: t,
                data: emptyProfileData()
            };

            profilesState.update((s) => {
                dbg.log('api.createProfile.ok', { id, title: p.title });
                return {
                    ...s,
                    profiles: [...s.profiles, p],
                    activeId: s.activeId ?? 'default'
                };
            });

            return id;
        });
    },

    renameProfile(id: ProfileId, title: string) {
        dbg.group('api.renameProfile', () => {
            if (id === 'default') {
                dbg.warn('api.renameProfile.skip default');
                return;
            }
            const nextTitle = title?.trim();
            if (!nextTitle) {
                dbg.warn('api.renameProfile.skip empty title');
                return;
            }
            updateProfile(id, (p) => ({ ...p, title: nextTitle, updatedAt: now() }));
        });
    },

    setProfileLocked(id: ProfileId, locked: boolean) {
        dbg.group('api.setProfileLocked', () => {
            updateProfile(id, (p) => {
                if (p.system && !locked) {
                    dbg.warn('api.setProfileLocked.skip.systemUnlock', { id });
                    return p;
                }
                return { ...p, locked: !!locked, updatedAt: now() };
            });
        });
    },

    saveProfileDraft(input: {
        id?: ProfileId | null;
        title: string;
        wheels: SavedWheel[];
        board: BoardWheel[];
    }): ProfileId {
        return dbg.group('api.saveProfileDraft', () => {
            const t = now();
            const requestedId = input.id ?? null;
            const title = input.title?.trim() || 'New profile';
            const wheels = (input.wheels ?? []).map((w) => cloneSavedWheel(w));
            const board = (input.board ?? [])
                .map((w, idx) => cloneBoardWheelSnapshot(w, idx))
                .sort((a, b) => a.order - b.order)
                .map((w, idx) => ({ ...w, order: idx }));

            const favorites = normalizeFavorites([], wheels);

            let outId: ProfileId = requestedId && requestedId.length ? requestedId : uid('profile');

            profilesState.update((s) => {
                const idx = requestedId ? s.profiles.findIndex((p) => p.id === requestedId) : -1;

                if (idx >= 0) {
                    const prev = s.profiles[idx];
                    const nextTitle = prev.id === 'default' ? prev.title : title;
                    const nextData: ProfileData = {
                        ...prev.data,
                        wheels,
                        favorites,
                        wheelsOnScreen: board
                    };
                    const nextProfile: Profile = {
                        ...prev,
                        title: nextTitle,
                        system: prev.system ?? false,
                        locked: prev.locked ?? false,
                        updatedAt: t,
                        data: nextData
                    };

                    const profiles = s.profiles.slice();
                    profiles[idx] = nextProfile;

                    outId = nextProfile.id;
                    dbg.log('api.saveProfileDraft.update', {
                        id: nextProfile.id,
                        wheels: wheels.length,
                        board: board.length
                    });
                    return { ...s, profiles };
                }

                const created: Profile = {
                    id: outId,
                    title,
                    system: false,
                    locked: false,
                    createdAt: t,
                    updatedAt: t,
                    data: {
                        ...emptyProfileData(),
                        wheels,
                        favorites,
                        wheelsOnScreen: board
                    }
                };

                dbg.log('api.saveProfileDraft.create', {
                    id: created.id,
                    wheels: wheels.length,
                    board: board.length
                });
                return { ...s, profiles: [...s.profiles, created] };
            });

            return outId;
        });
    },

    upsertProfileFromImport(input: any): ProfileId | null {
        return dbg.group('api.upsertProfileFromImport', () => {
            const src = input?.profile ?? input;
            const id = typeof src?.id === 'string' ? src.id.trim() : '';
            if (!id) {
                dbg.warn('api.upsertProfileFromImport.invalid.id');
                return null;
            }
            const activeBefore = get(profilesState).activeId ?? 'default';

            const t = now();
            const title = (typeof src?.title === 'string' ? src.title : '').trim() || 'Imported profile';
            const createdAt = Number.isFinite(src?.createdAt) ? Number(src.createdAt) : t;

            const wheels = normalizeImportedWheels(src?.data?.wheels);
            const board = normalizeImportedBoard(src?.data?.wheelsOnScreen);
            const locations = normalizeLocationsData(src?.data?.locations);
            const bodies = normalizeBodies(src?.data?.bodies);
            const favorites = normalizeFavorites(
                Array.isArray(src?.data?.favorites) ? src.data.favorites.filter((x: any) => typeof x === 'string') : [],
                wheels
            );

            const importedSystem = !!src?.system;
            const imported: Profile = {
                id,
                title,
                system: importedSystem,
                locked: importedSystem ? true : !!src?.locked,
                createdAt,
                updatedAt: t,
                data: {
                    ...emptyProfileData(),
                    wheels,
                    favorites,
                    bodies,
                    wheelsOnScreen: board
                }
            };

            profilesState.update((s) => {
                const idx = s.profiles.findIndex((p) => p.id === id);
                if (idx >= 0) {
                    const profiles = s.profiles.slice();
                    profiles[idx] = imported;
                    dbg.log('api.upsertProfileFromImport.overwrite', { id, wheels: wheels.length, board: board.length });
                    return { ...s, profiles };
                }
                dbg.log('api.upsertProfileFromImport.create', { id, wheels: wheels.length, board: board.length });
                return { ...s, profiles: [...s.profiles, imported] };
            });

            applyGlobalLocations(locations);
            if (activeBefore === id) loadBoardForProfile(id);

            return id;
        });
    },

    deleteProfile(id: ProfileId) {
        dbg.group('api.deleteProfile', () => {
            if (id === 'default') {
                dbg.warn('api.deleteProfile.skip default');
                return;
            }

            const before = get(profilesState);
            const deletedActive = before.activeId === id;

            profilesState.update((s) => {
                const existed = s.profiles.some(p => p.id === id);
                if (!existed) dbg.warn('api.deleteProfile.missing', id);

                const profiles = s.profiles.filter(p => p.id !== id);
                const activeId = (s.activeId === id) ? 'default' : s.activeId;

                dbg.log('api.deleteProfile.ok', {
                    deleted: id,
                    profiles: profiles.length,
                    activeId
                });

                return { profiles, activeId };
            });

            if (deletedActive) {
                loadBoardForProfile('default');
            }
        });
    },

    // ---------------------------
    // Wheels library (presets) - deterministic dedupKey
    // ---------------------------

    saveWheel(input: {
        type: WheelType;
        title: string;
        roles: WheelRolesState;
        observer?: WheelObserverState;
        time?: WheelTimeState;
        view?: SavedWheel['view'];
        favorite?: boolean;
    }): string {
        return dbg.group('api.saveWheel', () => {
            const ap = get(activeProfile);
            const observer = input.observer ?? DEFAULT_OBSERVER;
            const time = input.time ?? DEFAULT_TIME;

            const dedupKey = makeDedupKeyImpl(input.type, input.roles, observer, time);
            const t = now();

            dbg.log('api.saveWheel.in', {
                profileId: ap.id,
                dedupKey,
                type: input.type,
                title: input.title,
                roles: input.roles,
                favorite: input.favorite
            });

            updateProfile(ap.id, (p) => {
                const wheels = p.data.wheels.slice();
                const idx = wheels.findIndex(w => w.dedupKey === dedupKey);

                if (idx >= 0) {
                    const prev = wheels[idx];
                    wheels[idx] = {
                        ...prev,
                        title: input.title?.trim() || prev.title,
                        roles: input.roles,
                        observer,
                        time,
                        view: input.view ?? prev.view,
                        favorite: input.favorite ?? prev.favorite,
                        updatedAt: t
                    };
                    dbg.log('api.saveWheel.overwrite', { dedupKey });
                } else {
                    wheels.push({
                        dedupKey,
                        type: input.type,
                        title: input.title?.trim() || defaultWheelTitle(input.type, input.roles),
                        roles: input.roles,
                        observer,
                        time,
                        view: input.view,
                        favorite: input.favorite ?? false,
                        createdAt: t,
                        updatedAt: t
                    });
                    dbg.log('api.saveWheel.created', { dedupKey });
                }

                const favorites = normalizeFavorites(p.data.favorites, wheels);

                return { ...p, updatedAt: t, data: { ...p.data, wheels, favorites } };
            });

            return dedupKey;
        });
    },

    deleteWheel(dedupKey: string) {
        dbg.group('api.deleteWheel', () => {
            const ap = get(activeProfile);
            const t = now();

            updateProfile(ap.id, (p) => {
                const before = p.data.wheels.length;
                const wheels = p.data.wheels.filter(w => w.dedupKey !== dedupKey);
                const favorites = normalizeFavorites(p.data.favorites, wheels);

                dbg.log('api.deleteWheel.ok', {
                    profileId: ap.id,
                    dedupKey,
                    before,
                    after: wheels.length
                });

                return { ...p, updatedAt: t, data: { ...p.data, wheels, favorites } };
            });
        });
    },

    setWheelFavorite(dedupKey: string, favorite: boolean) {
        dbg.group('api.setWheelFavorite', () => {
            const ap = get(activeProfile);
            const t = now();

            updateProfile(ap.id, (p) => {
                const wheels = p.data.wheels.map(w => w.dedupKey === dedupKey ? { ...w, favorite, updatedAt: t } : w);
                const favorites = normalizeFavorites(p.data.favorites, wheels);

                dbg.log('api.setWheelFavorite.ok', {
                    profileId: ap.id,
                    dedupKey,
                    favorite
                });

                return { ...p, updatedAt: t, data: { ...p.data, wheels, favorites } };
            });
        });
    },

    listWheelsByType(type: WheelType): SavedWheel[] {
        const ap = get(activeProfile);
        const list = (ap.data.wheels ?? []).filter(w => w.type === type);

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return (b.updatedAt - a.updatedAt);
        });

        dbg.log('api.listWheelsByType', { profileId: ap.id, type, count: list.length });
        return list;
    },

    listActiveWheels(): SavedWheel[] {
        const ap = get(activeProfile);
        const list = (ap.data.wheels ?? []).slice();

        list.sort((a, b) => {
            const af = !!a.favorite;
            const bf = !!b.favorite;
            if (af !== bf) return af ? -1 : 1;
            return b.updatedAt - a.updatedAt;
        });

        dbg.log('api.listActiveWheels', { profileId: ap.id, count: list.length });
        return list;
    },

    // ---------------------------
    // Board snapshot (profile <-> board)
    // ---------------------------

    saveBoardToActiveProfile(): void {
        dbg.group('api.saveBoardToActiveProfile', () => {
            const ap = get(activeProfile);
            const t = now();

            const board = snapshotCurrentBoard();

            dbg.log('in', { profileId: ap.id, count: board.length });

            updateProfile(ap.id, (p) => {
                return {
                    ...p,
                    updatedAt: t,
                    data: { ...p.data, wheelsOnScreen: board }
                };
            });

            dbg.log('ok', { profileId: ap.id, count: board.length });
        });
    },

    loadBoardFromActiveProfile(): void {
        dbg.group('api.loadBoardFromActiveProfile', () => {
            const ap = get(activeProfile);
            loadBoardForProfile(ap.id);
            dbg.log('ok', { profileId: ap.id, count: (ap.data.wheelsOnScreen ?? []).length });
        });
    },

    // objects overrides
    setBodyOverride(bodyId: ObjId, patch: { name?: { en?: string }; emoji?: string }) {
        dbg.group('api.setBodyOverride', () => {
            const ap = get(activeProfile);
            const t = now();

            dbg.log('api.setBodyOverride.in', { profileId: ap.id, bodyId, patch });

            updateProfile(ap.id, (p) => {
                const bodies = { ...p.data.bodies };
                const prev = bodies[bodyId] ?? {};
                bodies[bodyId] = { ...prev, ...patch };
                return { ...p, updatedAt: t, data: { ...p.data, bodies } };
            });
        });
    },

    clearBodyOverride(bodyId: ObjId) {
        dbg.group('api.clearBodyOverride', () => {
            const ap = get(activeProfile);
            const t = now();

            updateProfile(ap.id, (p) => {
                const bodies = { ...p.data.bodies };
                const existed = !!bodies[bodyId];
                delete bodies[bodyId];

                if (!existed) dbg.warn('api.clearBodyOverride.missing', { profileId: ap.id, bodyId });
                else dbg.log('api.clearBodyOverride.ok', { profileId: ap.id, bodyId });

                return { ...p, updatedAt: t, data: { ...p.data, bodies } };
            });
        });
    }
};

// ---------------------------
// helpers
// ---------------------------

function defaultWheelTitle(type: WheelType, roles: WheelRolesState): string {
    const r = Object.entries(roles ?? {})
        .map(([k, v]) => [k, normalizeRoleValue(v)] as const)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
    return `${type}${r ? ' ' + r : ''}`;
}

function normalizeFavorites(favorites: string[], wheels: SavedWheel[]): string[] {
    // favorites are dedupKeys
    const set = new Set(wheels.filter(w => w.favorite).map(w => w.dedupKey));
    for (const id of favorites) set.add(id);

    const valid = new Set(wheels.map(w => w.dedupKey));
    return Array.from(set).filter(id => valid.has(id));
}

// Keep board scoped to active profile on app startup while preserving existing board data.
(() => {
    const s = get(profilesState);
    const activeId = s.activeId ?? 'default';
    const p = s.profiles.find((x) => x.id === activeId) ?? null;
    const hasSnapshot = !!(p?.data?.wheelsOnScreen?.length);
    const boardCount = boardApi.getItems().length;

    if (!hasSnapshot && boardCount > 0) {
        dbg.log('startup.board.seedActiveProfile', { activeId, boardCount });
        profilesState.update((state) => {
            const t = now();
            const profiles = state.profiles.map((x) => {
                if (x.id !== activeId) return x;
                return {
                    ...x,
                    updatedAt: t,
                    data: { ...x.data, wheelsOnScreen: snapshotCurrentBoard() }
                };
            });
            return { ...state, profiles };
        });
        return;
    }

    dbg.log('startup.board.loadActiveProfile', { activeId, snapshotCount: p?.data?.wheelsOnScreen?.length ?? 0 });
    loadBoardForProfile(activeId);
})();

// Keep active profile board snapshot in sync with live board changes.
boardState.subscribe(() => {
    const s = get(profilesState);
    const activeId = s.activeId ?? 'default';
    const active = s.profiles.find((x) => x.id === activeId) ?? null;
    if (!active) return;

    const nextBoard = snapshotCurrentBoard();
    const nextSig = boardSnapshotSignature(nextBoard);
    const curSig = boardSnapshotSignature(active.data?.wheelsOnScreen ?? []);
    if (nextSig === curSig) return;

    const t = now();
    profilesState.update((state) => {
        const profiles = state.profiles.map((p) => {
            if (p.id !== activeId) return p;
            return {
                ...p,
                updatedAt: t,
                data: { ...p.data, wheelsOnScreen: nextBoard }
            };
        });
        return { ...state, profiles };
    });
});
