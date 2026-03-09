// src/lib/board/types.ts
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';
import type { CompassInfoConfig, CycleInfoConfig, WheelObserverState, WheelTimeState } from '../wheel/types';
import type { BoardLayoutRect } from './layoutEngine';

export type BoardWheelView = {
    showVisual: boolean;
    showInfo: boolean;
    showPickers?: boolean;
    infoChipOrder?: string[];
    infoChipSelected?: string[];
    infoChipLabels?: Record<string, string>;
    infoConfig?: CycleInfoConfig;
    compassInfoConfig?: CompassInfoConfig;
    markerScaleBias?: number;
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
