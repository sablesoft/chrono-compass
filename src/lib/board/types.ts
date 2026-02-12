// src/lib/board/types.ts
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

export type BoardWheel = {
    kind: 'wheel';

    // ссылка на SavedWheel (из активного профиля)
    wheelId: string;

    // дубли для стабильного рендера/дебага (чтобы доска не “падала”)
    wheelType: WheelType;
    title: string;
    roles: WheelRolesState;

    order: number;
    size?: number;
};

export type BoardState = {
    wheels: BoardWheel[];
    updatedAt: number;
};
