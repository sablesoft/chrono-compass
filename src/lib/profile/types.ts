// src/lib/profile/types.ts
import type { WheelType } from '../catalog';
import type { ObjId } from '../catalog';
import type { WheelRolesState } from '../wheel/control';
import type { WheelObserverState, WheelTimeState } from '../wheel/types';
import type {BoardWheel} from "../board/types";

export type ProfileId = string;

export type SavedWheel = {
    id: string;               // deterministic: makeWheelId(type, roles, observer, time)
    type: WheelType;
    title: string;
    roles: WheelRolesState;

    observer: WheelObserverState;
    time: WheelTimeState;

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
    favorites: string[];
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
