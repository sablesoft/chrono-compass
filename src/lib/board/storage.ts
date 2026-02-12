import { debug } from '../debug';
import type { BoardState } from './types';

const dbg = debug('PROFILE', '👤');

const KEY = 'chrono:board';

export function loadBoardState(): BoardState | null {
    return dbg.group('board.storage.load', () => {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as BoardState;
            if (!parsed || !Array.isArray(parsed.wheels)) return null;

            dbg.log('board.storage.load.ok', { wheels: parsed.wheels.length });
            return parsed;
        } catch (e) {
            dbg.warn('board.storage.load.fail', e);
            return null;
        }
    });
}

export function saveBoardState(state: BoardState) {
    dbg.group('board.storage.save', () => {
        try {
            dbg.log('board.storage.save.in', { wheels: state.wheels.length });
            localStorage.setItem(KEY, JSON.stringify(state));
            dbg.log('board.storage.save.ok');
        } catch (e) {
            dbg.warn('board.storage.save.fail', e);
        }
    });
}
