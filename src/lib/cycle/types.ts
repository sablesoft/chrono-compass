// src/lib/cycle/types.ts

import type { CycleSpoke } from '../board/runtime';
import type {WheelType} from "../catalog";
import type {WheelRolesState} from "../wheel/control";

export type CacheKey = string & { readonly __wheelKey: unique symbol };
export type CacheWheelLike = {
    wheelType: WheelType;
    roles: WheelRolesState;
    observer?: { locationId?: string }; // в ключ влияет только locationId
};

export type CycleData<Meta = any> = {
    cacheKey: CacheKey;
    startTs: number;
    endTs: number;
    spokes: CycleSpoke<Meta>[];
    createdAt: number;
    updatedAt: number;
};
