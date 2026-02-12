// src/lib/profile/storage.ts
import { debug } from '../debug';
import type { ProfilesState } from './types';

const dbg = debug('PROFILE', '👤');

const KEY = 'chrono:profiles';
const ACTIVE_KEY = 'chrono:profiles:activeId';

export function loadProfilesState(): ProfilesState | null {
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

export function saveProfilesState(state: ProfilesState) {
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
