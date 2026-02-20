// src/lib/profile/store.ts
import {derived, get, writable} from 'svelte/store';

import {debug} from '../debug';
import type {ObjId, WheelType} from '../catalog';
import type {WheelRolesState} from '../wheel/control';

import type {Profile, ProfileId, ProfilesState, SavedWheel} from './types';
import {boardApi} from '../board/store';

import {makeWheelId as makeWheelIdImpl, normalizeRoleValue} from '../wheel/id';
import type {WheelObserverState, WheelTimeState} from '../wheel/types';
import type {BoardWheel} from "../board/types";
import {DEFAULT_LOCATION_ID} from "../location/types";

export const makeWheelId = makeWheelIdImpl;

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
                profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
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
// normalize + MIGRATION
// ---------------------------

function normalizeState(s: ProfilesState | null): ProfilesState {
    return dbg.group('normalizeState', () => {
        const def = createDefaultProfile();

        if (!s || !Array.isArray(s.profiles) || s.profiles.length === 0) {
            dbg.warn('normalizeState.empty -> create default');
            return { profiles: [def], activeId: def.id };
        }

        const hasDefault = s.profiles.some(p => p?.id === def.id);
        const profiles = hasDefault ? s.profiles : [def, ...s.profiles];

        const activeId =
            s.activeId && profiles.some(p => p.id === s.activeId)
                ? s.activeId
                : def.id;

        dbg.log('normalizeState.ok', {
            hadDefault: hasDefault,
            profiles: profiles.length,
            activeId
        });

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
            profilesState.update((s) => {
                const ok = s.profiles.some(p => p.id === id);
                const nextId = ok ? id : 'default';
                if (!ok) dbg.warn('api.setActive.invalid -> default', { requested: id });
                dbg.log('api.setActive.ok', { activeId: nextId });
                return { ...s, activeId: nextId };
            });
        });
    },

    createProfile(title: string): ProfileId {
        return dbg.group('api.createProfile', () => {
            const t = now();
            const id: ProfileId = uid('profile');

            const p: Profile = {
                id,
                title: title?.trim() || 'New profile',
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

    deleteProfile(id: ProfileId) {
        dbg.group('api.deleteProfile', () => {
            if (id === 'default') {
                dbg.warn('api.deleteProfile.skip default');
                return;
            }

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
        });
    },

    // ---------------------------
    // Wheels library (presets) - deterministic id
    // ---------------------------

    saveWheel(input: {
        type: WheelType;
        title: string;
        roles: WheelRolesState;
        observer?: WheelObserverState;
        time?: WheelTimeState;
        favorite?: boolean;
    }): string {
        return dbg.group('api.saveWheel', () => {
            const ap = get(activeProfile);
            const observer = input.observer ?? DEFAULT_OBSERVER;
            const time = input.time ?? DEFAULT_TIME;

            const id = makeWheelIdImpl(input.type, input.roles, observer, time);
            const t = now();

            dbg.log('api.saveWheel.in', {
                profileId: ap.id,
                id,
                type: input.type,
                title: input.title,
                roles: input.roles,
                favorite: input.favorite
            });

            updateProfile(ap.id, (p) => {
                const wheels = p.data.wheels.slice();
                const idx = wheels.findIndex(w => w.id === id);

                if (idx >= 0) {
                    const prev = wheels[idx];
                    wheels[idx] = {
                        ...prev,
                        title: input.title?.trim() || prev.title,
                        roles: input.roles,
                        observer,
                        time,
                        favorite: input.favorite ?? prev.favorite,
                        updatedAt: t
                    };
                    dbg.log('api.saveWheel.overwrite', { wheelId: id });
                } else {
                    wheels.push({
                        id,
                        type: input.type,
                        title: input.title?.trim() || defaultWheelTitle(input.type, input.roles),
                        roles: input.roles,
                        observer,
                        time,
                        favorite: input.favorite ?? false,
                        createdAt: t,
                        updatedAt: t
                    });
                    dbg.log('api.saveWheel.created', { wheelId: id });
                }

                const favorites = normalizeFavorites(p.data.favorites, wheels);

                return { ...p, updatedAt: t, data: { ...p.data, wheels, favorites } };
            });

            return id;
        });
    },

    deleteWheel(wheelId: string) {
        dbg.group('api.deleteWheel', () => {
            const ap = get(activeProfile);
            const t = now();

            updateProfile(ap.id, (p) => {
                const before = p.data.wheels.length;
                const wheels = p.data.wheels.filter(w => w.id !== wheelId);
                const favorites = normalizeFavorites(p.data.favorites, wheels);

                dbg.log('api.deleteWheel.ok', {
                    profileId: ap.id,
                    wheelId,
                    before,
                    after: wheels.length
                });

                return { ...p, updatedAt: t, data: { ...p.data, wheels, favorites } };
            });
        });
    },

    setWheelFavorite(wheelId: string, favorite: boolean) {
        dbg.group('api.setWheelFavorite', () => {
            const ap = get(activeProfile);
            const t = now();

            updateProfile(ap.id, (p) => {
                const wheels = p.data.wheels.map(w => w.id === wheelId ? { ...w, favorite, updatedAt: t } : w);
                const favorites = normalizeFavorites(p.data.favorites, wheels);

                dbg.log('api.setWheelFavorite.ok', {
                    profileId: ap.id,
                    wheelId,
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

    // ---------------------------
    // Board snapshot (profile <-> board)
    // ---------------------------

    saveBoardToActiveProfile(): void {
        dbg.group('api.saveBoardToActiveProfile', () => {
            const ap = get(activeProfile);
            const t = now();

            const board = boardApi.getItems().map((x) => ({
                wheelId: x.wheelId,
                wheelType: x.wheelType,
                title: x.title,
                roles: x.roles,
                observer: x.observer,
                time: x.time,
                order: x.order,
                size: x.size
            }));

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
            const snap = (ap.data.wheelsOnScreen ?? []).slice().sort((a, b) => a.order - b.order);

            dbg.log('in', { profileId: ap.id, count: snap.length });

            const items = snap.map((x) => ({
                wheelType: x.wheelType,
                title: x.title,
                roles: x.roles,
                observer: x.observer,
                time: x.time,
                size: x.size
            }));

            boardApi.setFromSnapshot(items as any, 'loadBoardFromProfile');
            dbg.log('ok', { profileId: ap.id, count: items.length });
        });
    },

    saveBoardFromCurrentCompass(input: { type: WheelType; title: string; roles: WheelRolesState }): void {
        dbg.group('api.saveBoardFromCurrentCompass', () => {
            dbg.log('in', { type: input.type, title: input.title });

            if (input.type === 'compass') {
                boardApi.upsertCompass({ title: input.title, roles: input.roles }, 'saveBoardFromCurrentCompass');
            } else {
                dbg.warn('saveBoardFromCurrentCompass.nonCompass', { type: input.type });
            }

            profilesApi.saveBoardToActiveProfile();
            dbg.log('ok');
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
    const set = new Set(wheels.filter(w => w.favorite).map(w => w.id));
    for (const id of favorites) set.add(id);

    const valid = new Set(wheels.map(w => w.id));
    return Array.from(set).filter(id => valid.has(id));
}
