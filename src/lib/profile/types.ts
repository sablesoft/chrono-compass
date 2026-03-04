// src/lib/profile/types.ts
import type { WheelType } from '../catalog';
import type { ObjId } from '../catalog';
import type { WheelRolesState } from '../wheel/control';
import type { WheelObserverState, WheelTimeState } from '../wheel/types';
import type { BoardWheel, BoardWheelView } from '../board/types';

export type ProfileId = string;

/**
 * SavedWheel = preset stored in profile library.
 * dedupKey is deterministic for (type+roles+observer+time) and is used ONLY inside profile
 * to dedupe/overwrite same config.
 */
export type SavedWheel = {
    dedupKey: string;
    type: WheelType;
    title: string;
    roles: WheelRolesState;

    observer: WheelObserverState;
    time: WheelTimeState;
    view?: BoardWheelView;

    favorite?: boolean;
    updatedAt: number;
    createdAt: number;
};

export type BodyUserOverride = {
    name?: { en?: string };
    emoji?: string;
};

export type ProfileData = {
    wheels: SavedWheel[];
    favorites: string[]; // stores dedupKey values
    bodies: Partial<Record<ObjId, BodyUserOverride>>;

    /** Сохранённая доска в профиле (снапшот) */
    wheelsOnScreen: BoardWheel[];
};

export type Profile = {
    id: ProfileId;
    title: string;
    createdAt: number;
    updatedAt: number;
    data: ProfileData;
};

export type ProfilesState = {
    profiles: Profile[];
    activeId: ProfileId | null;
};
