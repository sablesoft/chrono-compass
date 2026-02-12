// src/lib/profile/types.ts
import type { WheelType } from '../catalog';
import type { BodyId } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

export type ProfileId = string;

export type SavedWheel = {
    id: string;
    type: WheelType;
    title: string;
    roles: WheelRolesState;
    favorite?: boolean;
    updatedAt: number;
    createdAt: number;
};

export type BodyUserOverride = {
    name?: { en?: string };
    emoji?: string;
};

/** Снапшот доски: колесо на экране (хранит ПОЛНУЮ конфигурацию, не ссылку на SavedWheel) */
export type BoardWheelItem = {
    kind: 'wheel';
    wheelType: WheelType;
    title: string;
    roles: WheelRolesState;
    order: number;
    size?: number;
};

export type BoardItem = BoardWheelItem;

export type ProfileData = {
    wheels: SavedWheel[];
    favorites: string[];
    bodies: Partial<Record<BodyId, BodyUserOverride>>;

    /** Сохранённая доска в профиле (снапшот) */
    wheelsOnScreen: BoardItem[];
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
