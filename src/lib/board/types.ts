// src/lib/board/types.ts
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';
import type { CycleInfoConfig, WheelObserverState, WheelTimeState } from '../wheel/types';
import type { BoardLayoutRect } from './layoutEngine';

export type BoardWheelView = {
    showVisual: boolean;
    showInfo: boolean;
    showPickers?: boolean;
    infoChipOrder?: string[];
    infoChipSelected?: string[];
    infoChipLabels?: Record<string, string>;
    infoConfig?: CycleInfoConfig;
};

export type BoardWheel = {
    id: string;
    wheelType: WheelType;
    title: string;
    roles: WheelRolesState;

    observer: WheelObserverState;
    time: WheelTimeState;

    order: number;
    size?: number;
    layout?: BoardLayoutRect;
    view?: BoardWheelView;
};
